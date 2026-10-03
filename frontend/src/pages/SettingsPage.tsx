import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function SettingsPage() {
  const [email] = useState(sessionStorage.getItem('studyflow-user-email') ?? '');
  const [name] = useState(sessionStorage.getItem('studyflow-user-name') ?? 'Student');
  const [studyGoal, setStudyGoal] = useState('Maintain daily practice consistency.');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const goalOptions = [
    "Master difficult concepts with daily practice.",
    "Prepare for upcoming exams.",
    "Maintain daily practice consistency.",
    "Learn a new topic every week.",
  ];

  useEffect(() => {
    api.get<{ study_goal: string }>('/study/settings')
      .then((settings) => setStudyGoal(settings.study_goal || 'Maintain daily practice consistency.'))
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
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Keep your account, study goals, and learning preferences aligned with your workflow.</p>
        </div>
      </header>

      <div className="card settings-card" style={{ padding: '32px' }}>
        <form className="form-grid" onSubmit={handleSave}>

          <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', fontSize: '18px' }}>Account Information</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="settings-name">Name</label>
              <input id="settings-name" type="text" value={name} readOnly style={{ background: '#f8fafc', color: '#64748b' }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="settings-email">Email</label>
              <input id="settings-email" type="email" value={email} readOnly style={{ background: '#f8fafc', color: '#64748b' }} />
            </div>
          </div>

          <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', fontSize: '18px' }}>Learning Preferences</h3>

          <div className="field">
            <label htmlFor="study-goal">Primary Study Goal</label>
            <p className="muted" style={{ marginBottom: '12px' }}>This goal will be displayed on your dashboard to help keep you focused.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {goalOptions.map(option => (
                <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', border: '1px solid', borderColor: studyGoal === option ? '#4f46e5' : '#e2e8f0', borderRadius: '8px', background: studyGoal === option ? '#eef2ff' : 'white' }}>
                  <input
                    type="radio"
                    name="study-goal-preset"
                    value={option}
                    checked={studyGoal === option}
                    onChange={(e) => setStudyGoal(e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <span style={{ color: studyGoal === option ? '#4338ca' : '#334155', fontWeight: studyGoal === option ? 500 : 400 }}>{option}</span>
                </label>
              ))}
            </div>

            <label htmlFor="study-goal-custom" style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', display: 'block' }}>Or write your own custom goal:</label>
            <input
              id="study-goal-custom"
              type="text"
              value={studyGoal}
              onChange={(e) => setStudyGoal(e.target.value)}
              placeholder="E.g., Pass the upcoming biology final with an A"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
            <button className="primary-button" type="submit" disabled={loading || saving} style={{ padding: '12px 24px' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span style={{ color: '#16a34a', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>✓ Saved successfully</span>}
          </div>

          {error && <div className="status-box error-box" style={{ marginTop: '16px' }}>{error}</div>}
          {loading && <div className="muted" style={{ marginTop: '16px' }}>Loading settings…</div>}
        </form>
      </div>
    </div>
  );
}
