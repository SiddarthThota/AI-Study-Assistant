import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

export type ActiveStudySession = {
  study_session_id: string;
  topic: string;
  source_type: string;
  notes: string | null;
  quiz: Record<string, unknown> | null;
  flashcards: Record<string, unknown> | null;
  tutor_conversation_id: string | null;
};

type StudyContextType = {
  activeSession: ActiveStudySession | null;
  loading: boolean;
  refreshActiveSession: () => Promise<void>;
  setActiveSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;
};

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSessionState] = useState<ActiveStudySession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshActiveSession = async () => {
    setLoading(true);
    try {
      const session = await api.get<ActiveStudySession | null>('/study/active');
      setActiveSessionState(session);
    } catch (err) {
      console.error('Failed to load active study session', err);
      setActiveSessionState(null);
    } finally {
      setLoading(false);
    }
  };

  const setActiveSession = async (sessionId: string) => {
    await api.post('/study/active', { study_session_id: sessionId });
    await refreshActiveSession();
  };

  const clearSession = () => {
    setActiveSessionState(null);
  };

  useEffect(() => {
    const token = sessionStorage.getItem('studyflow-access-token');
    if (token) {
      refreshActiveSession();
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <StudyContext.Provider value={{ activeSession, loading, refreshActiveSession, setActiveSession, clearSession }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudyContext() {
  const context = useContext(StudyContext);
  if (context === undefined) {
    throw new Error('useStudyContext must be used within a StudyProvider');
  }
  return context;
}
