from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import auth, flashcards, health, notes, quizzes, study, tutor
from .core.config import settings, validate_runtime_settings

@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_runtime_settings()
    yield


app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(study.router, prefix="/api/study")
app.include_router(notes.router, prefix="/api/notes")
app.include_router(quizzes.router, prefix="/api/quizzes")
app.include_router(flashcards.router, prefix="/api/flashcards")
app.include_router(tutor.router, prefix="/api/tutor")


@app.get("/")
def root():
    return {"service": settings.APP_NAME, "status": "running"}
