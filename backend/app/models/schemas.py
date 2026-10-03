from __future__ import annotations

from typing import Any, List, Literal

from pydantic import BaseModel, Field


class UserSession(BaseModel):
    user_id: str
    email: str
    name: str = "Student"
    is_authenticated: bool = False
    needs_email_confirmation: bool = False
    access_token: str | None = None
    refresh_token: str | None = None
    expires_at: int | None = None


class AuthCredentials(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)


class SignUpCredentials(AuthCredentials):
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class SignOutRequest(BaseModel):
    refresh_token: str | None = None


class NotesRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    difficulty: Literal["Beginner", "Intermediate", "Advanced"] = "Intermediate"
    source_text: str = ""
    source_type: str = "topic"


class NotesResponse(BaseModel):
    id: str
    study_session_id: str
    topic: str
    difficulty: str
    notes: str
    source_type: str = "topic"
    saved: bool = False


class PDFExtractionResponse(BaseModel):
    file_name: str
    page_count: int
    character_count: int
    source_text: str


class Question(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    concept: str
    difficulty: str
    question_type: str
    concept_evidence: str
    answer_evidence: str


class QuizResponse(BaseModel):
    quiz_id: str
    questions: List[Question]
    topic: str
    score_target: int = 5


class QuizAttemptRequest(BaseModel):
    quiz_id: str = Field(..., min_length=1)
    answers: List[str]


class QuizAttemptResponse(BaseModel):
    attempt_id: str
    score: int
    question_count: int


class Flashcard(BaseModel):
    question: str
    answer: str
    type: str = "Concept"
    difficulty: str = "Intermediate"


class FlashcardResponse(BaseModel):
    flashcard_set_id: str
    topic: str
    cards: List[Flashcard]


class FlashcardReviewRequest(BaseModel):
    card_index: int = Field(..., ge=0)
    reviewed: bool = True


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class TutorRequest(BaseModel):
    topic: str = ""
    question: str = Field(..., min_length=1)
    notes: str = ""
    pdf_context: str = ""
    conversation_id: str | None = None
    study_session_id: str | None = None
    chat_history: List[TutorMessage] = []


class TutorResponse(BaseModel):
    conversation_id: str
    answer: str
    follow_up: str = ""
    source_summary: str = ""


class DashboardSummary(BaseModel):
    topic: str
    progress: int
    next_action: str
    recent_activity: List[str]
    weak_concepts: List[str]
    has_active_session: bool = False
    active_topic: str | None = None
    active_session_id: str | None = None
    study_goal: str = ""


class StudySettingsRequest(BaseModel):
    study_goal: str = Field(..., min_length=1, max_length=500)
