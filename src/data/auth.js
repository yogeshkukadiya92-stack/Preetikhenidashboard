const SESSION_KEY = 'moms-pathshala:auth-session:v1';
const SUPABASE_SESSION_KEY = 'moms-pathshala:supabase-session:v1';
const configuredEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
const configuredPasswordHash = String(import.meta.env.VITE_ADMIN_PASSWORD_SHA256 ?? '').trim().toLowerCase();
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const AUTH_REQUEST_TIMEOUT_MS = 10_000;

export const ADMIN_EMAIL = configuredEmail;
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const AUTH_CONFIGURED = Boolean(configuredEmail && (supabaseConfigured || configuredPasswordHash));

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function readSession(storage) {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.email || Number(session.expiresAt) <= Date.now()) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getAuthSession() {
  return readSession(window.sessionStorage) ?? readSession(window.localStorage);
}

export async function verifyCredentials(email, password) {
  if (!AUTH_CONFIGURED) return false;
  if (String(email).trim().toLowerCase() !== ADMIN_EMAIL) return false;
  if (supabaseConfigured) {
    const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email).trim(), password: String(password) }),
    });
    if (!response.ok) return false;
    const session = await response.json();
    window.sessionStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(session));
    return Boolean(session.access_token);
  }
  const passwordHash = await sha256(String(password));
  return passwordHash === configuredPasswordHash;
}

export function createAuthSession(remember = false) {
  const duration = remember ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const session = { email: ADMIN_EMAIL, expiresAt: Date.now() + duration };
  const storage = remember ? window.localStorage : window.sessionStorage;
  const otherStorage = remember ? window.sessionStorage : window.localStorage;
  otherStorage.removeItem(SESSION_KEY);
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  const supabaseSession = window.sessionStorage.getItem(SUPABASE_SESSION_KEY) ?? window.localStorage.getItem(SUPABASE_SESSION_KEY);
  if (supabaseSession) {
    otherStorage.removeItem(SUPABASE_SESSION_KEY);
    storage.setItem(SUPABASE_SESSION_KEY, supabaseSession);
  }
  return session;
}

export function getSupabaseAccessToken() {
  try {
    const raw = window.sessionStorage.getItem(SUPABASE_SESSION_KEY) ?? window.localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return '';
    return JSON.parse(raw).access_token ?? '';
  } catch { return ''; }
}

export async function getValidSupabaseAccessToken() {
  const localRaw = window.localStorage.getItem(SUPABASE_SESSION_KEY);
  const sessionRaw = window.sessionStorage.getItem(SUPABASE_SESSION_KEY);
  const raw = sessionRaw ?? localRaw;
  if (!raw) return '';
  try {
    const session = JSON.parse(raw);
    if (session.access_token && Number(session.expires_at ?? 0) * 1000 > Date.now() + 60_000) return session.access_token;
    if (!session.refresh_token || !supabaseConfigured) return session.access_token ?? '';
    const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) return '';
    const refreshed = await response.json();
    const storage = sessionRaw ? window.sessionStorage : window.localStorage;
    storage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(refreshed));
    return refreshed.access_token ?? '';
  } catch {
    return '';
  }
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SUPABASE_SESSION_KEY);
  window.localStorage.removeItem(SUPABASE_SESSION_KEY);
}
