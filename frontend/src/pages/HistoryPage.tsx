import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { StudyHistory } from '../types';

export function HistoryPage() {
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">Review recent notes, quiz attempts, and learning activity.</p>
        </div>
      </header>

      {error ? <div className="status-box">{error}</div> : null}

      {loading ? <div className="status-box" role="status">Loading history…</div> : null}
      {error ? <div className="status-box error-box" role="alert">{error}</div> : null}

      {!loading && !error && history ? (
        <div className="grid grid-2">
          <div className="card">
            <h3>Saved notes</h3>
            {history.notes.length ? (
              <ul className="list">
                {history.notes.map((note, i) => (
                  <li key={String((note as Record<string, unknown>).id ?? i)}>{String((note as Record<string, unknown>).topic ?? 'Topic')}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No notes yet.</p>
            )}
          </div>

          <div className="card">
            <h3>Recent activity</h3>
            {history.activity.length ? (
              <ul className="list">
                {history.activity.map((item, i) => (
                  <li key={`${String((item as Record<string, unknown>).label ?? 'Activity')}-${i}`}>{String((item as Record<string, unknown>).label ?? 'Activity')}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No recent activity.</p>
            )}
          </div>

          <div className="card">
            <h3>Quiz attempts</h3>
            {history.quizzes.length ? (
              <ul className="list">
                {history.quizzes.map((attempt, index) => (
                  <li key={String(attempt.id ?? index)}>
                    {String(attempt.topic ?? 'Quiz')} · {String(attempt.score ?? 0)} / {String(attempt.question_count ?? 0)}
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No quiz attempts yet.</p>}
          </div>

          <div className="card">
            <h3>Flashcard sets</h3>
            {history.flashcards.length ? (
              <ul className="list">
                {history.flashcards.map((set, index) => (
                  <li key={String(set.id ?? index)}>{String(set.topic ?? 'Flashcards')} · {Array.isArray(set.flashcard_content) ? set.flashcard_content.length : 0} cards</li>
                ))}
              </ul>
            ) : <p className="muted">No flashcard sets yet.</p>}
            <p className="muted">Reviewed {history.flashcard_reviews.filter((review) => review.reviewed === true).length} cards</p>
          </div>

          <div className="card">
            <h3>Learning progress</h3>
            {history.progress.length ? (
              <ul className="list">
                {Object.entries(history.progress[0]).filter(([key]) => key !== 'user_id' && key !== 'updated_at' && key !== 'created_at').map(([key, value]) => (
                  <li key={key}>{key.split('_').join(' ')}: {String(value)}</li>
                ))}
              </ul>
            ) : <p className="muted">Progress totals appear after your first study activity.</p>}
          </div>

          <div className="card">
            <h3>Tutor conversations</h3>
            {history.tutor_messages.length ? (
              <ul className="list">
                {history.tutor_messages.filter((message) => message.role === 'user').map((message, index) => (
                  <li key={String(message.id ?? index)}>{String(message.content ?? 'Study question')}</li>
                ))}
              </ul>
            ) : <p className="muted">No tutor questions yet.</p>}
          </div>
        </div>
      ) : null}
      {!loading && !error && history && !history.notes.length && !history.quizzes.length && !history.flashcards.length && !history.activity.length && !history.tutor_messages.length && (
        <div className="status-box">Your study history will appear here.</div>
      )}
    </div>
  );
}
