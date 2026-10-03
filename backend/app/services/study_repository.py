from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from .supabase_service import get_supabase_client


class PersistenceError(RuntimeError):
    pass


def _execute(query: Any, operation: str) -> List[Dict[str, Any]]:
    try:
        response = query.execute()
        return getattr(response, "data", None) or []
    except Exception as exc:
        raise PersistenceError(f"Study data could not be {operation} in Supabase") from exc


def _insert(user_id: str, token: str, table: str, values: Dict[str, Any]) -> Dict[str, Any]:
    client = get_supabase_client(token)
    rows = _execute(client.table(table).insert({**values, "user_id": user_id}), "saved")
    if not rows:
        raise PersistenceError(f"Supabase returned no saved {table} record")
    return rows[0]


def _select(user_id: str, token: str, table: str, limit: int = 100) -> List[Dict[str, Any]]:
    client = get_supabase_client(token)
    return _execute(
        client.table(table).select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit),
        "loaded",
    )


def _select_one(user_id: str, token: str, table: str, record_id: str) -> Dict[str, Any] | None:
    client = get_supabase_client(token)
    rows = _execute(
        client.table(table).select("*").eq("user_id", user_id).eq("id", record_id).limit(1),
        "loaded",
    )
    return rows[0] if rows else None


def _activity(user_id: str, token: str, event_type: str, label: str, study_session_id: str | None = None) -> None:
    _insert(
        user_id,
        token,
        "study_activity",
        {"event_type": event_type, "label": label, "study_session_id": study_session_id},
    )


def _increment_progress(user_id: str, token: str, field: str) -> None:
    client = get_supabase_client(token)
    try:
        client.rpc("increment_study_progress_v1", {"p_field": field}).execute()
    except Exception as exc:
        raise PersistenceError("Learning progress could not be updated in Supabase") from exc


def create_note(user_id: str, token: str, topic: str, difficulty: str, notes: str, source_type: str) -> Dict[str, Any]:
    session = _insert(user_id, token, "study_sessions", {"topic": topic, "source_type": source_type})
    note = _insert(
        user_id,
        token,
        "study_notes",
        {
            "study_session_id": session["id"],
            "topic": topic,
            "difficulty": difficulty,
            "notes": notes,
            "source_type": source_type,
        },
    )
    _activity(user_id, token, "note", f"Generated notes for {topic}", session["id"])
    _increment_progress(user_id, token, "notes_created")
    return {**note, "study_session_id": session["id"]}


def create_quiz(user_id: str, token: str, topic: str, questions: List[Dict[str, Any]], study_session_id: str | None = None) -> Dict[str, Any]:
    if study_session_id and _select_one(user_id, token, "study_sessions", study_session_id) is None:
        raise ValueError("Study session was not found")
    return _insert(user_id, token, "quizzes", {
        "topic": topic,
        "questions": questions,
        "study_session_id": study_session_id,
    })


def submit_quiz(user_id: str, token: str, quiz_id: str, answers: List[str]) -> Dict[str, Any] | None:
    quiz = _select_one(user_id, token, "quizzes", quiz_id)
    if quiz is None:
        return None
    questions = quiz.get("questions") or []
    if len(answers) != len(questions):
        raise ValueError("Submit one answer for each quiz question")
    score = sum(answer == question.get("correct_answer") for answer, question in zip(answers, questions))
    attempt = _insert(user_id, token, "quiz_attempts", {
        "quiz_id": quiz_id,
        "topic": quiz["topic"],
        "answers": answers,
        "score": score,
        "question_count": len(questions),
    })
    _activity(user_id, token, "quiz", f"Completed quiz on {quiz['topic']}")
    _increment_progress(user_id, token, "quiz_attempts")
    return attempt


def create_flashcard_set(user_id: str, token: str, topic: str, cards: List[Dict[str, Any]], study_session_id: str | None = None) -> Dict[str, Any]:
    if study_session_id and _select_one(user_id, token, "study_sessions", study_session_id) is None:
        raise ValueError("Study session was not found")
    result = _insert(user_id, token, "flashcards", {
        "topic": topic,
        "flashcard_content": cards,
        "study_session_id": study_session_id,
    })
    _activity(user_id, token, "flashcards", f"Created {len(cards)} flashcards for {topic}", study_session_id)
    return result


def review_flashcard(user_id: str, token: str, flashcard_id: str, card_index: int, reviewed: bool) -> Dict[str, Any] | None:
    card_set = _select_one(user_id, token, "flashcards", flashcard_id)
    if card_set is None:
        return None
    cards = card_set.get("flashcard_content") or []
    if card_index >= len(cards):
        raise ValueError("Flashcard index is out of range")
    client = get_supabase_client(token)
    values = {
        "user_id": user_id,
        "flashcard_id": flashcard_id,
        "card_index": card_index,
        "reviewed": reviewed,
        "reviewed_at": datetime.now(timezone.utc).isoformat() if reviewed else None,
    }
    rows = _execute(
        client.table("flashcard_reviews").upsert(values, on_conflict="flashcard_id,card_index"),
        "saved",
    )
    if reviewed:
        _activity(user_id, token, "flashcard_review", f"Reviewed a flashcard from {card_set['topic']}")
        _increment_progress(user_id, token, "flashcards_reviewed")
    return rows[0] if rows else values


def save_tutor_exchange(
    user_id: str,
    token: str,
    topic: str,
    question: str,
    answer: str,
    conversation_id: str | None = None,
    study_session_id: str | None = None,
) -> Dict[str, Any]:
    conversation = _select_one(user_id, token, "tutor_conversations", conversation_id) if conversation_id else None
    if conversation_id and conversation is None:
        raise ValueError("Tutor conversation was not found")
    if conversation is None:
        conversation = _insert(user_id, token, "tutor_conversations", {"topic": topic, "study_session_id": study_session_id})
    _insert(user_id, token, "tutor_messages", {
        "conversation_id": conversation["id"], "role": "user", "content": question,
    })
    _insert(user_id, token, "tutor_messages", {
        "conversation_id": conversation["id"], "role": "assistant", "content": answer,
    })
    _activity(user_id, token, "tutor", f"Asked the tutor about {topic}")
    _increment_progress(user_id, token, "tutor_questions")
    return conversation


def get_tutor_messages(user_id: str, token: str, conversation_id: str) -> List[Dict[str, Any]]:
    conversation = _select_one(user_id, token, "tutor_conversations", conversation_id)
    if conversation is None:
        raise ValueError("Tutor conversation was not found")
    client = get_supabase_client(token)
    return _execute(
        client.table("tutor_messages")
        .select("*")
        .eq("user_id", user_id)
        .eq("conversation_id", conversation_id)
        .order("created_at"),
        "loaded",
    )


def dashboard(user_id: str, token: str) -> Dict[str, Any]:
    notes = _select(user_id, token, "study_notes", 200)
    attempts = _select(user_id, token, "quiz_attempts", 200)
    activity = _select(user_id, token, "study_activity", 10)
    reviews = _select(user_id, token, "flashcard_reviews", 500)
    progress = _select(user_id, token, "study_progress", 1)
    sessions = _select(user_id, token, "study_sessions", 1)
    settings = get_study_settings(user_id, token)

    current_topic = notes[0]["topic"] if notes else "Start with a topic"
    progress_row = progress[0] if progress else {}
    recent_activity = [item["label"] for item in activity] or ["Create a study note to begin"]
    weak_concepts = ["Review recent quiz answers"] if attempts else ["No data yet"]
    completed = int(progress_row.get("notes_created", 0)) + int(progress_row.get("quiz_attempts", 0))

    active_session = get_active_session(user_id, token)
    has_active = active_session is not None
    active_topic = active_session["topic"] if has_active else None
    active_session_id = active_session["study_session_id"] if has_active else None

    return {
        "topic": current_topic,
        "progress": min(100, completed * 10 + min(len(reviews), 10) * 2),
        "next_action": "Review recent quiz answers" if attempts else "Generate notes or practice a quiz",
        "recent_activity": recent_activity,
        "weak_concepts": weak_concepts,
        "has_active_session": has_active,
        "active_topic": active_topic,
        "active_session_id": active_session_id,
        "study_goal": settings.get("study_goal", ""),
    }


def set_active_session(user_id: str, token: str, session_id: str) -> None:
    if _select_one(user_id, token, "study_sessions", session_id) is None:
        raise ValueError("Study session was not found")
    _activity(user_id, token, "set_active", "Resumed study session", session_id)


def get_active_session(user_id: str, token: str) -> Dict[str, Any] | None:
    client = get_supabase_client(token)
    activity = _execute(
        client.table("study_activity")
        .select("study_session_id")
        .eq("user_id", user_id)
        .in_("event_type", ["set_active", "note"])
        .order("created_at", desc=True)
        .limit(1),
        "loaded"
    )
    if not activity or not activity[0].get("study_session_id"):
        return None

    session_id = activity[0]["study_session_id"]
    session = _select_one(user_id, token, "study_sessions", session_id)
    if not session:
        return None

    notes = _execute(client.table("study_notes").select("*").eq("study_session_id", session_id).order("created_at", desc=True).limit(1), "loaded")
    quizzes = _execute(client.table("quizzes").select("*").eq("study_session_id", session_id).order("created_at", desc=True).limit(1), "loaded")
    flashcards = _execute(client.table("flashcards").select("*").eq("study_session_id", session_id).order("created_at", desc=True).limit(1), "loaded")
    tutor_convs = _execute(client.table("tutor_conversations").select("id").eq("study_session_id", session_id).order("created_at", desc=True).limit(1), "loaded")

    return {
        "study_session_id": session_id,
        "topic": session["topic"],
        "source_type": session.get("source_type", "topic"),
        "notes": notes[0]["notes"] if notes else None,
        "quiz": quizzes[0] if quizzes else None,
        "flashcards": flashcards[0] if flashcards else None,
        "tutor_conversation_id": tutor_convs[0]["id"] if tutor_convs else None,
    }


def history(user_id: str, token: str) -> Dict[str, Any]:
    return {
        "notes": _select(user_id, token, "study_notes"),
        "quizzes": _select(user_id, token, "quiz_attempts"),
        "flashcards": _select(user_id, token, "flashcards"),
        "flashcard_reviews": _select(user_id, token, "flashcard_reviews"),
        "tutor_conversations": _select(user_id, token, "tutor_conversations"),
        "tutor_messages": _select(user_id, token, "tutor_messages"),
        "sessions": _select(user_id, token, "study_sessions"),
        "progress": _select(user_id, token, "study_progress", 1),
        "activity": _select(user_id, token, "study_activity", 20),
    }


def get_study_settings(user_id: str, token: str) -> Dict[str, str]:
    rows = _select(user_id, token, "user_settings", 1)
    if rows:
        return {"study_goal": str(rows[0]["study_goal"])}
    return {"study_goal": "Master difficult concepts with daily practice."}


def save_study_settings(user_id: str, token: str, study_goal: str) -> Dict[str, str]:
    client = get_supabase_client(token)
    try:
        response = client.table("user_settings").upsert(
            {"user_id": user_id, "study_goal": study_goal}, on_conflict="user_id"
        ).execute()
        rows = getattr(response, "data", None) or []
    except Exception as exc:
        raise PersistenceError("Study settings could not be saved in Supabase") from exc
    if rows:
        return {"study_goal": str(rows[0]["study_goal"])}
    return {"study_goal": study_goal}
