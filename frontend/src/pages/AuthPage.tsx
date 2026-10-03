import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getAccessToken, setAuthSession } from '../lib/api';
import type { UserSession } from '../types';

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (mode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Please enter your first and last name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      if (!email.includes('@') || password.length < 6) {
        throw new Error('Use a valid email and a password with at least 6 characters.');
      }

      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
      const payload = mode === 'signup'
        ? { email: email.trim(), password, first_name: firstName.trim(), last_name: lastName.trim() }
        : { email: email.trim(), password };

      const session = await api.post<UserSession>(endpoint, payload);
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
      <div className="card auth-card" style={{ width: '100%', maxWidth: '420px' }}>
        <div className="auth-header">
          <div className="brand-mark auth-mark">S</div>
          <div>
            <h1 style={{ margin: 0 }}>StudyFlow AI</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>Learn smarter. Practice better. Remember longer.</p>
          </div>
        </div>

        <div className="segmented-control" aria-label="Authentication mode" style={{ marginBottom: '20px' }}>
          <button type="button" className={mode === 'login' ? 'segmented active' : 'segmented'} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" className={mode === 'signup' ? 'segmented active' : 'segmented'} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label htmlFor="firstName">First name</label>
                <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="lastName">Last name</label>
                <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          )}

          {error ? <div className="status-box error-box" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #f87171', padding: '12px', borderRadius: '6px' }}>{error}</div> : null}

          <button className="primary-button" type="submit" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
            {loading ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
