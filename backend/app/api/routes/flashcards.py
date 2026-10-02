from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import AuthenticatedUser, get_current_user
from ...models.schemas import FlashcardResponse, FlashcardReviewRequest
from ...services.ai.gemini_service import AIServiceError, generate_flashcards
from ...services.study_repository import PersistenceError, create_flashcard_set, history, review_flashcard

router = APIRouter()


@router.post("/generate", response_model=FlashcardResponse)
def generate_cards(payload: dict, user: AuthenticatedUser = Depends(get_current_user)):
    topic = str(payload.get("topic") or "").strip()
    notes = str(payload.get("notes") or "").strip()
    if not topic or not notes:
        raise HTTPException(status_code=400, detail="Topic and notes are required")

    try:
        cards = generate_flashcards(notes, topic)
    except AIServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    try:
        saved = create_flashcard_set(user.id, user.access_token, topic, cards, payload.get("study_session_id"))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return FlashcardResponse(flashcard_set_id=str(saved["id"]), topic=topic, cards=cards)


@router.get("/history")
def get_flashcard_history(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        data = history(user.id, user.access_token)
        return {"sets": data["flashcards"], "reviews": data["flashcard_reviews"]}
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/{flashcard_id}/review")
def update_review_state(
    flashcard_id: str,
    payload: FlashcardReviewRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        result = review_flashcard(
            user.id,
            user.access_token,
            flashcard_id,
            payload.card_index,
            payload.reviewed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    return result
