import { getValidSupabaseAccessToken } from './auth.js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const originalSetItem = window.Storage.prototype.setItem;
let syncInstalled = false;
let refreshInstalled = false;
let syncPausedUntil = 0;
const PENDING_KEY = 'moms-pathshala:cloud-pending:v1';
const REFRESH_INTERVAL_MS = 15_000;
const CLOUD_REQUEST_TIMEOUT_MS = 10_000;
const LOGIN_HYDRATION_PAUSE_MS = CLOUD_REQUEST_TIMEOUT_MS + 2_000;

export const CLOUD_STORAGE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey);

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

async function fetchWithTimeout(url, options = {}, timeoutMs = CLOUD_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function request(path, options = {}) {
  const accessToken = await getValidSupabaseAccessToken();
  if (!CLOUD_STORAGE_CONFIGURED) return null;
  const bearerToken = accessToken || supabaseAnonKey;
  const response = await fetchWithTimeout(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${bearerToken}`,
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
  await request('/rest/v1/app_state?on_conflict=branch,key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ branch: 'workspace', key, value: parsedValue, updated_at: new Date().toISOString() }),
  });
  clearPending(key, value);
}

export async function hydrateCloudState() {
  const rows = await request('/rest/v1/app_state?branch=eq.workspace&select=key,value');
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
  const localEntries = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key) => key && shouldSync(key) && !cloudKeys.has(key))
    .map((key) => [key, window.localStorage.getItem(key)]);
  if (localEntries.length) await Promise.all(localEntries.map(([key, value]) => syncCloudValue(key, value)));
  return changedKeys;
}

export function installCloudSync() {
  if (syncInstalled || !CLOUD_STORAGE_CONFIGURED) return;
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
  if (refreshInstalled || !CLOUD_STORAGE_CONFIGURED) return;
  refreshInstalled = true;
  window.setInterval(() => {
    hydrateCloudState()
      .then((changedKeys) => {
        if (changedKeys > 0) window.location.reload();
      })
      .catch(() => {});
  }, REFRESH_INTERVAL_MS);
}
