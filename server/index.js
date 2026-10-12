import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mayAccessKey } from './branchAccess.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '';
const WORKSPACE_BRANCH = 'shreeayurved09@gmail.com';
const USERS_KEY = 'moms-pathshala:auth-users:v1';
const STAFF_USERS_KEY = 'moms-pathshala:Main Branch:users:rows:v3';
const COOKIE_NAME = 'moms_pathshala_session';
const adminEmail = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'shreeayurved09@gmail.com').toLowerCase();
const adminPasswordHash = String(process.env.ADMIN_PASSWORD_SHA256 || process.env.VITE_ADMIN_PASSWORD_SHA256 || '').toLowerCase();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let pool = null;

function getPool() {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return;
  await db.query(`
    create table if not exists app_state (
      branch text not null default 'workspace',
      key text not null,
      value jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (branch, key)
    )
  `);
  await db.query(`create table if not exists auth_sessions (
    token_hash text primary key,
    email text not null,
    expires_at timestamptz not null
  )`);
  await db.query(`
    create table if not exists public_forms (
      slug text primary key,
      form_id text not null,
      form jsonb not null,
      updated_at timestamptz not null default now()
    );
    create index if not exists public_forms_form_id_idx on public_forms (form_id);
    create table if not exists form_responses (
      id text primary key,
      form_slug text not null references public_forms(slug) on delete cascade,
      response jsonb not null,
      submitted_at timestamptz not null default now()
    );
    create index if not exists form_responses_slug_submitted_idx on form_responses (form_slug, submitted_at desc);
    create table if not exists public_attendance_forms (
      slug text primary key,
      form jsonb not null,
      updated_at timestamptz not null default now()
    );
    create table if not exists public_attendance_responses (
      id text primary key,
      form_slug text not null references public_attendance_forms(slug) on delete cascade,
      response jsonb not null,
      submitted_at timestamptz not null default now()
    );
    create index if not exists public_attendance_responses_slug_idx on public_attendance_responses (form_slug, submitted_at desc);
  `);
  await db.query(
    `insert into app_state (branch, key, value, updated_at)
     select $1, key, value, updated_at
     from app_state
     where branch = 'workspace'
     on conflict (branch, key) do nothing`,
    [WORKSPACE_BRANCH],
  );
  await db.query(
    `insert into public_forms (slug, form_id, form, updated_at)
     select form->>'slug', form->>'id', form, now()
     from app_state
     cross join lateral jsonb_array_elements(
       case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
     ) as form
     where branch = $1
       and key = 'moms-pathshala:forms:v2'
       and form->>'status' = 'Published'
       and coalesce(form->>'slug', '') <> ''
       and coalesce(form->>'id', '') <> ''
     on conflict (slug)
     do update set form_id = excluded.form_id, form = excluded.form, updated_at = now()`,
    [WORKSPACE_BRANCH],
  );
}

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function hashesEqual(left, right) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

async function readState(key) {
  const result = await getPool().query('select value from app_state where branch = $1 and key = $2', [WORKSPACE_BRANCH, key]);
  return result.rows[0]?.value;
}

async function readUsers() {
  const users = await readState(USERS_KEY);
  if (Array.isArray(users)) return users;
  const legacy = await readState(STAFF_USERS_KEY);
  return Array.isArray(legacy) ? legacy : [];
}

async function identityFor(email) {
  if (email === adminEmail) return { email, name: 'Administrator', role: 'Administrator', isAdmin: true, branch: null, permissions: ['*'] };
  const user = (await readUsers()).find((entry) => String(entry.email).toLowerCase() === email && entry.status === 'Active');
  if (!user) return null;
  return { email, name: user.name || email, role: user.role || 'Branch User', isAdmin: false, branch: user.branch || 'Main Branch', permissions: Array.isArray(user.permissions) ? user.permissions : [] };
}

async function requireIdentity(request, response, next) {
  try {
    if (!getPool()) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
    const token = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    if (!token) return response.status(401).json({ error: 'Sign in required.' });
    const result = await getPool().query('select email from auth_sessions where token_hash = $1 and expires_at > now()', [sha256(token)]);
    const identity = result.rows[0] && await identityFor(result.rows[0].email);
    if (!identity) return response.status(401).json({ error: 'Session expired.' });
    request.identity = identity;
    next();
  } catch (error) { next(error); }
}

app.post('/api/auth/login', asyncHandler(async (request, response) => {
  if (!getPool()) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const email = String(request.body?.email || '').trim().toLowerCase();
  const passwordHash = sha256(request.body?.password || '');
  let identity = null;
  if (email === adminEmail && hashesEqual(passwordHash, adminPasswordHash)) identity = await identityFor(email);
  if (!identity && email !== adminEmail) {
    const user = (await readUsers()).find((entry) => String(entry.email).toLowerCase() === email && entry.status === 'Active');
    if (user && hashesEqual(passwordHash, String(user.passwordHash || ''))) identity = await identityFor(email);
  }
  if (!identity) return response.status(401).json({ error: 'Invalid credentials.' });
  const token = randomBytes(32).toString('hex');
  const duration = request.body?.remember ? 7 * 24 * 60 * 60 : 12 * 60 * 60;
  await getPool().query('insert into auth_sessions (token_hash, email, expires_at) values ($1, $2, now() + ($3 * interval \'1 second\'))', [sha256(token), email, duration]);
  response.cookie(COOKIE_NAME, token, { httpOnly: true, secure: request.secure || request.headers['x-forwarded-proto'] === 'https', sameSite: 'strict', path: '/', maxAge: duration * 1000 });
  response.json(identity);
}));

app.get('/api/auth/session', requireIdentity, (request, response) => response.json(request.identity));
app.post('/api/auth/logout', requireIdentity, asyncHandler(async (request, response) => {
  const token = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  await getPool().query('delete from auth_sessions where token_hash = $1', [sha256(token)]);
  response.clearCookie(COOKIE_NAME, { path: '/' }).status(204).end();
}));

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
}

function normalizeName(value) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function fieldMatches(field, pattern) {
  return pattern.test(String(field?.label ?? '').trim());
}

function patientDetails(row) {
  if (Array.isArray(row)) {
    return row.length >= 7
      ? { id: row[0] ?? '', name: row[1] ?? '', mobile: row[2] ?? '' }
      : { id: '', name: row[0] ?? '', mobile: row[1] ?? '' };
  }
  return {
    id: row?.clientId ?? row?.['Client ID'] ?? row?.ClientId ?? row?.ID ?? row?.id ?? '',
    name: row?.name ?? row?.Client ?? row?.client ?? '',
    mobile: row?.mobile ?? row?.Mobile ?? row?.phone ?? row?.Phone ?? '',
  };
}

async function applyPatientDataMappings(db, form, submittedResponse) {
  const formBranch = String(form.branch || 'Main Branch');
  const patientsKey = `moms-pathshala:${formBranch}:ayurflow-clients:rows:v3`;
  const updatesKey = `moms-pathshala:${formBranch}:patient-form-updates:v1`;
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const mobileField = fields.find((field) => field.dataTarget === 'patient_mobile')
    ?? fields.find((field) => field.type === 'phone' || fieldMatches(field, /mobile|phone|contact|મોબાઇલ|ફોન|मोबाइल|फोन/i));
  const nameField = fields.find((field) => field.dataTarget === 'patient_name')
    ?? fields.find((field) => fieldMatches(field, /patient\s*name|client\s*name|full\s*name|^name\b|નામ|नाम/i));
  const mobile = normalizePhone(submittedResponse.answers?.[mobileField?.id]);
  const submittedName = String(submittedResponse.answers?.[nameField?.id] ?? '').trim();
  if (!mobile && !submittedName) return;

  const patientResult = await db.query(
    'select value from app_state where branch = $1 and key = $2 limit 1',
    [WORKSPACE_BRANCH, patientsKey],
  );
  const patients = Array.isArray(patientResult.rows[0]?.value) ? patientResult.rows[0].value : [];
  const matchedRow = patients.find((row) => {
    const details = patientDetails(row);
    return (mobile && normalizePhone(details.mobile) === mobile)
      || (!mobile && normalizeName(details.name) === normalizeName(submittedName));
  });
  if (!matchedRow) return;
  const patient = patientDetails(matchedRow);

  const mappedFields = fields.flatMap((field) => {
    if (field.dataTarget === 'patient_weight' || (field.type === 'number' && fieldMatches(field, /weight|વજન|वजन/i))) return [{ field, type: 'weight', unit: 'kg' }];
    if (field.dataTarget === 'patient_waist' || (field.type === 'number' && fieldMatches(field, /waist|tummy|abdomen|inch|કમર|પેટ|कमर|पेट/i))) return [{ field, type: 'waist', unit: 'inch' }];
    return [];
  });
  const updates = mappedFields.flatMap(({ field, type, unit }) => {
    const value = Number(String(submittedResponse.answers?.[field.id] ?? '').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(value) || value <= 0) return [];
    return [{
      id: `${submittedResponse.id}:${field.id}`,
      patientId: patient.id,
      patientName: patient.name,
      mobile: mobile || normalizePhone(patient.mobile),
      type,
      value,
      unit,
      recordedAt: submittedResponse.submittedAt ?? new Date().toISOString(),
      formId: form.id,
      formTitle: form.title,
      responseId: submittedResponse.id,
      fieldId: field.id,
      fieldLabel: field.label,
    }];
  });
  if (!updates.length) return;

  const currentResult = await db.query(
    'select value from app_state where branch = $1 and key = $2 limit 1',
    [WORKSPACE_BRANCH, updatesKey],
  );
  const current = Array.isArray(currentResult.rows[0]?.value) ? currentResult.rows[0].value : [];
  const ids = new Set(current.map((item) => item.id));
  const next = [...updates.filter((item) => !ids.has(item.id)), ...current];
  await db.query(
    `insert into app_state (branch, key, value, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (branch, key)
     do update set value = excluded.value, updated_at = now()`,
    [WORKSPACE_BRANCH, updatesKey, JSON.stringify(next)],
  );
}

app.get('/api/health', asyncHandler(async (_request, response) => {
  const db = getPool();
  if (!db) return response.json({ ok: true, database: false });
  await db.query('select 1');
  response.json({ ok: true, database: true });
}));

app.get('/api/app-state', requireIdentity, asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const result = await db.query(
    'select key, value, updated_at from app_state where branch = $1 order by key',
    [WORKSPACE_BRANCH],
  );
  response.json(result.rows.filter((row) => mayAccessKey(request.identity, row.key)));
}));

app.put('/api/app-state/:key', requireIdentity, asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const key = String(request.params.key ?? '').trim();
  if (!key) return response.status(400).json({ error: 'State key is required.' });
  if (!mayAccessKey(request.identity, key, true)) return response.status(403).json({ error: 'This branch cannot change that data.' });
  const value = request.body?.value;
  if (value === undefined) return response.status(400).json({ error: 'State value is required.' });
  await db.query(
    `insert into app_state (branch, key, value, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (branch, key)
     do update set value = excluded.value, updated_at = now()`,
    [WORKSPACE_BRANCH, key, JSON.stringify(value)],
  );
  response.status(204).end();
}));

app.put('/api/forms/:slug', requireIdentity, asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const slug = String(request.params.slug ?? '').trim();
  const form = request.body;
  if (!slug || !form?.id || !form?.title) return response.status(400).json({ error: 'A valid form is required.' });
  const existing = await db.query('select form from public_forms where slug = $1', [slug]);
  if (existing.rows[0] && !request.identity.isAdmin && (existing.rows[0].form.branch || 'Main Branch') !== request.identity.branch) return response.status(403).json({ error: 'Other branch form is unavailable.' });
  await db.query(
    `insert into public_forms (slug, form_id, form, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (slug)
     do update set form_id = excluded.form_id, form = excluded.form, updated_at = now()`,
    [slug, String(form.id), JSON.stringify({ ...form, slug, branch: request.identity.isAdmin ? (form.branch || 'Main Branch') : request.identity.branch })],
  );
  response.json({ form: { ...form, slug } });
}));

app.get('/api/forms', requireIdentity, asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const result = await db.query('select form from public_forms order by updated_at desc');
  response.json({ forms: result.rows.map((row) => row.form).filter((form) => request.identity.isAdmin || (form.branch || 'Main Branch') === request.identity.branch) });
}));

app.get('/api/forms/:slug', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const result = await db.query('select form from public_forms where slug = $1 limit 1', [String(request.params.slug ?? '')]);
  const form = result.rows[0]?.form;
  if (!form || form.status !== 'Published') return response.status(404).json({ error: 'Form not found.' });
  response.json({ form });
}));

app.post('/api/forms/:slug/responses', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const slug = String(request.params.slug ?? '').trim();
  const submittedResponse = request.body;
  if (!slug || !submittedResponse?.id || !submittedResponse?.answers) return response.status(400).json({ error: 'A valid response is required.' });
  const formResult = await db.query('select form from public_forms where slug = $1 limit 1', [slug]);
  const form = formResult.rows[0]?.form;
  if (!form || form.status !== 'Published') return response.status(404).json({ error: 'Form not found.' });
  await db.query(
    `insert into form_responses (id, form_slug, response, submitted_at)
     values ($1, $2, $3::jsonb, $4)
     on conflict (id) do nothing`,
    [String(submittedResponse.id), slug, JSON.stringify(submittedResponse), submittedResponse.submittedAt ?? new Date().toISOString()],
  );
  await applyPatientDataMappings(db, form, submittedResponse);
  response.status(201).json({ response: submittedResponse });
}));

app.get('/api/forms/:identifier/responses', requireIdentity, asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const identifier = String(request.params.identifier ?? '').trim();
  const formResult = await db.query('select slug, form from public_forms where slug = $1 or form_id = $1 limit 1', [identifier]);
  if (formResult.rows[0] && !request.identity.isAdmin && (formResult.rows[0].form.branch || 'Main Branch') !== request.identity.branch) return response.status(403).json({ error: 'Other branch data is unavailable.' });
  const slug = formResult.rows[0]?.slug;
  if (!slug) return response.json({ responses: [] });
  const result = await db.query('select response from form_responses where form_slug = $1 order by submitted_at desc', [slug]);
  response.json({ responses: result.rows.map((row) => row.response) });
}));

app.delete('/api/forms/:identifier/responses/:responseId', requireIdentity, asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const responseId = String(request.params.responseId ?? '').trim();
  const owner = await db.query('select f.form from form_responses r join public_forms f on f.slug = r.form_slug where r.id = $1', [responseId]);
  if (owner.rows[0] && !request.identity.isAdmin && (owner.rows[0].form.branch || 'Main Branch') !== request.identity.branch) return response.status(403).json({ error: 'Other branch data is unavailable.' });
  if (responseId) {
    await db.query('delete from form_responses where id = $1', [responseId]);
  }
  response.status(204).end();
}));


app.put('/api/attendance/forms/:slug', requireIdentity, asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const slug = String(request.params.slug ?? '').trim();
  const form = request.body;
  if (!slug || !form?.sessionId || !String(form?.title ?? '').trim()) return response.status(400).json({ error: 'A valid attendance form is required.' });
  const existing = await db.query('select form from public_attendance_forms where slug = $1', [slug]);
  if (existing.rows[0] && !request.identity.isAdmin && (existing.rows[0].form.branch || 'Main Branch') !== request.identity.branch) return response.status(403).json({ error: 'Other branch form is unavailable.' });
  await db.query(
    `insert into public_attendance_forms (slug, form, updated_at) values ($1, $2::jsonb, now())
     on conflict (slug) do update set form = excluded.form, updated_at = now()`,
    [slug, JSON.stringify({ ...form, slug, branch: request.identity.isAdmin ? (form.branch || 'Main Branch') : request.identity.branch })],
  );
  response.json({ form: { ...form, slug } });
}));

app.get('/api/attendance/forms/:slug', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const result = await db.query('select form from public_attendance_forms where slug = $1 limit 1', [String(request.params.slug ?? '')]);
  if (!result.rows[0]?.form) return response.status(404).json({ error: 'Attendance form not found.' });
  response.json({ form: result.rows[0].form });
}));

app.post('/api/attendance/forms/:slug/responses', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const slug = String(request.params.slug ?? '').trim();
  const submitted = request.body;
  if (!slug || !submitted?.id || !String(submitted?.name ?? '').trim()) return response.status(400).json({ error: 'Your name is required.' });
  const client = await db.connect();
  try {
    await client.query('begin');
    const formResult = await client.query('select form from public_attendance_forms where slug = $1 limit 1', [slug]);
    const form = formResult.rows[0]?.form;
    if (!form) { await client.query('rollback'); return response.status(404).json({ error: 'Attendance form not found.' }); }
    const inserted = await client.query(
      `insert into public_attendance_responses (id, form_slug, response, submitted_at) values ($1, $2, $3::jsonb, $4)
       on conflict (id) do nothing returning id`,
      [String(submitted.id), slug, JSON.stringify(submitted), submitted.submittedAt ?? new Date().toISOString()],
    );
    if (inserted.rowCount) {
      const attendanceKey = `moms-pathshala:${String(form.branch || 'Main Branch')}:attendance-sessions:v1`;
      const stateResult = await client.query('select value from app_state where branch = $1 and key = $2 for update', [WORKSPACE_BRANCH, attendanceKey]);
      const sessions = Array.isArray(stateResult.rows[0]?.value) ? stateResult.rows[0].value : [];
      const record = {
        id: String(submitted.id),
        name: String(submitted.name).trim(),
        mobile: String(submitted.mobile ?? '').trim(),
        source: 'Public Form',
        status: 'Present',
        note: submitted.note || 'Marked through public attendance form',
        answers: submitted.answers ?? {},
        submittedAt: submitted.submittedAt ?? new Date().toISOString(),
      };
      const sessionIndex = sessions.findIndex((session) => session.id === form.sessionId || session.publicSlug === slug);
      if (sessionIndex >= 0) sessions[sessionIndex] = { ...sessions[sessionIndex], records: [...(sessions[sessionIndex].records ?? []).filter((item) => item.id !== record.id), record] };
      else sessions.unshift({ id: form.sessionId, title: form.title, group: form.group ?? 'Mixed Group', date: form.date ?? '', time: form.time ?? '', mode: form.mode ?? 'Offline', notes: form.notes ?? '', publicSlug: slug, records: [record], createdAt: new Date().toISOString() });
      await client.query(
        `insert into app_state (branch, key, value, updated_at) values ($1, $2, $3::jsonb, now())
         on conflict (branch, key) do update set value = excluded.value, updated_at = now()`,
        [WORKSPACE_BRANCH, attendanceKey, JSON.stringify(sessions)],
      );
    }
    await client.query('commit');
    response.status(201).json({ response: submitted });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}));

app.use(express.static(distDir));

app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error.' });
});

async function startServer() {
  try {
    await ensureSchema();
  } catch (error) {
    console.error('PostgreSQL schema initialization failed:', error);
  }
  app.listen(port, () => {
    console.log(`Mom's Pathshala server listening on port ${port}`);
  });
}

startServer();
