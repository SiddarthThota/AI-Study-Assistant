export type UserSession = {
  user_id: string;
  email: string;
  name: string;
  is_authenticated: boolean;
  needs_email_confirmation?: boolean;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
};

export type DashboardSummary = {
  topic: string;
  progress: number;
  next_action: string;
  recent_activity: string[];
  weak_concepts: string[];
  has_active_session: boolean;
  active_topic: string | null;
  active_session_id: string | null;
  study_goal: string;
};

export type NotesResponse = {
  id: string;
  study_session_id: string;
  topic: string;
  difficulty: string;
  notes: string;
  source_type: string;
  saved: boolean;
};

export type Question = {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  concept: string;
  difficulty: string;
  question_type: string;
  concept_evidence: string;
  answer_evidence: string;
};

export type QuizResponse = {
  quiz_id: string;
  questions: Question[];
  topic: string;
  score_target: number;
};

export type Flashcard = {
  question: string;
  answer: string;
  type?: string;
  difficulty?: string;
};

export type FlashcardResponse = {
  flashcard_set_id: string;
  topic: string;
  cards: Flashcard[];
};

export type TutorResponse = {
  conversation_id: string;
  answer: string;
  follow_up: string;
  source_summary: string;
};

export type StudyHistory = {
  notes: Array<Record<string, unknown>>;
  quizzes: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
  flashcards: Array<Record<string, unknown>>;
  flashcard_reviews: Array<Record<string, unknown>>;
  tutor_conversations: Array<Record<string, unknown>>;
  tutor_messages: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  progress: Array<Record<string, unknown>>;
};
