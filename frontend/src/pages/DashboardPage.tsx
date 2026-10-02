import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DashboardSummary } from '../types';

export function DashboardPage() {
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Track your current topic, next action, and learning momentum.</p>
        </div>
      </header>

      {error ? <div className="status-box">{error}</div> : null}

      {loading ? (
        <div className="status-box" role="status">Loading dashboard…</div>
      ) : error ? null : !summary ? (
        <div className="status-box">Dashboard data is unavailable.</div>
      ) : (
        <>
          <div className="grid grid-3">
            <div className="card">
              <span className="eyebrow">Current topic</span>
              <div className="metric">{summary.topic}</div>
              <div className="muted">{summary.next_action}</div>
            </div>
            <div className="card">
              <span className="eyebrow">Progress</span>
              <div className="metric">{summary.progress}%</div>
              <div className="muted">Keep building on your recent work.</div>
            </div>
            <div className="card">
              <span className="eyebrow">Next step</span>
              <div className="metric">Review</div>
              <div className="muted">{summary.next_action}</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginTop: '20px' }}>
            <div className="card">
              <h3>Recent activity</h3>
              <ul className="list">
                {(summary.recent_activity ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3>Weak concepts</h3>
              <ul className="list">
                {(summary.weak_concepts ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
