from __future__ import annotations

from typing import Any, Dict, List

from supabase import create_client
from supabase.lib.client_options import SyncClientOptions

from ..core.config import settings


def get_supabase_client(access_token: str | None = None) -> Any:
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required")

    client = create_client(
        url,
        key,
        SyncClientOptions(auto_refresh_token=False, persist_session=False),
    )
    if access_token:
        client.postgrest.auth(access_token)
    return client


def _session_data(response: Any) -> Dict[str, Any]:
    user = getattr(response, "user", None)
    session = getattr(response, "session", None)
    if user is None:
        raise ValueError("Supabase did not return an authenticated user")
    if session is None:
        return {
            "user_id": str(user.id),
            "email": str(getattr(user, "email", "") or ""),
            "name": (getattr(user, "user_metadata", None) or {}).get("full_name") or "Student",
            "is_authenticated": False,
            "needs_email_confirmation": True,
        }
    return {
        "user_id": str(user.id),
        "email": str(getattr(user, "email", "") or ""),
        "name": (getattr(user, "user_metadata", None) or {}).get("full_name") or "Student",
        "is_authenticated": True,
        "needs_email_confirmation": False,
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_at": session.expires_at,
    }


def sign_in_user(email: str, password: str) -> Dict[str, Any]:
    client = get_supabase_client()
    try:
        response = client.auth.sign_in_with_password({"email": email, "password": password})
        return _session_data(response)
    except Exception as exc:
        raise ValueError("Invalid email or password") from exc


def sign_up_user(email: str, password: str) -> Dict[str, Any]:
    client = get_supabase_client()
    try:
        response = client.auth.sign_up({"email": email, "password": password})
        return _session_data(response)
    except Exception as exc:
        raise ValueError("Unable to create account") from exc


def refresh_user_session(refresh_token: str) -> Dict[str, Any]:
    client = get_supabase_client()
    try:
        response = client.auth.refresh_session(refresh_token)
        return _session_data(response)
    except Exception as exc:
        raise ValueError("Session expired. Please sign in again.") from exc


def verify_access_token(access_token: str) -> Dict[str, str]:
    client = get_supabase_client()
    try:
        response = client.auth.get_user(access_token)
        user = getattr(response, "user", None)
        if user is None:
            raise ValueError("Invalid session")
        return {
            "id": str(user.id),
            "email": str(getattr(user, "email", "") or ""),
            "name": (getattr(user, "user_metadata", None) or {}).get("full_name") or "Student",
        }
    except Exception as exc:
        raise ValueError("Invalid or expired session") from exc


def sign_out_user(access_token: str, refresh_token: str | None = None) -> None:
    client = get_supabase_client(access_token)
    try:
        if refresh_token:
            client.auth.set_session(access_token, refresh_token)
        client.auth.sign_out()
    except Exception as exc:
        raise ValueError("Unable to revoke Supabase session") from exc


def insert_user_record(access_token: str, user_id: str, table_name: str, record: Dict[str, Any]) -> Dict[str, Any]:
    client = get_supabase_client(access_token)
    response = client.table(table_name).insert({**record, "user_id": user_id}).execute()
    data = getattr(response, "data", None) or []
    if not data:
        raise RuntimeError(f"Supabase did not persist the {table_name} record")
    return data[0]


def select_user_records(access_token: str, user_id: str, table_name: str, limit: int = 50) -> List[Dict[str, Any]]:
    client = get_supabase_client(access_token)
    response = (
        client.table(table_name)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return getattr(response, "data", None) or []


def select_user_record(access_token: str, user_id: str, table_name: str, record_id: str) -> Dict[str, Any] | None:
    client = get_supabase_client(access_token)
    response = (
        client.table(table_name)
        .select("*")
        .eq("user_id", user_id)
        .eq("id", record_id)
        .maybe_single()
        .execute()
    )
    return getattr(response, "data", None)


def update_user_record(access_token: str, user_id: str, table_name: str, record_id: str, updates: Dict[str, Any]) -> Dict[str, Any] | None:
    client = get_supabase_client(access_token)
    response = (
        client.table(table_name)
        .update(updates)
        .eq("user_id", user_id)
        .eq("id", record_id)
        .execute()
    )
    data = getattr(response, "data", None) or []
    return data[0] if data else None
