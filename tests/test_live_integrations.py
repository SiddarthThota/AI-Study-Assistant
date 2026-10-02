from __future__ import annotations

import os
from typing import Iterator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app.api.dependencies import AuthenticatedUser, get_current_user
from backend.app.core.config import settings
from backend.app.main import app


LIVE_GEMINI = os.getenv("RUN_LIVE_GEMINI_TEST", "").lower() == "true"
LIVE_SUPABASE = os.getenv("RUN_LIVE_SUPABASE_TEST", "").lower() == "true"


@pytest.mark.skipif(not LIVE_GEMINI, reason="Set RUN_LIVE_GEMINI_TEST=true to call the configured Gemini API")
def test_real_gemini_request_through_fastapi_notes_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    if not settings.GEMINI_API_KEY:
        pytest.skip("GEMINI_API_KEY or GEMINI_KEY is missing")

    user = AuthenticatedUser(
        id="11111111-1111-4111-8111-111111111111",
        email="gemini-check@example.test",
        name="Gemini integration",
        access_token="test-access-token",
    )
    original_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_user] = lambda: user
    monkeypatch.setattr(
        "backend.app.api.routes.notes.create_note",
        lambda user_id, token, topic, difficulty, notes, source_type: {
            "id": "test-note-id",
            "study_session_id": "test-session-id",
        },
    )
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/notes/generate",
                json={
                    "topic": "How gradient descent updates model parameters",
                    "difficulty": "Intermediate",
                    "source_text": "A model learns by adjusting parameters to reduce a loss function.",
                },
            )
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["saved"] is True
    assert len(result["notes"]) >= 300
    assert "gradient descent" in result["notes"].lower()


@pytest.mark.skipif(not LIVE_SUPABASE, reason="Set RUN_LIVE_SUPABASE_TEST=true after applying the migration and configuring two QA users")
def test_live_supabase_auth_persistence_and_user_isolation() -> None:
    required = (
        "SUPABASE_QA_EMAIL",
        "SUPABASE_QA_PASSWORD",
        "SUPABASE_QA_EMAIL_B",
        "SUPABASE_QA_PASSWORD_B",
        "SUPABASE_WORKFLOW_SCHEMA_READY",
    )
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        pytest.skip("Missing environment variables: " + ", ".join(missing))
    if os.getenv("SUPABASE_WORKFLOW_SCHEMA_READY", "").lower() != "true":
        pytest.skip("Apply supabase/migrations/20261001021200_studyflow_authenticated_workflow.sql first")

    email_a = os.environ["SUPABASE_QA_EMAIL"]
    password_a = os.environ["SUPABASE_QA_PASSWORD"]
    email_b = os.environ["SUPABASE_QA_EMAIL_B"]
    password_b = os.environ["SUPABASE_QA_PASSWORD_B"]
    topic = "Persistent workflow verification " + os.urandom(5).hex()

    with TestClient(app) as client:
        invalid = client.post("/api/auth/login", json={"email": email_a, "password": "invalid-password-for-test"})
        assert invalid.status_code == 401

        login_a = client.post("/api/auth/login", json={"email": email_a, "password": password_a})
        login_b = client.post("/api/auth/login", json={"email": email_b, "password": password_b})
        assert login_a.status_code == 200, login_a.text
        assert login_b.status_code == 200, login_b.text
        session_a = login_a.json()
        session_b = login_b.json()
        assert session_a["is_authenticated"] is True

        token_a = session_a["access_token"]
        token_b = session_b["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        restored = client.post("/api/auth/session", headers=headers_a)
        assert restored.status_code == 200
        assert restored.json()["user_id"] == session_a["user_id"]

        notes_response = client.post(
            "/api/notes/generate",
            headers=headers_a,
            json={"topic": topic, "difficulty": "Intermediate"},
        )
        assert notes_response.status_code == 200, notes_response.text
        note = notes_response.json()

        quiz_response = client.post(
            "/api/quizzes/generate",
            headers=headers_a,
            json={"topic": topic, "notes": note["notes"], "study_session_id": note["study_session_id"]},
        )
        assert quiz_response.status_code == 200, quiz_response.text
        quiz = quiz_response.json()
        answers = [question["correct_answer"] for question in quiz["questions"]]
        attempt_response = client.post(
            "/api/quizzes/submit",
            headers=headers_a,
            json={"quiz_id": quiz["quiz_id"], "answers": answers},
        )
        assert attempt_response.status_code == 200, attempt_response.text
        assert attempt_response.json()["score"] == len(answers)

        cards_response = client.post(
            "/api/flashcards/generate",
            headers=headers_a,
            json={"topic": topic, "notes": note["notes"], "study_session_id": note["study_session_id"]},
        )
        assert cards_response.status_code == 200, cards_response.text
        cards = cards_response.json()
        review_response = client.post(
            f"/api/flashcards/{cards['flashcard_set_id']}/review",
            headers=headers_a,
            json={"card_index": 0, "reviewed": True},
        )
        assert review_response.status_code == 200, review_response.text

        tutor_response = client.post(
            "/api/tutor/chat",
            headers=headers_a,
            json={"topic": topic, "notes": note["notes"], "question": "Give one concrete example."},
        )
        assert tutor_response.status_code == 200, tutor_response.text

        history_a = client.get("/api/study/history", headers=headers_a)
        history_b = client.get("/api/study/history", headers=headers_b)
        assert history_a.status_code == 200, history_a.text
        assert history_b.status_code == 200, history_b.text
        assert any(record["topic"] == topic for record in history_a.json()["notes"])
        assert any(record["topic"] == topic for record in history_a.json()["quizzes"])
        assert any(record["topic"] == topic for record in history_a.json()["flashcards"])
        assert any(record["topic"] == topic for record in history_a.json()["tutor_conversations"])
        assert all(record["topic"] != topic for record in history_b.json()["notes"])
        assert all(record["topic"] != topic for record in history_b.json()["quizzes"])
        assert all(record["topic"] != topic for record in history_b.json()["flashcards"])
        assert all(record["topic"] != topic for record in history_b.json()["tutor_conversations"])

        refreshed = client.post("/api/auth/refresh", json={"refresh_token": session_a["refresh_token"]})
        assert refreshed.status_code == 200, refreshed.text
        refreshed_headers = {"Authorization": f"Bearer {refreshed.json()['access_token']}"}
        persisted_after_refresh = client.get("/api/study/history", headers=refreshed_headers)
        assert any(record["topic"] == topic for record in persisted_after_refresh.json()["notes"])

        signout = client.post(
            "/api/auth/logout",
            headers=refreshed_headers,
            json={"refresh_token": refreshed.json()["refresh_token"]},
        )
        assert signout.status_code == 200, signout.text
        protected_after_signout = client.get("/api/study/history")
        assert protected_after_signout.status_code == 401
