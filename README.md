# StudyFlow AI

> **Learn smarter. Practice better. Remember longer.**

StudyFlow AI is an AI-powered student learning workspace that transforms study topics or documents into structured notes, concept-based quizzes, interactive flashcards, and a personalized AI tutor—all organized into persistent, trackable study packs.

---

## 🚀 Live Demo & Links

- **Live Frontend (Render)**: [https://studyflow-ai-frontend-tekk.onrender.com](https://studyflow-ai-frontend-tekk.onrender.com)
- **Live Backend API**: [https://studyflow-ai-hc6o.onrender.com](https://studyflow-ai-hc6o.onrender.com)
- **Backend Health Check**: [https://studyflow-ai-hc6o.onrender.com/api/health](https://studyflow-ai-hc6o.onrender.com/api/health)
- **GitHub Repository**: [https://github.com/SiddarthThota/AI-Study-Assistant](https://github.com/SiddarthThota/AI-Study-Assistant)

---

## 📖 Project Overview

Modern students frequently jump between disjointed tools to read notes, test their knowledge, review flashcards, and ask questions. StudyFlow AI consolidates this process into a seamless, API-backed web application. By leveraging Google Gemini and a robust React + FastAPI architecture, it analyzes topics or source texts, generates grounded educational content, and orchestrates an end-to-end learning cycle.

## 🔄 Core Learning Workflow

StudyFlow AI revolves around the concept of a **Study Pack**—a shared context that persists across the entire application:

`Student` ➔ `Learn (Create Study Pack)` ➔ `Practice (Quiz)` ➔ `Recall (Flashcards)` ➔ `AI Tutor` ➔ `Dashboard & History`

Every quiz question, flashcard, and tutor explanation is strongly grounded in the active study pack, ensuring accurate and relevant learning material.

## ✨ Key Features

### 📚 Learn
- Create comprehensive study material from a high-level topic.
- Upload PDF documents and accurately extract text.
- Generate structured AI study notes encompassing objectives, core concepts, step-by-step explanations, examples, and common misconceptions.

### 🎯 Practice
- Generate concept-based Multiple Choice Questions (MCQs) strictly grounded in the active study material.
- Features four distinct answer options per question with detailed explanations.
- Real-time score tracking and source-evidence-aware validation.

### 🧠 Recall
- Interactive flashcards designed to strengthen memory retention.
- Reveal answers and self-grade using spaced-repetition controls (Again / Hard / Good / Easy).
- Visual tracking of review progress.

### 💬 AI Tutor
- Conversational chatbot deeply integrated with the active study pack context.
- Allows students to ask conceptual doubts, request additional examples, or clarify complex topics.
- Persistent, topic-specific conversation history.

### 📊 Dashboard & History
- **Dashboard**: View the active study session, track recent learning momentum, and get recommendations for the next action based on study goals.
- **History**: Access previous study packs, review past quizzes, flashcard sessions, and tutor conversations. Restore older study packs to active status instantly.

### ⚙️ Settings
- Customize study goals and personal learning preferences.
- Tailor the dashboard focus to align with specific academic targets.

---

## 🏗 System Architecture

```text
       [ React + TypeScript + Vite ]
                   |
                   | (REST API via HTTP/JSON)
                   v
          [ FastAPI Backend ]
           /               \
          /                 \
         v                   v
   [ Supabase ]        [ Google Gemini ]
 (Auth + PostgreSQL)   (Generative AI SDK)
```

- **Frontend**: A responsive Single Page Application (SPA) providing a smooth, state-driven user experience.
- **Backend**: A high-performance Python API handling business logic, AI orchestration, validation, and data transformations.
- **Database/Auth**: A managed PostgreSQL database with Row-Level Security and JWT-based authentication.
- **AI Integration**: Orchestrates prompts and strictly validates model outputs to prevent hallucinations and enforce grounding.

## 💻 Technology Stack

**Frontend:**
- React (Hooks, Context API)
- TypeScript
- Vite (Build Tool & Dev Server)

**Backend:**
- Python 3.11+
- FastAPI (REST API Framework)
- Uvicorn (ASGI Server)
- Pydantic (Schema Validation)
- PyPDF (Document processing)

**Database & Authentication:**
- Supabase Auth (JWT)
- PostgreSQL
- Row-Level Security (RLS)

**Artificial Intelligence:**
- Google Gemini (gemini-3.5-flash-lite / gemini-1.5-flash)
- Google Gen AI SDK

**Testing & Quality Assurance:**
- `pytest` (Backend Smoke & Integration Tests)
- `ESLint` (Frontend Linting)
- TypeScript Type Checking
- Vite Production Build Verification
- Python Compilation Checks (`compileall`)
- Dependency Health (`pip check`)
- Supabase Local DB & RLS testing

**Deployment:**
- GitHub (Version Control)
- Render (Cloud Application Hosting)

---

## 📁 Project Structure

```text
AI-Study-Assistant/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routes and dependencies
│   │   ├── core/         # Configuration and environment setup
│   │   ├── models/       # Pydantic schemas
│   │   └── services/     # Business logic (AI, DB, PDF processing)
│   ├── tests/            # Pytest test suites
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React context providers
│   │   ├── lib/          # API client and utilities
│   │   ├── pages/        # Application routes/views
│   │   └── types.ts      # TypeScript interfaces
│   ├── package.json      # Node.js dependencies
│   └── vite.config.ts    # Vite configuration
├── supabase/
│   └── migrations/       # Database schemas and RLS policies
├── .env.example          # Environment variable template
└── README.md             # Project documentation
```

---

## 🔒 Security

Security is deeply integrated into the application architecture:
- **Authentication**: JWT-based session management handled by Supabase Auth.
- **Authorization**: Row-Level Security (RLS) in PostgreSQL ensures users can only read, write, or modify their own data.
- **Isolation**: Each study pack, quiz attempt, and tutor conversation is strictly scoped to the authenticated `user_id`.
- **Secret Management**: Environment variables are utilized across frontend and backend services. API keys (like `GEMINI_API_KEY` and `SUPABASE_KEY`) are never committed to version control.

---

## 🛠 Local Development Setup

Follow these steps to run StudyFlow AI locally:

**1. Clone the repository**
```bash
git clone https://github.com/SiddarthThota/AI-Study-Assistant.git
cd AI-Study-Assistant
```

**2. Configure Environment Variables**
Create a `.env` file in the root directory (refer to [Environment Variables](#-environment-variables) below).

**3. Setup Backend**
```bash
# Create and activate a virtual environment (Windows)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt

# Start the FastAPI server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
*The backend API will be available at `http://localhost:8000/api/health`*

**4. Setup Frontend**
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*The frontend application will be available at `http://localhost:5173`*

---

## 🔐 Environment Variables

Create a `.env` file in the root directory. **Do not use real keys in public repositories.**

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
AI_PROVIDER=gemini
AI_DEMO_MODE=false
GEMINI_MODEL=gemini-3.5-flash-lite
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 🧪 Testing & Validation

The project maintains high code quality through automated verification checks. To validate the repository locally, run:

```bash
# Backend Tests
pytest

# Frontend Quality
cd frontend
npm run lint
npm run typecheck
npm run build

# Python Health
python -m compileall backend
pip check

# Database Tests (Requires Docker)
npx supabase test db

# Git Sanity
git diff --check
```

---

## 🚀 Deployment

The application is deployed on **Render** utilizing a continuous deployment workflow:

`Local Development` ➔ `Feature Testing` ➔ `Git Commit` ➔ `Push to Main` ➔ `GitHub` ➔ `Render Auto-Deploy` ➔ `Production Smoke Test`

- **Frontend Hosting**: Render Static Site (dist build)
- **Backend Hosting**: Render Web Service (Uvicorn + FastAPI)

---

## ✅ Current Release Status

- [x] JWT Authentication & User Sessions
- [x] PDF Upload & Text Extraction
- [x] AI-Generated Study Notes
- [x] Source-Grounded Multiple Choice Quizzes
- [x] Spaced Repetition Flashcards
- [x] Context-Aware AI Chat Tutor
- [x] Database Persistence & History
- [x] Settings & Study Goals Configuration

## 🔮 Future Enhancements

*Future work planned for subsequent releases:*
- Voice conversations with the AI Tutor.
- Advanced spaced repetition algorithms for flashcards.
- Automated exam planning and scheduling.
- Study streaks and gamification.
- Richer analytics and progress dashboards.
- Support for additional AI providers (OpenAI, Anthropic).

---

## 👨‍💻 Author

**Siddarth Thota**<br>
*StudyFlow AI - AI-powered student learning workspace*<br>
[GitHub Profile](https://github.com/SiddarthThota)
