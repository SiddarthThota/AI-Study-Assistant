import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { api, clearAuthSession, getAccessToken } from './lib/api';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotesPage } from './pages/NotesPage';
import { QuizPage } from './pages/QuizPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { TutorPage } from './pages/TutorPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

function ProtectedRoute() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const handleExpired = () => setAuthenticated(false);
    window.addEventListener('studyflow:session-expired', handleExpired);

    if (!getAccessToken()) {
      clearAuthSession();
      setChecking(false);
      return () => window.removeEventListener('studyflow:session-expired', handleExpired);
    }

    api.post('/auth/session', {})
      .then(() => setAuthenticated(true))
      .catch(() => {
        clearAuthSession();
        setAuthenticated(false);
      })
      .finally(() => setChecking(false));

    return () => window.removeEventListener('studyflow:session-expired', handleExpired);
  }, []);

  if (checking) return <div className="status-box">Restoring session…</div>;
  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/learn" element={<NotesPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/tutor" element={<TutorPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
