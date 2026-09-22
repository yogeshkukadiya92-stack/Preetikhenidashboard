const SESSION_KEY = 'moms-pathshala:auth-session:v1';
const LEGACY_SUPABASE_SESSION_KEY = 'moms-pathshala:supabase-session:v1';
const LAST_PATH_KEY = 'moms-pathshala:last-protected-path:v1';
export const STAFF_USERS_KEY = 'moms-pathshala:Main Branch:users:rows:v3';
export const ALL_USERS_KEY = 'moms-pathshala:auth-users:v1';
const configuredEmail = String(import.meta.env.VITE_ADMIN_EMAIL ?? 'shreeayurved09@gmail.com').trim().toLowerCase();
const configuredPasswordHash = String(import.meta.env.VITE_ADMIN_PASSWORD_SHA256 ?? '').trim().toLowerCase();

export const ADMIN_EMAIL = configuredEmail;
export const AUTH_CONFIGURED = Boolean(configuredEmail && configuredPasswordHash);
export const STAFF_PERMISSION_OPTIONS = [
  { path: '/', label: 'Dashboard / Overview' },
  { path: '/crm', label: 'CRM' },
  { path: '/clients', label: 'Patients' },
  { path: '/journey', label: 'Patient Journey' },
  { path: '/appointments', label: 'Appointments' },
  { path: '/forms', label: 'Forms' },
  { path: '/services', label: 'Services' },
  { path: '/treatments', label: 'Treatments' },
  { path: '/packages', label: 'Packages' },
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

export function getAllUsers() {
  let users = [];
  try {
    const raw = window.localStorage.getItem(ALL_USERS_KEY);
    if (raw) users = JSON.parse(raw);
  } catch {
    users = [];
  }
  if (!Array.isArray(users) || users.length === 0) {
    try {
      const staffRaw = window.localStorage.getItem(STAFF_USERS_KEY);
      if (staffRaw) {
        const staff = JSON.parse(staffRaw);
        if (Array.isArray(staff) && staff.length) {
          users = staff.map((u) => ({ ...u, branch: u.branch || 'Main Branch' }));
          window.localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
        }
      }
    } catch {
      // ignore
    }
  }
  return Array.isArray(users) ? users : [];
}

export function saveAuthUser(user) {
  const users = getAllUsers();
  const email = String(user.email ?? '').trim().toLowerCase();
  if (!email) return false;
  const existingIndex = users.findIndex((u) => String(u.email).trim().toLowerCase() === email);
  const updatedUser = {
    ...user,
    email,
    branch: user.branch || 'Main Branch',
    status: user.status || 'Active',
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
  let nextUsers = [];
  if (existingIndex >= 0) {
    nextUsers = users.map((u, i) => (i === existingIndex ? { ...u, ...updatedUser } : u));
  } else {
    nextUsers = [...users, updatedUser];
  }
  window.localStorage.setItem(ALL_USERS_KEY, JSON.stringify(nextUsers));
  const mainBranchUsers = nextUsers.filter((u) => (u.branch || 'Main Branch') === 'Main Branch');
  window.localStorage.setItem(STAFF_USERS_KEY, JSON.stringify(mainBranchUsers));
  return true;
}

export function deleteAuthUser(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  const users = getAllUsers().filter((u) => String(u.email).trim().toLowerCase() !== normalized);
  window.localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
  const mainBranchUsers = users.filter((u) => (u.branch || 'Main Branch') === 'Main Branch');
  window.localStorage.setItem(STAFF_USERS_KEY, JSON.stringify(mainBranchUsers));
  return true;
}

export function getBranchAccount(branchName) {
  const users = getAllUsers();
  return users.find((u) => u.branch === branchName && (u.isBranchAccount || u.role === 'Branch Manager'))
    || users.find((u) => u.branch === branchName);
}

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
  const users = getAllUsers();
  const user = users.find((u) => String(u.email).trim().toLowerCase() === String(session.email).trim().toLowerCase());
  if (!user || user.status !== 'Active') {
    clearAuthSession();
    return null;
  }
  return {
    ...session,
    name: user.name || session.name,
    role: user.role || session.role,
    branch: user.branch || session.branch || 'Main Branch',
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

export async function verifyCredentials(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await hashPassword(String(password));
  if (AUTH_CONFIGURED && normalizedEmail === ADMIN_EMAIL && passwordHash === configuredPasswordHash) {
    return { email: ADMIN_EMAIL, name: 'Administrator', role: 'Administrator', isAdmin: true, branch: null, permissions: ['*'] };
  }
  const users = getAllUsers();
  const user = users.find((u) => String(u.email).trim().toLowerCase() === normalizedEmail);
  if (!user || user.status !== 'Active' || !user.passwordHash || user.passwordHash !== passwordHash) return null;
  return {
    email: normalizedEmail,
    name: user.name || normalizedEmail,
    role: user.role || 'Branch User',
    branch: user.branch || 'Main Branch',
    isAdmin: false,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
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
  if (path === '/') {
    return Boolean(session.permissions?.includes('/'));
  }
  return (session.permissions ?? []).some((allowedPath) => path === allowedPath || path.startsWith(`${allowedPath}/`));
}

export function getLandingPath(session) {
  if (!session || session.isAdmin) return '/';
  if (session.permissions?.includes('/')) return '/';
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
