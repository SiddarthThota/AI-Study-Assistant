from __future__ import annotations

import json
import os
import re
import time
import unicodedata
from typing import Any, Dict, List

from ...core.config import settings


class AIServiceError(RuntimeError):
    status_code = 502


class AIConfigurationError(AIServiceError):
    status_code = 503


def _gemini_env() -> str | None:
    return settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")


def _client() -> Any | None:
    api_key = _gemini_env()
    if not api_key:
        if settings.APP_ENV == "development" and settings.AI_DEMO_MODE:
            return None
        raise AIConfigurationError("GEMINI_API_KEY is required; demo responses are disabled")

    try:
        from google import genai
        from google.genai import types

        return genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=settings.GEMINI_TIMEOUT_MS),
        )
    except Exception as exc:
        raise AIServiceError("Gemini client could not be initialized") from exc


def _generate_content(client: Any, _allow_fallback: bool = True, **kwargs: Any) -> Any:
    for attempt in range(2):
        try:
            return client.models.generate_content(**kwargs)
        except Exception as exc:
            status_code = getattr(exc, "code", None)
            if status_code == 503 and attempt == 1 and _allow_fallback:
                fallback_model = settings.GEMINI_FALLBACK_MODEL
                if fallback_model and fallback_model != kwargs.get("model"):
                    return _generate_content(client, False, **{**kwargs, "model": fallback_model})
            if status_code not in (429, 500, 502, 503, 504) or attempt == 1:
                raise
            time.sleep(0.5 * (attempt + 1))
    raise AIServiceError("Gemini request failed")


def _fallback_notes(topic: str, difficulty: str, source_text: str = "") -> str:
    source = f"\n\nSource context: {source_text[:1800]}" if source_text else ""
    return (
        f"# {topic}\n\n"
        "## Overview\n"
        f"{topic} is a foundational concept that is best understood by connecting the core idea to a real-world example and clear definitions.{source}\n\n"
        "## Learning objectives\n"
        "- Define the key idea in simple terms.\n"
        "- Explain why it matters in practice.\n"
        "- Identify common mistakes or misconceptions.\n"
        "- Connect the idea to a real example or scenario.\n\n"
        "## Core concepts\n"
        "- Start with the essential definition.\n"
        "- Link it to the broader learning goal.\n"
        "- Practice using the idea in a simple example before moving to more complex cases.\n\n"
        "## Detailed explanation\n"
        f"At the {difficulty.lower()} level, focus on the main idea behind {topic} rather than memorizing isolated facts. Start by identifying the core mechanism, then explain why it matters and how it interacts with related concepts.\n\n"
        "## Common mistakes\n"
        "- Memorizing vocabulary without understanding the concept.\n"
        "- Confusing related ideas that look similar.\n"
        "- Ignoring the practical application of the idea.\n\n"
        "## Key takeaways\n"
        "- Focus on understanding instead of memorization.\n"
        "- Apply the concept to an example.\n"
        "- Review the idea repeatedly to improve recall.\n\n"
        "## Quick recall\n"
        "1. What is the central idea?\n"
        "2. Why does it matter?\n"
        "3. What common mistake should you avoid?\n"
        "4. How would you apply it in practice?\n"
        "5. What is the simplest example that proves you understand it?\n"
    )


def _parse_response(payload: str) -> Any:
    cleaned = payload.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`\n ")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return json.loads(cleaned)


def _normalized_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(normalized.split())


def _content_tokens(value: str) -> set[str]:
    ignored = {
        "about", "after", "also", "and", "are", "because", "been", "before", "being", "between",
        "does", "from", "have", "into", "more", "most", "other", "should", "some", "such", "than",
        "that", "their", "there", "these", "they", "this", "those", "through", "under", "using",
        "what", "when", "where", "which", "while", "with", "would", "your",
    }
    tokens = set()
    for token in re.findall(r"[a-z0-9_]+", _normalized_text(value)):
        if len(token) <= 2 or token in ignored:
            continue
        if token.endswith("ies") and len(token) > 5:
            token = token[:-3] + "y"
        elif token.endswith("ing") and len(token) > 5:
            token = token[:-3]
            if len(token) > 2 and token[-1] == token[-2]:
                token = token[:-1]
        elif token.endswith("ed") and len(token) > 4:
            token = token[:-2]
        elif token.endswith("ment") and len(token) > 7:
            token = token[:-4]
        elif token.endswith("s") and not token.endswith("ss") and len(token) > 3:
            token = token[:-1]
        tokens.add(token)
    return tokens


def _quiz_source_passages(notes: str) -> List[str]:
    passages: List[str] = []
    seen_passages: set[str] = set()
    for line in notes[:18000].splitlines():
        if re.match(r"^\s{0,3}#{1,6}\s+", line):
            continue
        cleaned = re.sub(r"^\s{0,3}#{1,6}\s*", "", line)
        cleaned = re.sub(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)", "", cleaned).strip()
        if not cleaned:
            continue
        for sentence in re.split(r"(?<=[.!?])\s+", cleaned):
            passage = sentence.strip()
            normalized = _normalized_text(passage)
            if not passage or not _content_tokens(passage) or normalized in seen_passages:
                continue
            seen_passages.add(normalized)
            passages.append(passage)
    return passages


def _validate_quiz_questions(data: Any, notes: str) -> List[Dict[str, Any]]:
    if not isinstance(data, list) or len(data) != 5:
        raise AIServiceError("Gemini returned an invalid quiz structure")

    source_passages = _quiz_source_passages(notes)
    if not source_passages:
        raise AIServiceError("Study notes contain no source passages for quiz grounding")
    seen_questions: set[str] = set()
    seen_question_tokens: List[set[str]] = []
    source_sentences = [_content_tokens(passage) for passage in source_passages]

    for question in data:
        if not isinstance(question, dict):
            raise AIServiceError("Gemini returned a malformed quiz question")
        if not isinstance(question.get("options"), list) or len(question["options"]) != 4:
            raise AIServiceError("Gemini returned an invalid number of quiz options")
        if not all(isinstance(option, str) and option.strip() for option in question["options"]):
            raise AIServiceError("Gemini returned malformed quiz options")
        if len({_normalized_text(option) for option in question["options"]}) != 4:
            raise AIServiceError("Gemini returned duplicate quiz options")
        correct_answer = question.get("correct_answer")
        if not isinstance(correct_answer, str):
            raise AIServiceError("Gemini quiz answer is not one of the options")
        matching_options = [option for option in question["options"] if _normalized_text(option) == _normalized_text(correct_answer)]
        if len(matching_options) != 1:
            raise AIServiceError("Gemini quiz answer is not one of the options")
        question["correct_answer"] = matching_options[0]

        for field in ("question", "explanation", "concept", "difficulty", "question_type"):
            if not isinstance(question.get(field), str) or not question[field].strip():
                raise AIServiceError("Gemini returned incomplete quiz content")

        evidence_fields = ("concept_evidence_index", "answer_evidence_index")
        for field in evidence_fields:
            index = question.get(field)
            if isinstance(index, str) and index.isdigit():
                index = int(index)
            if not isinstance(index, int) or isinstance(index, bool) or not 1 <= index <= len(source_passages):
                raise AIServiceError("Gemini returned an invalid source passage index")
            question[field] = index
        question["concept_evidence"] = source_passages[question["concept_evidence_index"] - 1]
        question["answer_evidence"] = source_passages[question["answer_evidence_index"] - 1]

        normalized_question = _normalized_text(question["question"])
        if normalized_question in seen_questions:
            raise AIServiceError("Gemini returned duplicate quiz questions")
        seen_questions.add(normalized_question)
        question_tokens = _content_tokens(question["question"])
        for prior_tokens in seen_question_tokens:
            if question_tokens and prior_tokens and len(question_tokens & prior_tokens) / len(question_tokens | prior_tokens) >= 0.9:
                raise AIServiceError("Gemini returned near-duplicate quiz questions")
        seen_question_tokens.append(question_tokens)

        concept_tokens = _content_tokens(question["concept"])
        if not concept_tokens or not concept_tokens.issubset(_content_tokens(question["concept_evidence"])):
            raise AIServiceError("Gemini quiz concept label is not supported by its quoted source evidence")
        answer_tokens = _content_tokens(question["correct_answer"])
        evidence_tokens = _content_tokens(question["answer_evidence"])
        minimum_overlap = max(1, (min(len(answer_tokens), 4) + 1) // 2)
        if not answer_tokens or len(answer_tokens & evidence_tokens) < minimum_overlap:
            raise AIServiceError("Gemini quiz answer is not supported by its quoted source evidence")

        question_tokens = _content_tokens(question["question"])
        for sentence_tokens in source_sentences:
            if not question_tokens or not sentence_tokens:
                continue
            overlap = len(question_tokens & sentence_tokens)
            similarity = overlap / len(question_tokens | sentence_tokens)
            if similarity >= 0.9:
                raise AIServiceError("Gemini copied a source sentence instead of writing a concept question")

    return data


def generate_notes(topic: str, difficulty: str, source_text: str = "") -> str:
    client = _client()
    if client is None:
        return _fallback_notes(topic, difficulty, source_text)

    try:
        prompt = (
            f"Create rich, structured educational learning material for: {topic}\n\n"
            f"Difficulty: {difficulty}\n\n"
            "Return substantial Markdown study material with an intuitive overview, prerequisites, learning objectives, precise definitions, connected core concepts, a step-by-step explanation, at least two worked examples, applications, common misconceptions, comparison points, a short practice section with answers withheld, key takeaways, and quick-recall prompts. Avoid generic filler.\n"
            "Ground the content in the following source material when provided: \n"
            f"{source_text[:20000]}"
        )
        response = _generate_content(
            client,
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config={"temperature": 0.2, "max_output_tokens": 1200},
        )
        content = (response.text or "").strip()
        if len(content) < 300:
            raise AIServiceError("Gemini returned incomplete study notes")
        return content
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError("Gemini note generation failed") from exc


def generate_quiz(notes: str, topic: str) -> List[Dict[str, Any]]:
    client = _client()
    if client is None:
        return [
            {
                "question": f"What is the central idea behind {topic}?",
                "options": ["A foundational concept", "An unrelated fact", "A random example", "A duplicate statement"],
                "correct_answer": "A foundational concept",
                "explanation": "The best answer matches the core idea of the topic.",
                "concept": "Foundational understanding",
                "difficulty": "Intermediate",
                "question_type": "Conceptual",
                "concept_evidence": topic,
                "answer_evidence": topic,
            },
            {
                "question": f"Which practice step best supports learning {topic}?",
                "options": ["Explain the concept in your own words", "Ignore the examples", "Skip review", "Memorize without context"],
                "correct_answer": "Explain the concept in your own words",
                "explanation": "Active explanation improves retention and understanding.",
                "concept": "Recall",
                "difficulty": "Beginner",
                "question_type": "Application",
                "concept_evidence": topic,
                "answer_evidence": topic,
            },
            {
                "question": f"What is a common mistake when studying {topic}?",
                "options": ["Relying only on memorization", "Using examples", "Reviewing key ideas", "Testing recall"],
                "correct_answer": "Relying only on memorization",
                "explanation": "Memorization without understanding leads to weak retention.",
                "concept": "Misconceptions",
                "difficulty": "Intermediate",
                "question_type": "Reasoning",
                "concept_evidence": topic,
                "answer_evidence": topic,
            },
            {
                "question": f"Which statement best demonstrates understanding of {topic}?",
                "options": ["You can connect the idea to a real scenario", "You can ignore all examples", "You can skip the definitions", "You can avoid practice"],
                "correct_answer": "You can connect the idea to a real scenario",
                "explanation": "Application to a real scenario is a sign of deeper understanding.",
                "concept": "Application",
                "difficulty": "Intermediate",
                "question_type": "Scenario",
                "concept_evidence": topic,
                "answer_evidence": topic,
            },
            {
                "question": f"What should a student do after generating notes on {topic}?",
                "options": ["Practice recall and test themselves", "Delete the notes", "Stop reviewing", "Ignore mistakes"],
                "correct_answer": "Practice recall and test themselves",
                "explanation": "Retrieval practice is one of the best ways to improve learning.",
                "concept": "Study workflow",
                "difficulty": "Beginner",
                "question_type": "Conceptual",
                "concept_evidence": topic,
                "answer_evidence": topic,
            },
        ]

    try:
        prompt = (
            "Generate exactly 5 distinct multiple-choice questions grounded only in the supplied structured study notes. "
            "Use concepts from the Core concepts and Learning objectives sections when present. Test relationships, application, or reasoning; do not copy a sentence from the notes as a question. "
            "Each item must contain question, exactly four distinct plausible options, correct_answer, explanation, concept, difficulty, question_type, concept_evidence_index, and answer_evidence_index. "
            "The correct_answer value must exactly match one of the four options, including spelling and punctuation. "
            "Both evidence fields are 1-based integer indexes into the numbered source passages below. Choose source passages that directly support the concept and correct answer; do not write or paraphrase evidence text. "
            "Set concept to a short source-supported phrase and keep the correct answer semantically supported by its indexed passage. Return a valid JSON array only.\n\n"
            "Numbered source passages:\n"
            + "\n".join(f"{index}. {passage}" for index, passage in enumerate(_quiz_source_passages(notes), start=1))
        )
        validation_error = ""
        for attempt in range(3):
            repair_instruction = (
                f"\n\nYour previous quiz output failed validation: {validation_error}. "
                "Return a fully corrected JSON array. Recheck exact source excerpts, answer-option equality, concept/answer support, and question uniqueness."
                if validation_error else ""
            )
            response = _generate_content(
                client,
                model=settings.GEMINI_MODEL,
                contents=prompt + repair_instruction,
                config={"temperature": 0.2, "max_output_tokens": 1800},
            )
            try:
                return _validate_quiz_questions(_parse_response(response.text), notes)
            except AIServiceError as exc:
                validation_error = str(exc)
            except Exception:
                validation_error = "The output was not valid JSON matching the required structure"
        raise AIServiceError(f"Gemini quiz validation failed after repair attempts: {validation_error}")
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError("Gemini quiz generation failed") from exc


def _fallback_quiz(topic: str) -> List[Dict[str, str | List[str]]]:
    return [
        {
            "question": f"What is the core idea behind {topic}?",
            "options": ["A basic concept", "An irrelevant detail", "A duplicate fact", "A random term"],
            "correct_answer": "A basic concept",
            "explanation": "The concept should be understood as the central idea of the topic.",
            "concept": "Foundational understanding",
            "difficulty": "Beginner",
            "question_type": "Conceptual",
        }
    ]


def generate_flashcards(notes: str, topic: str) -> List[Dict[str, str]]:
    client = _client()
    if client is None:
        return [
            {"question": f"Define {topic} in one sentence.", "answer": f"{topic} is a concept that can be understood by focusing on its main idea and practical use.", "type": "Definition", "difficulty": "Intermediate"},
            {"question": "What should you do before memorizing details?", "answer": "Understand the central idea and connect it to an example.", "type": "Concept", "difficulty": "Beginner"},
            {"question": "Why does retrieval practice help?", "answer": "It strengthens memory by requiring active recall instead of passive rereading.", "type": "Why/How", "difficulty": "Intermediate"},
            {"question": "What is a common misconception?", "answer": "Confusing memorization with understanding is a common mistake.", "type": "Cause/Effect", "difficulty": "Intermediate"},
            {"question": "How can you apply the concept in practice?", "answer": "Use the idea in a real scenario or example to test your understanding.", "type": "Example", "difficulty": "Intermediate"},
        ]

    try:
        prompt = (
            "Generate 5 flashcards from the study notes. Return only JSON array with objects {'question','answer','type','difficulty'}\n\n"
            f"Study notes:\n{notes[:18000]}"
        )
        response = _generate_content(
            client,
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config={"temperature": 0.2, "max_output_tokens": 1200},
        )
        data = _parse_response(response.text)
        if not isinstance(data, list) or len(data) != 5:
            raise AIServiceError("Gemini returned an invalid flashcard set")
        for card in data:
            if not isinstance(card, dict) or not all(isinstance(card.get(field), str) and card[field].strip() for field in ("question", "answer")):
                raise AIServiceError("Gemini returned a malformed flashcard")
        return data
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError("Gemini flashcard generation failed") from exc


def generate_tutor_answer(topic: str, question: str, notes: str, pdf_context: str = "", chat_history: List[Dict[str, str]] | None = None) -> str:
    client = _client()
    if client is None:
        return (
            f"Here is a clear explanation of {topic or 'your topic'}: "
            f"Start with the core idea, relate it to a practical example, and test your understanding by explaining it in your own words. "
            f"Your question: {question}"
        )

    try:
        history_text = "\n".join(f"{item.get('role','user')}: {item.get('content','')}" for item in (chat_history or []))
        prompt = (
            "You are an expert student tutor. Teach clearly, give examples, and correct misconceptions. "
            "Answer with a helpful explanation and end with a short follow-up question.\n\n"
            f"Topic: {topic}\n\nStudy notes:\n{notes[:15000]}\n\nPDF context:\n{pdf_context[:15000]}\n\nChat history:\n{history_text}\n\nUser question:\n{question}"
        )
        response = _generate_content(
            client,
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config={"temperature": 0.35, "max_output_tokens": 900},
        )
        content = (response.text or "").strip()
        if not content:
            raise AIServiceError("Gemini returned an empty tutor response")
        return content
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError("Gemini tutor response failed") from exc
