const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'lmpc_authority_token';
const USER_KEY = 'lmpc_authority_user';
const ACTOR_TOKEN_KEY = 'lmpc_actor_token';

export type AuthorityRole = 'AUTHORITY' | 'ADMIN';

export interface AuthorityUser {
  id: string;
  username: string;
  name: string;
  designation?: string;
  district?: string | null;
  role?: AuthorityRole;
}

async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => ({ error: fallback }));
  const err = new Error(body.error || fallback) as Error & { field?: string };
  err.field = body.field;
  return err;
}

export async function authorityLogin(username: string, password: string): Promise<AuthorityUser> {
  const res = await fetch(`${API_BASE}/auth/authority/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) throw await readError(res, 'Login failed.');

  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export interface VerifiedCode {
  valid: boolean;
  designation: string | null;
  district: string | null;
  role: AuthorityRole;
}

/** Step 1 of registration: checks the code without consuming it. */
export async function verifyAuthorityCode(code: string): Promise<VerifiedCode> {
  const res = await fetch(`${API_BASE}/auth/authority/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  if (!res.ok) throw await readError(res, 'That code could not be verified.');
  return res.json();
}

export interface RegisterInput {
  code: string;
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  designation?: string;
}

/** Step 2: consumes the code and creates the account. */
export async function registerAuthority(input: RegisterInput): Promise<AuthorityUser> {
  const res = await fetch(`${API_BASE}/auth/authority/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!res.ok) throw await readError(res, 'Could not create the account.');

  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export function authorityLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('authority-logout'));
  }
}

export function getAuthorityToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthorityUser(): AuthorityUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isAuthorityLoggedIn(): boolean {
  return !!getAuthorityToken();
}

export function isAdmin(user?: AuthorityUser | null): boolean {
  return (user || getAuthorityUser())?.role === 'ADMIN';
}

export function authHeader(): Record<string, string> {
  const token = getAuthorityToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Anonymous per-browser identity for consumers and sellers. It identifies a
 * device so a person can see their own history, submit a complaint and leave
 * feedback without creating an account. No personal data is attached to it.
 */
export function getActorToken(): string {
  let token = localStorage.getItem(ACTOR_TOKEN_KEY);
  if (!token) {
    token =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `actor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ACTOR_TOKEN_KEY, token);
  }
  return token;
}

export function actorHeaders(type: 'CONSUMER' | 'SELLER' = 'CONSUMER'): Record<string, string> {
  return { 'X-Actor-Token': getActorToken(), 'X-Actor-Type': type };
}

export { API_BASE };
