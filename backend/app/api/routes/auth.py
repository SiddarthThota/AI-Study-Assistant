from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import AuthenticatedUser, get_current_user
from ...models.schemas import AuthCredentials, RefreshRequest, SignOutRequest, SignUpCredentials, UserSession
from ...services.supabase_service import refresh_user_session, sign_in_user, sign_out_user, sign_up_user

router = APIRouter()


@router.post("/login", response_model=UserSession)
def login_user(payload: AuthCredentials):
    try:
        data = sign_in_user(payload.email, payload.password)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return UserSession(**data)


@router.post("/signup", response_model=UserSession)
def signup_user(payload: SignUpCredentials):
    try:
        data = sign_up_user(payload.email, payload.password, payload.first_name, payload.last_name)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserSession(**data)


@router.post("/refresh", response_model=UserSession)
def refresh_session(payload: RefreshRequest):
    try:
        data = refresh_user_session(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return UserSession(**data)


@router.post("/session")
def restore_session(user: AuthenticatedUser = Depends(get_current_user)):
    return {"user_id": user.id, "email": user.email, "name": user.name, "is_authenticated": True}


@router.post("/logout")
def logout_user(
    payload: SignOutRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        sign_out_user(user.access_token, payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"success": True}
