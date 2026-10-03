import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { StudyHistory } from '../types';
import { useStudyContext } from '../contexts/StudyContext';

export function HistoryPage() {
  const navigate = useNavigate();
  const { setActiveSession } = useStudyContext();
  const [history, setHistory] = useState<StudyHistory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<StudyHistory>('/study/history')
      .then(setHistory)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleResumePack = async (session: Record<string, unknown>) => {
    try {
      await setActiveSession(String(session.id));
      navigate('/');
    } catch {
      setError('Unable to resume study pack');
    }
  };

  const renderStudyPacks = () => {
    if (!history) return null;

    const { sessions, notes, quizzes, flashcards, tutor_conversations } = history;

    if (!sessions || sessions.length === 0) {
      return (
        <div className="card" style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>📚</div>
          <h2 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>No Study Packs Yet</h2>
          <p className="muted" style={{ margin: '0 0 24px 0' }}>Your learning history will appear here once you create a study pack.</p>
          <button className="primary-button" onClick={() => navigate('/learn')} style={{ padding: '12px 32px' }}>
            Go to Learn
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {sessions.map((session) => {
          const sessionId = String(session.id);

          // Gather related items
          const packNotes = notes.find(n => String(n.study_session_id) === sessionId);
          const packQuizzes = quizzes.filter(q => String(q.study_session_id) === sessionId);
          const packFlashcards = flashcards.filter(f => String(f.study_session_id) === sessionId);
          const packTutor = tutor_conversations.filter(t => String(t.study_session_id) === sessionId);

          const date = new Date(String(session.created_at)).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
          });

          return (
            <div key={sessionId} className="card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Created {date}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>{String(session.topic)}</h3>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => handleResumePack(session)}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  Set as Active
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📄</span> Notes Generated
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {packNotes ? (
                      <span style={{ color: '#10b981', fontWeight: 500 }}>✓ Available</span>
                    ) : 'Not generated'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📝</span> Quizzes Attempted
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {packQuizzes.length > 0 ? (
                      <span style={{ fontWeight: 500, color: '#475569' }}>
                        {packQuizzes.length} attempt{packQuizzes.length !== 1 ? 's' : ''}
                        {packQuizzes.length > 0 && ` (Best: ${Math.max(...packQuizzes.map(q => Number(q.score) || 0))})`}
                      </span>
                    ) : 'No attempts'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🗂️</span> Flashcard Sets
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {packFlashcards.length > 0 ? (
                      <span style={{ fontWeight: 500, color: '#475569' }}>
                        {packFlashcards.length} set{packFlashcards.length !== 1 ? 's' : ''} generated
                      </span>
                    ) : 'Not generated'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💬</span> Tutor Sessions
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {packTutor.length > 0 ? (
                      <span style={{ fontWeight: 500, color: '#475569' }}>
                        {packTutor.length} conversation{packTutor.length !== 1 ? 's' : ''}
                      </span>
                    ) : 'No questions asked'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Study History</h1>
          <p className="page-subtitle">Review your past study packs and jump back into your learning context.</p>
        </div>
      </header>

      {error ? <div className="status-box error-box">{error}</div> : null}

      {loading ? (
        <div className="status-box" role="status">Loading history…</div>
      ) : !error && history ? (
        <>
          {history.progress && history.progress.length > 0 && (
            <div className="card" style={{ marginBottom: '32px', background: '#0f172a', color: 'white', border: 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>{String(history.progress[0].notes_created || 0)}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>{String(history.progress[0].quiz_attempts || 0)}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quizzes</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>{history.flashcard_reviews?.length || 0}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Card Reviews</div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>{String(history.progress[0].tutor_questions || 0)}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Questions</div>
                </div>
              </div>
            </div>
          )}

          {renderStudyPacks()}
        </>
      ) : null}
    </div>
  );
}
