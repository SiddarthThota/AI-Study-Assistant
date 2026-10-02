import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, clearAuthSession } from '../lib/api';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/learn', label: 'Learn' },
  { to: '/quiz', label: 'Practice' },
  { to: '/flashcards', label: 'Recall' },
  { to: '/tutor', label: 'AI Tutor' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  const navigate = useNavigate();
  const email = sessionStorage.getItem('studyflow-user-email') ?? '';

  const handleSignOut = async () => {
    const refreshToken = sessionStorage.getItem('studyflow-refresh-token');
    await api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => undefined);
    clearAuthSession();
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('studyflow-') && key !== 'studyflow-access-token' && key !== 'studyflow-refresh-token') {
        sessionStorage.removeItem(key);
      }
    }
    navigate('/auth');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">StudyFlow AI</div>
            <div className="brand-tag">Learn smarter. Practice better. Remember longer.</div>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">Signed in</span>
          <strong>{email}</strong>
        </div>

        <button className="secondary-button" type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </aside>

      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
