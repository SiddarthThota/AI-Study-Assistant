from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import AuthenticatedUser, get_current_user
from ...models.schemas import TutorRequest, TutorResponse
from ...services.ai.gemini_service import AIServiceError, generate_tutor_answer
from ...services.study_repository import PersistenceError, get_tutor_messages, save_tutor_exchange

router = APIRouter()


@router.post("/chat", response_model=TutorResponse)
def chat(payload: TutorRequest, user: AuthenticatedUser = Depends(get_current_user)):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    chat_history = [message.model_dump() for message in payload.chat_history]
    if payload.conversation_id:
        try:
            chat_history = get_tutor_messages(user.id, user.access_token, payload.conversation_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except PersistenceError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    try:
        answer = generate_tutor_answer(payload.topic, payload.question, payload.notes, payload.pdf_context, chat_history)
    except AIServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    try:
        conversation = save_tutor_exchange(
            user.id,
            user.access_token,
            payload.topic or "Current topic",
            payload.question,
            answer,
            payload.conversation_id,
            payload.study_session_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return TutorResponse(
        conversation_id=conversation["id"],
        answer=answer,
        follow_up="Can you explain this with a simple example?",
        source_summary="Grounded in the active study notes and source context.",
    )
