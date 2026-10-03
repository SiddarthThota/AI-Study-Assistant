import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { DashboardSummary } from '../types';

export function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardSummary>('/study/dashboard')
      .then(setSummary)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const firstName = sessionStorage.getItem('studyflow-user-name')?.split(' ')[0] || 'Student';

  return (
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Welcome back, {firstName}</h1>
          {summary?.study_goal && (
            <p className="page-subtitle" style={{ color: '#4f46e5', fontWeight: 500, marginTop: '4px' }}>
              Your focus: {summary.study_goal}
            </p>
          )}
        </div>
      </header>

      {error ? <div className="status-box error-box">{error}</div> : null}

      {loading ? (
        <div className="status-box" role="status">Loading dashboard…</div>
      ) : error ? null : !summary ? (
        <div className="status-box">Dashboard data is unavailable.</div>
      ) : (
        <>
          {summary.has_active_session ? (
            <div className="card" style={{ padding: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <span className="eyebrow" style={{ color: '#64748b' }}>Current Study Session</span>
                  <h2 style={{ margin: '8px 0', fontSize: '24px', color: '#0f172a' }}>{summary.active_topic}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                    <div style={{ background: '#e2e8f0', height: '8px', borderRadius: '4px', width: '200px', overflow: 'hidden' }}>
                      <div style={{ background: '#4f46e5', height: '100%', width: `${summary.progress}%` }}></div>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>{summary.progress}%</span>
                  </div>
                </div>
                <div>
                  <button className="primary-button" onClick={() => navigate('/learn')} style={{ padding: '12px 24px' }}>
                    Continue learning
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', marginBottom: '32px' }}>
              <h2 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>Ready to start learning?</h2>
              <p className="muted" style={{ margin: '0 0 24px 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                Turn your topics and documents into structured study packs with notes, quizzes, and flashcards.
              </p>
              <button className="primary-button" onClick={() => navigate('/learn')} style={{ padding: '12px 32px' }}>
                Create study pack
              </button>
            </div>
          )}

          <div className="grid grid-3" style={{ marginBottom: '24px' }}>
            <div className="card">
              <span className="eyebrow">Recent study</span>
              <div className="metric" style={{ fontSize: '18px', marginTop: '8px' }}>{summary.topic}</div>
            </div>
            <div className="card">
              <span className="eyebrow">Next recommended action</span>
              <div className="metric" style={{ fontSize: '18px', marginTop: '8px' }}>{summary.next_action}</div>
            </div>
            <div className="card">
              <span className="eyebrow">Today's goal</span>
              <div className="metric" style={{ fontSize: '18px', marginTop: '8px' }}>Maintain consistency</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginTop: '20px' }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Recent activity</h3>
              <ul className="list">
                {(summary.recent_activity ?? []).map((item, i) => (
                  <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Weak concepts</h3>
              <ul className="list">
                {(summary.weak_concepts ?? []).map((item, i) => (
                  <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
