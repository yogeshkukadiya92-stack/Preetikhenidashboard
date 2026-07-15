const SESSION_KEY = 'moms-pathshala:auth-session:v1';
const LEGACY_SUPABASE_SESSION_KEY = 'moms-pathshala:supabase-session:v1';
const configuredEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase();
const configuredPasswordHash = String(import.meta.env.VITE_ADMIN_PASSWORD_SHA256 ?? '').trim().toLowerCase();

export const ADMIN_EMAIL = configuredEmail;
export const AUTH_CONFIGURED = Boolean(configuredEmail && configuredPasswordHash);

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
  window.sessionStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
  return session;
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
}
