# StudyFlow AI

Learn smarter. Practice better. Remember longer.

StudyFlow AI is a migrated learning workspace that turns topics and study material into structured notes, practice questions, recall tools, and a grounded AI tutor.

## Problem and Solution

Students often switch between notes, quizzes, flashcards, and tutoring tools. StudyFlow AI consolidates that flow in a modern API-backed interface: learn from a topic or source text, practice with targeted questions, reinforce recall with cards, and ask the tutor for explanations grounded in the active study material.

## Technology Stack

- FastAPI for the backend API and service layer
- React + TypeScript + Vite for the frontend experience
- Supabase Auth and PostgreSQL row-level security for user-scoped persistence
- Gemini via the Google Gen AI SDK as the default production provider
- Python and frontend build verification for automated checks

## Workflow

1. Learn: generate structured notes from a topic or source text.
2. Practice: generate concept-based quiz questions and explanations.
3. Recall: generate flashcards to strengthen memory retention.
4. Tutor: ask a follow-up question and receive a notes-grounded explanation.
5. Track: review recent activity and learning momentum from the dashboard and history views.

## Features

- API-backed dashboard and study history tracking
- Notes generation with difficulty selection and source context
- Quiz creation with answer explanations and concept framing
- Flashcard generation for review and deep recall
- AI tutor responses grounded in the active topic and notes
- Persistent sessions, notes, quizzes and attempts, flashcard reviews, tutor conversations, activity, progress, and settings
- Gemini generation; demo responses are disabled unless explicitly enabled in development

## Local Setup

Use Python 3.11 or newer and Node 18+ for the frontend build.

### Backend

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

Create a local environment file from [.env.example](.env.example) and add your values:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
APP_ENV=development
AUTH_MODE=supabase
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=30000
AI_DEMO_MODE=false
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_API_BASE_URL=http://localhost:8000/api
```

The backend loads `.env` in development; production uses platform-managed environment variables. Supabase authentication is required and never falls back to demo users. Use only the Supabase publishable/anon key, never `service_role`. Demo AI responses require `AI_DEMO_MODE=true` and `APP_ENV=development`.

For a clone of the hosted project, apply [20261001021124_remote_schema.sql](supabase/migrations/20261001021124_remote_schema.sql), [20261001021200_studyflow_authenticated_workflow.sql](supabase/migrations/20261001021200_studyflow_authenticated_workflow.sql), then [20261002140000_fix_initial_study_progress_increment.sql](supabase/migrations/20261002140000_fix_initial_study_progress_increment.sql) to a disposable local Supabase database first. The workflow migration preserves legacy IDs/data, archives original flashcard text, parses the confirmed `Q:`/`A:` format into JSONB, and backfills ownership only from a unique exact Auth email match. Unparseable content aborts the migration; unmatched legacy owners remain inaccessible. The progress migration counts the first event and reconciles counters upward from persisted records. All three migrations are applied to the hosted project. [schema.sql](supabase/schema.sql) remains a bootstrap for a separate empty local project, not a substitute for the hosted baseline.

The Learn page accepts PDF uploads up to 20 MB and 200 pages. Text extraction is local to the authenticated API, preserves page markers, and rejects encrypted, malformed, scanned/image-only, or over-limit files. Extracted text is editable before generating notes. There is no OCR path.

For local RLS checks, create two local Supabase Auth users and run [rls_workflow.sql](supabase/tests/rls_workflow.sql) against the local database URL. The script runs in a transaction and rolls back its fixtures. Never set `SUPABASE_LOCAL_DB_URL` to the hosted database.

### Frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

The frontend expects the FastAPI app on `http://localhost:8000` and the API prefix `/api`.

### Backend server

```powershell
Set-Location E:\AI-Study-Assistant
.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload --env-file .env
```

## Production Deployment

- Frontend: deploy the Vite build to a static host such as Vercel or Netlify.
- Backend: deploy the FastAPI service to a Python host such as Render, Railway, or a container-based environment.
- Supabase: apply the base schema and migrations; configure Auth email confirmation and redirect settings.
- Backend secrets: set `APP_ENV=production`, `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_KEY` (publishable/anon key), and `GEMINI_API_KEY` through the host secret manager.
- CORS: set `CORS_ORIGINS` to the exact deployed frontend origins.
- AI: set `AI_PROVIDER=gemini`; the optional model fallback is also Gemini and is used only for primary-model 503 capacity errors. Keep `AI_DEMO_MODE=false` in production.

## Architecture

- [backend/app/main.py](backend/app/main.py) initializes the FastAPI app and route registration.
- [backend/app/api/routes](backend/app/api/routes) defines the notes, quiz, flashcards, tutor, auth, health, and study endpoints.
- [backend/app/services](backend/app/services) centralizes Gemini generation and authenticated Supabase persistence.
- [backend/app/core/config.py](backend/app/core/config.py) contains environment-based settings.
- [frontend/src](frontend/src) contains the React app shell, pages, and API client.
- [supabase/schema.sql](supabase/schema.sql) and [supabase/migrations](supabase/migrations) define the data model and user-owned RLS policies.

## Checks

Run the backend smoke test with:

```powershell
Set-Location E:\AI-Study-Assistant
.venv\Scripts\python.exe -m pytest tests/test_backend_smoke.py -q
```

Run the production frontend build with:

```powershell
Set-Location E:\AI-Study-Assistant\frontend
npm run build
```

## Project Structure

```text
backend/              FastAPI app, routes, services, and config
frontend/             React + TypeScript + Vite app
supabase/schema.sql   Supabase schema and RLS definition
tests/                Automated smoke and regression tests
```

## Known Scope

- Supabase credentials are required for authentication and all user-data endpoints.
- Missing Gemini credentials, invalid keys, quota failures, timeouts, and malformed output return API errors; they do not silently become template content. Quiz generation additionally requires source passage references and rejects unsupported or duplicate output.
- The hosted migrations are applied. Real two-user Supabase Auth/persistence/isolation checks and browser navigation were exercised without AI. Live AI generation tests were quota-limited; local structural tests use deterministic non-live fixtures.
- Quiz answers are checked against exact backend-resolved source passages with conservative token support checks. This is a grounding guard, not a formal proof of semantic entailment; live Gemini quiz verification remains blocked by the provider quota.
- The legacy `profiles` table remains unchanged and unused by the application. It has RLS enabled but no policies, so ordinary client roles cannot access its rows despite legacy table grants.
- The former Streamlit/Ollama app, backups, utilities, and test-only dependencies have been removed. Interview guides from the earlier implementation remain historical documents.
