import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getAccessToken, setAuthSession } from '../lib/api';
import type { UserSession } from '../types';

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    api.post('/auth/session', {}).then(() => navigate('/', { replace: true })).catch(() => undefined);
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      if (!email.includes('@') || password.length < 6) {
        throw new Error('Use a valid email and a password with at least 6 characters.');
      }

      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
      const session = await api.post<UserSession>(endpoint, { email: email.trim(), password });
      if (!session.is_authenticated) {
        setError(session.needs_email_confirmation
          ? 'Check your email to confirm your account, then log in.'
          : 'Supabase did not create an active session.');
        return;
      }

      setAuthSession(session);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div className="card auth-card">
        <div className="auth-header">
          <div className="brand-mark auth-mark">S</div>
          <div>
            <h1 style={{ margin: 0 }}>StudyFlow AI</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>Learn smarter. Practice better. Remember longer.</p>
          </div>
        </div>

        <div className="segmented-control" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'segmented active' : 'segmented'} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" className={mode === 'signup' ? 'segmented active' : 'segmented'} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error ? <div className="status-box error-box">{error}</div> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
