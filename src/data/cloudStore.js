const originalSetItem = window.Storage.prototype.setItem;
let syncInstalled = false;
let refreshInstalled = false;
let syncPausedUntil = 0;
const PENDING_KEY = 'moms-pathshala:cloud-pending:v2';
const REFRESH_INTERVAL_MS = 15_000;
const API_REQUEST_TIMEOUT_MS = 10_000;
const LOGIN_HYDRATION_PAUSE_MS = API_REQUEST_TIMEOUT_MS + 2_000;

export const CLOUD_STORAGE_CONFIGURED = true;

function shouldSync(key) {
  return (key.startsWith('moms-pathshala:') || key.startsWith('ayurflow:'))
    && !key.includes(':auth-session:')
    && !key.includes(':supabase-session:')
    && key !== PENDING_KEY;
}

function readPending() {
  try { return JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? '{}'); } catch { return {}; }
}

function writePending(pending) {
  originalSetItem.call(window.localStorage, PENDING_KEY, JSON.stringify(pending));
}

function queuePending(key, value) {
  writePending({ ...readPending(), [key]: value });
}

function clearPending(key, syncedValue) {
  const pending = readPending();
  if (pending[key] !== syncedValue) return;
  delete pending[key];
  writePending(pending);
}

function cloudSyncPaused() {
  return Date.now() < syncPausedUntil;
}

export function pauseCloudSync(durationMs = LOGIN_HYDRATION_PAUSE_MS) {
  syncPausedUntil = Math.max(syncPausedUntil, Date.now() + durationMs);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function request(path, options = {}) {
  const response = await fetchWithTimeout(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Cloud storage request failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}

export async function syncCloudValue(key, value) {
  if (!shouldSync(key)) return;
  let parsedValue;
  try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }
  await request(`/api/app-state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ branch: 'workspace', value: parsedValue }),
  });
  clearPending(key, value);
}

export async function hydrateCloudState() {
  const rows = await request('/api/app-state?branch=workspace');
  if (!Array.isArray(rows)) return 0;
  const pending = readPending();
  const cloudKeys = new Set();
  let changedKeys = 0;
  rows.forEach((row) => {
    if (!shouldSync(row.key)) return;
    cloudKeys.add(row.key);
    if (Object.prototype.hasOwnProperty.call(pending, row.key)) return;
    const cloudValue = JSON.stringify(row.value);
    if (window.localStorage.getItem(row.key) !== cloudValue) {
      originalSetItem.call(window.localStorage, row.key, cloudValue);
      changedKeys += 1;
    }
  });
  const pendingEntries = Object.entries(pending).filter(([key]) => shouldSync(key));
  if (pendingEntries.length) await Promise.allSettled(pendingEntries.map(([key, value]) => syncCloudValue(key, value)));
  return changedKeys;
}

export function installCloudSync() {
  if (syncInstalled) return;
  syncInstalled = true;
  window.Storage.prototype.setItem = function cloudSyncedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage && shouldSync(String(key)) && !cloudSyncPaused()) {
      queuePending(String(key), String(value));
      syncCloudValue(String(key), String(value)).catch(() => {});
    }
  };
}

export function installCloudRefresh() {
  if (refreshInstalled) return;
  refreshInstalled = true;
  window.setInterval(() => {
    hydrateCloudState()
      .then((changedKeys) => {
        if (changedKeys > 0) window.location.reload();
      })
      .catch(() => {});
  }, REFRESH_INTERVAL_MS);
}
