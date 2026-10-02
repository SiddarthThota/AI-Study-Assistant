from __future__ import annotations

import json
from collections.abc import Iterator
from io import BytesIO
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app.api.dependencies import AuthenticatedUser, get_current_user
from backend.app.main import app
from backend.app.api.routes import notes as notes_route
from backend.app.services.ai import gemini_service
from backend.app.services import study_repository
from backend.app.services.ai.gemini_service import AIServiceError, _validate_quiz_questions
from backend.app.services.pdf import extractor as pdf_extractor


TEST_USER = AuthenticatedUser(
    id="11111111-1111-4111-8111-111111111111",
    email="learner@example.test",
    name="Test Learner",
    access_token="verified-test-token",
)


@pytest.fixture
def api_client() -> Iterator[TestClient]:
    with TestClient(app) as client:
        yield client


@pytest.fixture
def authenticated_client() -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


class FakeQuery:
    def __init__(self, client: "FakeSupabase", table_name: str):
        self.client = client
        self.table_name = table_name
        self.operation = "select"
        self.filters: list[tuple[str, Any]] = []
        self.values: dict[str, Any] = {}

    def select(self, *_args: Any, **_kwargs: Any) -> "FakeQuery":
        self.operation = "select"
        return self

    def insert(self, values: dict[str, Any]) -> "FakeQuery":
        self.operation = "insert"
        self.values = values
        return self

    def upsert(self, values: dict[str, Any], **_kwargs: Any) -> "FakeQuery":
        self.operation = "upsert"
        self.values = values
        return self

    def update(self, values: dict[str, Any]) -> "FakeQuery":
        self.operation = "update"
        self.values = values
        return self

    def delete(self) -> "FakeQuery":
        self.operation = "delete"
        return self

    def eq(self, field: str, value: Any) -> "FakeQuery":
        self.filters.append((field, value))
        return self

    def order(self, *_args: Any, **_kwargs: Any) -> "FakeQuery":
        return self

    def limit(self, *_args: Any, **_kwargs: Any) -> "FakeQuery":
        return self

    def maybe_single(self) -> "FakeQuery":
        return self

    def execute(self) -> Any:
        self.client.queries.append(self)
        if self.table_name == "quizzes" and self.operation == "select":
            if ("user_id", TEST_USER.id) in self.filters:
                return SimpleResponse([{
                    "id": "quiz-owned-by-test-user",
                    "user_id": TEST_USER.id,
                    "topic": "Linear algebra",
                    "questions": [
                        {"correct_answer": "A"},
                        {"correct_answer": "B"},
                    ],
                }])
            return SimpleResponse([])
        if self.operation in ("insert", "upsert"):
            values = dict(self.values)
            values.setdefault("id", f"{self.table_name}-record")
            return SimpleResponse([values])
        if self.operation == "delete":
            return SimpleResponse([{"id": "deleted"}])
        return SimpleResponse([])


class SimpleResponse:
    def __init__(self, data: list[dict[str, Any]]):
        self.data = data


class FakeSupabase:
    def __init__(self):
        self.queries: list[FakeQuery] = []
        self.rpc_calls: list[tuple[str, dict[str, Any]]] = []

    def table(self, table_name: str) -> FakeQuery:
        return FakeQuery(self, table_name)

    def rpc(self, function_name: str, parameters: dict[str, Any]) -> "FakeRpc":
        self.rpc_calls.append((function_name, parameters))
        return FakeRpc()


class FakeRpc:
    def execute(self) -> SimpleResponse:
        return SimpleResponse([])


def test_backend_health_endpoint(api_client: TestClient) -> None:
    response = api_client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_pdf_extractor_preserves_page_text_and_page_boundaries(monkeypatch: pytest.MonkeyPatch) -> None:
    page_one = "A neural network contains connected layers of artificial neurons. " * 2
    page_two = "Training adjusts connection weights to reduce prediction loss. " * 2

    class FakePage:
        def __init__(self, text: str):
            self.text = text

        def extract_text(self) -> str:
            return self.text

    class FakeReader:
        is_encrypted = False
        pages = [FakePage(page_one), FakePage(page_two)]

    monkeypatch.setattr(pdf_extractor, "PdfReader", lambda *_args, **_kwargs: FakeReader())
    source_text, page_count = pdf_extractor.extract_pdf_text(b"%PDF-1.7 test bytes")

    assert page_count == 2
    assert "[Page 1]" in source_text and "[Page 2]" in source_text
    assert page_one.strip() in source_text
    assert page_two.strip() in source_text


def test_pdf_extractor_rejects_scanned_or_textless_files(monkeypatch: pytest.MonkeyPatch) -> None:
    class BlankPage:
        def extract_text(self) -> str:
            return ""

    class FakeReader:
        is_encrypted = False
        pages = [BlankPage()]

    monkeypatch.setattr(pdf_extractor, "PdfReader", lambda *_args, **_kwargs: FakeReader())
    with pytest.raises(pdf_extractor.PDFExtractionError, match="Scanned/image-only"):
        pdf_extractor.extract_pdf_text(b"%PDF-1.7 image-only fixture")


def test_pdf_upload_requires_authentication(api_client: TestClient) -> None:
    response = api_client.post(
        "/api/notes/extract-pdf",
        files={"file": ("source.pdf", b"%PDF-1.7", "application/pdf")},
    )

    assert response.status_code == 401


def test_pdf_upload_rejects_non_pdf_extension(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(
        "/api/notes/extract-pdf",
        files={"file": ("source.txt", b"not a pdf", "text/plain")},
    )

    assert response.status_code == 415


def test_pdf_upload_returns_extracted_text_without_ai_call(authenticated_client: TestClient) -> None:
    source_text = "A neural network contains connected layers of artificial neurons. " * 2
    with patch.object(notes_route, "extract_pdf_text", return_value=(source_text, 3)):
        response = authenticated_client.post(
            "/api/notes/extract-pdf",
            files={"file": ("source.pdf", b"%PDF-1.7 fixture", "application/pdf")},
        )

    assert response.status_code == 200
    assert response.json() == {
        "file_name": "source.pdf",
        "page_count": 3,
        "character_count": len(source_text),
        "source_text": source_text,
    }


def _text_pdf(text: str) -> bytes:
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]
    output = BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode())
        output.write(body + b"\nendobj\n")
    xref_offset = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode())
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode())
    output.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode())
    return output.getvalue()


def test_real_pdf_text_extraction_endpoint(authenticated_client: TestClient) -> None:
    source_text = "PDF extraction preserves this selectable source text for grounded study notes. " * 2
    response = authenticated_client.post(
        "/api/notes/extract-pdf",
        files={"file": ("grounding.pdf", _text_pdf(source_text), "application/pdf")},
    )

    assert response.status_code == 200
    assert response.json()["page_count"] == 1
    assert source_text.strip() in response.json()["source_text"]


@pytest.mark.parametrize("path", [
    "/api/study/dashboard",
    "/api/study/history",
    "/api/notes/history",
    "/api/flashcards/history",
])
def test_user_data_endpoints_reject_anonymous_requests(api_client: TestClient, path: str) -> None:
    response = api_client.get(path)

    assert response.status_code == 401


def test_invalid_bearer_token_is_rejected(api_client: TestClient) -> None:
    with patch("backend.app.api.dependencies.verify_access_token", side_effect=ValueError("Invalid or expired session")):
        response = api_client.post("/api/auth/session", headers={"Authorization": "Bearer expired-token"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired session"


def test_identity_comes_from_verified_token_not_request_headers(api_client: TestClient) -> None:
    verified_identity = {"id": TEST_USER.id, "email": TEST_USER.email, "name": TEST_USER.name}
    with patch("backend.app.api.dependencies.verify_access_token", return_value=verified_identity):
        response = api_client.post(
            "/api/auth/session",
            headers={"Authorization": "Bearer verified-test-token", "X-User-ID": "22222222-2222-4222-8222-222222222222"},
        )

    assert response.status_code == 200
    assert response.json()["user_id"] == TEST_USER.id


def test_note_generation_persists_under_verified_user(authenticated_client: TestClient) -> None:
    saved_note = {"id": 123, "study_session_id": "session-1"}
    with patch("backend.app.api.routes.notes.generate_notes", return_value="# Rich notes\n" + "Learning material. " * 30), patch(
        "backend.app.api.routes.notes.create_note", return_value=saved_note
    ) as create_note:
        response = authenticated_client.post(
            "/api/notes/generate",
            json={"topic": "Linear algebra", "difficulty": "Intermediate"},
        )

    assert response.status_code == 200
    assert response.json()["id"] == "123"
    assert response.json()["saved"] is True
    create_note.assert_called_once_with(
        TEST_USER.id,
        TEST_USER.access_token,
        "Linear algebra",
        "Intermediate",
        response.json()["notes"],
        "topic",
    )


def test_flashcard_generation_serializes_legacy_bigint_id(authenticated_client: TestClient) -> None:
    cards = [{"question": "What is a stack?", "answer": "A last-in, first-out structure."}]
    with patch("backend.app.api.routes.flashcards.generate_flashcards", return_value=cards), patch(
        "backend.app.api.routes.flashcards.create_flashcard_set", return_value={"id": 456}
    ):
        response = authenticated_client.post(
            "/api/flashcards/generate",
            json={"topic": "Data structures", "notes": "Stack notes"},
        )

    assert response.status_code == 200
    assert response.json()["flashcard_set_id"] == "456"


def _grounded_question(question: str, concept: str, answer: str, evidence_index: int) -> dict[str, Any]:
    return {
        "question": question,
        "options": [answer, "A contrasting process", "An unrelated property", "A random selection"],
        "correct_answer": answer,
        "explanation": "The quoted source supports this answer.",
        "concept": concept,
        "difficulty": "Intermediate",
        "question_type": "Application",
        "concept_evidence_index": evidence_index,
        "answer_evidence_index": evidence_index,
    }


def test_quiz_validation_requires_verbatim_source_evidence() -> None:
    notes = (
        "## Core concepts\n"
        "A vector stores direction and magnitude.\n"
        "Dot products combine aligned components.\n"
        "Orthogonal vectors have a zero dot product.\n"
        "A basis spans a vector space.\n"
        "Linear transformations preserve vector addition."
    )
    questions = [
        _grounded_question("How does vector representation encode orientation?", "vector", "Direction and magnitude", 1),
        _grounded_question("What operation combines aligned components?", "dot products", "Dot products", 2),
        _grounded_question("What value signals orthogonal vectors?", "orthogonal vectors", "Zero dot product", 3),
        _grounded_question("What does a basis do for a space?", "basis", "Spans a vector space", 4),
        _grounded_question("What property is preserved by a linear transformation?", "linear transformations", "Vector addition", 5),
    ]

    validated = _validate_quiz_questions(questions, notes)
    assert len(validated) == 5
    assert all(question["concept_evidence"] in notes and question["answer_evidence"] in notes for question in validated)


def test_generate_quiz_uses_numbered_source_passages_and_resolves_citations(monkeypatch: pytest.MonkeyPatch) -> None:
    notes = "A vector stores direction and magnitude. Dot products combine aligned components. Orthogonal vectors have a zero dot product. A basis spans a vector space. Linear transformations preserve vector addition."
    response_questions = [
        _grounded_question("How does vector representation encode orientation?", "vector", "direction and magnitude", 1),
        _grounded_question("What operation combines aligned components?", "dot products", "Dot products", 2),
        _grounded_question("What value signals orthogonal vectors?", "orthogonal vectors", "zero dot product", 3),
        _grounded_question("What does a basis do for a space?", "basis", "spans a vector space", 4),
        _grounded_question("What property is preserved by linear transformations?", "linear transformations", "vector addition", 5),
    ]
    calls: list[str] = []
    monkeypatch.setattr(gemini_service, "_client", lambda: object())

    def return_response(_client: object, **kwargs: Any) -> SimpleNamespace:
        calls.append(kwargs["contents"])
        return SimpleNamespace(text=json.dumps(response_questions))

    monkeypatch.setattr(gemini_service, "_generate_content", return_response)

    result = gemini_service.generate_quiz(notes, "Vectors")

    assert "1. A vector stores direction and magnitude." in calls[0]
    assert "concept_evidence_index" in calls[0]
    assert result[0]["concept_evidence"] == "A vector stores direction and magnitude."
    assert result[0]["answer_evidence"] == "A vector stores direction and magnitude."


def test_quiz_validation_rejects_off_topic_evidence() -> None:
    question = _grounded_question("What is the role of photosynthesis?", "photosynthesis", "Captures light energy", 1)
    questions = [question] * 5

    with pytest.raises(AIServiceError, match="concept label"):
        _validate_quiz_questions(questions, "## Core concepts\nA vector stores direction and magnitude.")


def test_quiz_validation_rejects_unsupported_answers() -> None:
    notes = "A vector stores direction and magnitude."
    question = _grounded_question("How is a vector described?", "vector", "A database stores records", 1)

    with pytest.raises(AIServiceError, match="not supported by its quoted source evidence"):
        _validate_quiz_questions([question] * 5, notes)


def test_quiz_validation_rejects_duplicate_questions() -> None:
    notes = "A vector stores direction and magnitude."
    question = _grounded_question("How does a vector encode orientation?", "vector", "Direction and magnitude", 1)

    with pytest.raises(AIServiceError, match="duplicate quiz questions"):
        _validate_quiz_questions([question] * 5, notes)


def test_quiz_validation_rejects_source_sentence_copying() -> None:
    notes = "A vector stores direction and magnitude."
    question = _grounded_question("A vector stores direction and magnitude.", "vector", "Direction and magnitude", 1)
    questions = [question]
    for index in range(4):
        questions.append({**question, "question": f"How can vector property {index} be applied?"})

    with pytest.raises(AIServiceError, match="copied a source sentence"):
        _validate_quiz_questions(questions, notes)


def test_quiz_generation_and_submission_use_server_owned_quiz(authenticated_client: TestClient) -> None:
    questions = [{
        "question": "Choose A",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "A",
        "explanation": "A is correct.",
        "concept": "Recall",
        "difficulty": "Beginner",
        "question_type": "Conceptual",
        "concept_evidence": "Vectors store a direction and magnitude.",
        "answer_evidence": "A vector stores direction and magnitude.",
    }]
    with patch("backend.app.api.routes.quizzes.generate_quiz", return_value=questions), patch(
        "backend.app.api.routes.quizzes.create_quiz", return_value={"id": "quiz-1"}
    ) as create_quiz:
        generated = authenticated_client.post(
            "/api/quizzes/generate",
            json={"topic": "Linear algebra", "notes": "Core notes"},
        )
    assert generated.status_code == 200
    create_quiz.assert_called_once_with(TEST_USER.id, TEST_USER.access_token, "Linear algebra", questions, None)

    with patch("backend.app.api.routes.quizzes.submit_quiz", return_value={
        "id": "attempt-1", "score": 1, "question_count": 1,
    }) as submit_quiz:
        submitted = authenticated_client.post(
            "/api/quizzes/submit",
            json={"quiz_id": "quiz-1", "answers": ["A"]},
        )
    assert submitted.status_code == 200
    assert submitted.json()["score"] == 1
    submit_quiz.assert_called_once_with(TEST_USER.id, TEST_USER.access_token, "quiz-1", ["A"])


def test_quiz_repository_computes_score_from_owned_stored_questions(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_database = FakeSupabase()
    monkeypatch.setattr(study_repository, "get_supabase_client", lambda token: fake_database)

    attempt = study_repository.submit_quiz(
        TEST_USER.id,
        TEST_USER.access_token,
        "quiz-owned-by-test-user",
        ["A", "incorrect"],
    )

    assert attempt is not None
    assert attempt["score"] == 1
    assert attempt["question_count"] == 2
    assert fake_database.rpc_calls == [("increment_study_progress_v1", {"p_field": "quiz_attempts"})]
    assert all(("user_id", TEST_USER.id) in query.filters for query in fake_database.queries if query.operation == "select")


def test_other_users_cannot_submit_a_quiz_by_id(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_database = FakeSupabase()
    monkeypatch.setattr(study_repository, "get_supabase_client", lambda token: fake_database)

    result = study_repository.submit_quiz(
        "33333333-3333-4333-8333-333333333333",
        "user-b-token",
        "quiz-owned-by-test-user",
        ["A", "B"],
    )

    assert result is None
    assert len(fake_database.queries) == 1
    assert ("user_id", "33333333-3333-4333-8333-333333333333") in fake_database.queries[0].filters


def test_repository_queries_are_explicitly_scoped_by_user(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_database = FakeSupabase()
    monkeypatch.setattr(study_repository, "get_supabase_client", lambda token: fake_database)

    study_repository.history(TEST_USER.id, TEST_USER.access_token)

    assert fake_database.queries
    assert all(("user_id", TEST_USER.id) in query.filters for query in fake_database.queries)


def test_supabase_persistence_errors_are_not_reported_as_success(authenticated_client: TestClient) -> None:
    with patch("backend.app.api.routes.notes.generate_notes", return_value="# Rich notes\n" + "Learning material. " * 30), patch(
        "backend.app.api.routes.notes.create_note", side_effect=study_repository.PersistenceError("write failed")
    ):
        response = authenticated_client.post(
            "/api/notes/generate",
            json={"topic": "Linear algebra", "difficulty": "Intermediate"},
        )

    assert response.status_code == 503
    assert "detail" in response.json()


def test_gemini_503_fallback_uses_only_configured_gemini_models(monkeypatch: pytest.MonkeyPatch) -> None:
    requested_models: list[str] = []

    class CapacityError(Exception):
        code = 503

    class FakeModels:
        def generate_content(self, **kwargs: Any) -> str:
            requested_models.append(kwargs["model"])
            if kwargs["model"] == "primary-gemini":
                raise CapacityError("temporarily unavailable")
            return "generated"

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(gemini_service.settings, "GEMINI_FALLBACK_MODEL", "fallback-gemini")
    monkeypatch.setattr(gemini_service.time, "sleep", lambda _seconds: None)

    response = gemini_service._generate_content(FakeClient(), model="primary-gemini", contents="prompt")

    assert response == "generated"
    assert requested_models == ["primary-gemini", "primary-gemini", "fallback-gemini"]


def test_gemini_quota_failure_does_not_fall_back(monkeypatch: pytest.MonkeyPatch) -> None:
    requested_models: list[str] = []

    class QuotaError(Exception):
        code = 429

    class FakeModels:
        def generate_content(self, **kwargs: Any) -> None:
            requested_models.append(kwargs["model"])
            raise QuotaError("quota exceeded")

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(gemini_service.time, "sleep", lambda _seconds: None)

    with pytest.raises(QuotaError):
        gemini_service._generate_content(FakeClient(), model="primary-gemini", contents="prompt")

    assert requested_models == ["primary-gemini", "primary-gemini"]
