const SESSION_KEY = 'moms-pathshala:auth-session:v1';
const LEGACY_SUPABASE_SESSION_KEY = 'moms-pathshala:supabase-session:v1';
const LAST_PATH_KEY = 'moms-pathshala:last-protected-path:v1';
export const STAFF_USERS_KEY = 'moms-pathshala:Main Branch:users:rows:v3';
const configuredEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? 'shreeayurved09@gmail.com').trim().toLowerCase();
const configuredPasswordHash = String(import.meta.env.VITE_ADMIN_PASSWORD_SHA256 ?? '').trim().toLowerCase();

export const ADMIN_EMAIL = configuredEmail;
export const AUTH_CONFIGURED = Boolean(configuredEmail && configuredPasswordHash);
export const STAFF_PERMISSION_OPTIONS = [
  { path: '/crm', label: 'CRM' },
  { path: '/clients', label: 'Patients' },
  { path: '/journey', label: 'Patient Journey' },
  { path: '/appointments', label: 'Appointments' },
  { path: '/forms', label: 'Forms' },
  { path: '/services', label: 'Services' },
  { path: '/treatments', label: 'Treatments' },
  { path: '/coaching', label: 'Coaching' },
  { path: '/attendance', label: 'Attendance' },
  { path: '/operations', label: 'Operations' },
  { path: '/medicines', label: 'Medicines' },
  { path: '/inventory', label: 'Inventory' },
  { path: '/communication', label: 'Communication' },
  { path: '/payments', label: 'Payments' },
  { path: '/finance', label: 'Finance' },
  { path: '/accounts', label: 'Accounts' },
  { path: '/reports', label: 'Reports' },
];

export async function hashPassword(value) {
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
  const session = readSession(window.sessionStorage) ?? readSession(window.localStorage);
  if (!session || session.isAdmin) return session;
  let staffUsers = [];
  try { staffUsers = JSON.parse(window.localStorage.getItem(STAFF_USERS_KEY) ?? '[]'); } catch { staffUsers = []; }
  const staff = staffUsers.find((user) => String(user.email).trim().toLowerCase() === String(session.email).trim().toLowerCase());
  if (!staff || staff.status !== 'Active') {
    clearAuthSession();
    return null;
  }
  return {
    ...session,
    name: staff.name || session.name,
    role: staff.role || session.role,
    permissions: Array.isArray(staff.permissions) ? staff.permissions : [],
  };
}

export async function verifyCredentials(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await hashPassword(String(password));
  if (AUTH_CONFIGURED && normalizedEmail === ADMIN_EMAIL && passwordHash === configuredPasswordHash) {
    return { email: ADMIN_EMAIL, name: 'Administrator', role: 'Administrator', isAdmin: true, permissions: ['*'] };
  }
  let staffUsers = [];
  try { staffUsers = JSON.parse(window.localStorage.getItem(STAFF_USERS_KEY) ?? '[]'); } catch { staffUsers = []; }
  const staff = staffUsers.find((user) => String(user.email).trim().toLowerCase() === normalizedEmail);
  if (!staff || staff.status !== 'Active' || !staff.passwordHash || staff.passwordHash !== passwordHash) return null;
  return {
    email: normalizedEmail,
    name: staff.name || normalizedEmail,
    role: staff.role || 'Staff',
    isAdmin: false,
    permissions: Array.isArray(staff.permissions) ? staff.permissions : [],
  };
}

export function createAuthSession(identity, remember = false) {
  const duration = remember ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const session = { ...identity, expiresAt: Date.now() + duration };
  const storage = remember ? window.localStorage : window.sessionStorage;
  const otherStorage = remember ? window.sessionStorage : window.localStorage;
  otherStorage.removeItem(SESSION_KEY);
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  window.sessionStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
  return session;
}

export function canAccessPath(session, path) {
  if (!session) return false;
  if (session.isAdmin || session.permissions?.includes('*')) return true;
  if (path === '/') return false;
  return (session.permissions ?? []).some((allowedPath) => path === allowedPath || path.startsWith(`${allowedPath}/`));
}

export function getLandingPath(session) {
  if (!session || session.isAdmin) return '/';
  return session.permissions?.[0] ?? '/login';
}

export function rememberLastProtectedPath(path) {
  const value = String(path ?? '').trim();
  if (!value || value === '/login' || value.startsWith('/public/')) return;
  window.sessionStorage.setItem(LAST_PATH_KEY, value);
}

export function getLastProtectedPath() {
  return window.sessionStorage.getItem(LAST_PATH_KEY) || '';
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(LAST_PATH_KEY);
  window.sessionStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
}
