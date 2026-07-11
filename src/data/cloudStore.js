import { getSupabaseAccessToken } from './auth.js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const originalSetItem = window.Storage.prototype.setItem;
let syncInstalled = false;

export const CLOUD_STORAGE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey);

function shouldSync(key) {
  return (key.startsWith('moms-pathshala:') || key.startsWith('ayurflow:'))
    && !key.includes(':auth-session:')
    && !key.includes(':supabase-session:');
}

async function request(path, options = {}) {
  const accessToken = getSupabaseAccessToken();
  if (!CLOUD_STORAGE_CONFIGURED || !accessToken) return null;
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
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
}

export async function hydrateCloudState() {
  const rows = await request('/rest/v1/app_state?branch=eq.workspace&select=key,value');
  if (!Array.isArray(rows)) return 0;
  rows.forEach((row) => {
    if (shouldSync(row.key)) originalSetItem.call(window.localStorage, row.key, JSON.stringify(row.value));
  });
  if (!rows.length) {
    const localEntries = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key) => key && shouldSync(key))
      .map((key) => [key, window.localStorage.getItem(key)]);
    await Promise.all(localEntries.map(([key, value]) => syncCloudValue(key, value)));
    return localEntries.length;
  }
  return rows.length;
}

export function installCloudSync() {
  if (syncInstalled || !CLOUD_STORAGE_CONFIGURED) return;
  syncInstalled = true;
  window.Storage.prototype.setItem = function cloudSyncedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage) syncCloudValue(String(key), String(value)).catch(() => {});
  };
}
