from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import AuthenticatedUser, get_current_user
from pydantic import BaseModel
from ...models.schemas import StudySettingsRequest
from ...services.study_repository import (
    PersistenceError, dashboard, get_study_settings, history,
    save_study_settings, get_active_session, set_active_session
)

router = APIRouter()


@router.get("/dashboard")
def dashboard_summary(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return dashboard(user.id, user.access_token)
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/active")
def read_active_session(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return get_active_session(user.id, user.access_token)
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

class ActiveSessionRequest(BaseModel):
    study_session_id: str

@router.post("/active")
def update_active_session(payload: ActiveSessionRequest, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        set_active_session(user.id, user.access_token, payload.study_session_id)
        return {"success": True}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/history")
def study_history(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return history(user.id, user.access_token)
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/settings")
def read_study_settings(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return get_study_settings(user.id, user.access_token)
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.put("/settings")
def update_study_settings(
    payload: StudySettingsRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        return save_study_settings(user.id, user.access_token, payload.study_goal.strip())
    except PersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
