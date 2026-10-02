import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
if APP_ENV == "development":
    load_dotenv(REPOSITORY_ROOT / ".env", override=False)


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is not None and str(value).strip() != "":
        return str(value).strip()
    return default


class Settings:
    APP_NAME = "StudyFlow AI"
    TAGLINE = "Learn smarter. Practice better. Remember longer."
    API_PREFIX = "/api"
    GEMINI_API_KEY = _env("GEMINI_API_KEY") or _env("GEMINI_KEY")
    GEMINI_MODEL = _env("GEMINI_MODEL", "gemini-3.8-flash")
    GEMINI_FALLBACK_MODEL = _env("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
    GEMINI_TIMEOUT_MS = int(_env("GEMINI_TIMEOUT_MS", "30000"))
    AI_DEMO_MODE = _env("AI_DEMO_MODE", "false").strip().lower() == "true"
    AI_PROVIDER = _env("AI_PROVIDER", "gemini").strip().lower()
    AUTH_MODE = _env("AUTH_MODE", "supabase").strip().lower()
    APP_ENV = APP_ENV
    SUPABASE_URL = _env("SUPABASE_URL")
    SUPABASE_KEY = _env("SUPABASE_KEY")
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    if _env("CORS_ORIGINS"):
        CORS_ORIGINS = [origin.strip() for origin in _env("CORS_ORIGINS", "").split(",") if origin.strip()]


settings = Settings()


def validate_runtime_settings() -> None:
    if settings.AUTH_MODE != "supabase":
        raise RuntimeError("Only Supabase authentication is supported by this production API")
    if settings.APP_ENV == "production":
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required")
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is required in production")
        if settings.AI_PROVIDER != "gemini":
            raise RuntimeError("AI_PROVIDER must be gemini in production")
        if settings.AI_DEMO_MODE:
            raise RuntimeError("AI_DEMO_MODE must be false in production")
