import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function SettingsPage() {
  const [email] = useState(sessionStorage.getItem('studyflow-user-email') ?? '');
  const [studyGoal, setStudyGoal] = useState('Master difficult concepts with daily practice.');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ study_goal: string }>('/study/settings')
      .then((settings) => setStudyGoal(settings.study_goal))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await api.put<{ study_goal: string }>('/study/settings', { study_goal: studyGoal });
      setStudyGoal(result.study_goal);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Keep your account, study goals, and learning preferences aligned with your workflow.</p>
        </div>
      </header>

      <div className="card settings-card">
        <form className="form-grid" onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="settings-email">Account email</label>
            <input id="settings-email" type="email" value={email} readOnly />
          </div>

          <div className="field">
            <label htmlFor="study-goal">Study goal</label>
            <textarea id="study-goal" value={studyGoal} onChange={(e) => setStudyGoal(e.target.value)} />
          </div>

          <button className="primary-button" type="submit" disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {error ? <div className="status-box error-box">{error}</div> : null}
          {saved ? <div className="status-box">Settings saved.</div> : null}
          {loading ? <div className="muted">Loading settings…</div> : null}
        </form>
      </div>
    </div>
  );
}
