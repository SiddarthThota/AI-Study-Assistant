from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import AuthenticatedUser, get_current_user
from ...models.schemas import QuizAttemptRequest, QuizAttemptResponse, QuizResponse
from ...services.ai.gemini_service import AIServiceError, generate_quiz
from ...services.study_repository import PersistenceError, create_quiz, submit_quiz

router = APIRouter()


@router.post("/generate", response_model=QuizResponse)
def generate_quiz_for_topic(payload: dict, user: AuthenticatedUser = Depends(get_current_user)):
    topic = str(payload.get("topic") or "").strip()
    notes = str(payload.get("notes") or "").strip()
    if not topic or not notes:
        raise HTTPException(status_code=400, detail="Topic and notes are required")

    try:
        questions = generate_quiz(notes, topic)
    except AIServiceError as exc:
        with open("e:/AI-Study-Assistant/backend_error.txt", "w") as f:
            f.write(f"AIServiceError: {str(exc)}")
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        with open("e:/AI-Study-Assistant/backend_error.txt", "w") as f:
            f.write(f"Other Exception: {str(exc)}")
        raise
    if len(questions) == 0:
        raise HTTPException(status_code=500, detail="Unable to generate a valid quiz")

    try:
        saved = create_quiz(user.id, user.access_token, topic, questions, payload.get("study_session_id"))
    except ValueError as exc:
        with open("e:/AI-Study-Assistant/backend_error.txt", "a") as f:
            f.write(f"\nValueError in create_quiz: {str(exc)}")
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PersistenceError as exc:
        with open("e:/AI-Study-Assistant/backend_error.txt", "a") as f:
            f.write(f"\nPersistenceError in create_quiz: {str(exc)}")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return QuizResponse(quiz_id=saved["id"], questions=questions, topic=topic, score_target=len(questions))


@router.post("/submit")
def submit_quiz_attempt(
    payload: QuizAttemptRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> QuizAttemptResponse:
    try:
        attempt = submit_quiz(user.id, user.access_token, payload.quiz_id, payload.answers)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if attempt is None:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return QuizAttemptResponse(
        attempt_id=attempt["id"],
        score=attempt["score"],
        question_count=attempt["question_count"],
    )
