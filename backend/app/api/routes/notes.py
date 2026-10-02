from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..dependencies import AuthenticatedUser, get_current_user
from ...models.schemas import NotesRequest, NotesResponse, PDFExtractionResponse
from ...services.ai.gemini_service import AIServiceError, generate_notes
from ...services.pdf.extractor import PDFExtractionError, extract_pdf_text
from ...services.study_repository import PersistenceError, create_note, history

router = APIRouter()


@router.post("/extract-pdf", response_model=PDFExtractionResponse)
async def extract_pdf(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Upload a PDF file")

    try:
        payload = await file.read(20 * 1024 * 1024 + 1)
        source_text, page_count = extract_pdf_text(payload)
    except PDFExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await file.close()

    return PDFExtractionResponse(
        file_name=file.filename,
        page_count=page_count,
        character_count=len(source_text),
        source_text=source_text,
    )


@router.post("/generate", response_model=NotesResponse)
def generate_note(payload: NotesRequest, user: AuthenticatedUser = Depends(get_current_user)):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    try:
        notes = generate_notes(topic, payload.difficulty, payload.source_text)
        item = create_note(user.id, user.access_token, topic, payload.difficulty, notes, payload.source_type)
    except AIServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail="Study notes could not be generated") from exc
    return NotesResponse(
        id=str(item["id"]),
        study_session_id=item["study_session_id"],
        topic=topic,
        difficulty=payload.difficulty,
        notes=notes,
        source_type=payload.source_type,
        saved=True,
    )


@router.get("/history")
def get_notes_history(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"notes": history(user.id, user.access_token)["notes"]}
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
