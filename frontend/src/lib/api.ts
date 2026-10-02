const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api';
const ACCESS_TOKEN_KEY = 'studyflow-access-token';
const REFRESH_TOKEN_KEY = 'studyflow-refresh-token';

export type AuthSession = {
  user_id: string;
  email: string;
  name: string;
  is_authenticated: boolean;
  needs_email_confirmation?: boolean;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
};

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAuthSession(session: AuthSession): void {
  if (session.access_token && session.refresh_token && session.is_authenticated) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
    sessionStorage.setItem('studyflow-user-email', session.email);
  }
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem('studyflow-user-email');
  sessionStorage.removeItem('studyflow-user-id');
}

function getErrorMessage(body: string): string {
  try {
    const payload: unknown = JSON.parse(body);
    if (payload && typeof payload === 'object' && 'detail' in payload) {
      const detail = payload.detail;
      if (typeof detail === 'string') return detail;
    }
  } catch {
    return body;
  }

  return body;
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) throw new Error('Session refresh failed');
    setAuthSession(await response.json() as AuthSession);
    return Boolean(getAccessToken());
  } catch {
    clearAuthSession();
    window.dispatchEvent(new Event('studyflow:session-expired'));
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const isAuthTerminal = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'].includes(path);
  if (res.status === 401 && retry && !isAuthTerminal) {
    if (await refreshSession()) return request<T>(path, options, false);
    throw new Error('Your session expired. Please sign in again.');
  }

  if (!res.ok) {
    const message = getErrorMessage(await res.text());
    throw new Error(message || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T,>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T,>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  upload: <T,>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
};

export { API_BASE_URL };
