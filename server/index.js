import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '';
const WORKSPACE_BRANCH = 'shreeayurved09@gmail.com';
const PATIENTS_STATE_KEY = 'moms-pathshala:Main Branch:ayurflow-clients:rows:v3';
const PATIENT_UPDATES_STATE_KEY = 'moms-pathshala:Main Branch:patient-form-updates:v1';
const ATTENDANCE_STATE_KEY = 'moms-pathshala:Main Branch:attendance-sessions:v1';

const app = express();
app.use(express.json({ limit: '2mb' }));

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

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
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
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const mobileField = fields.find((field) => field.dataTarget === 'patient_mobile');
  const mobile = normalizePhone(submittedResponse.answers?.[mobileField?.id]);
  if (!mobile) return;

  const patientResult = await db.query(
    'select value from app_state where branch = $1 and key = $2 limit 1',
    [WORKSPACE_BRANCH, PATIENTS_STATE_KEY],
  );
  const patients = Array.isArray(patientResult.rows[0]?.value) ? patientResult.rows[0].value : [];
  const matchedRow = patients.find((row) => normalizePhone(patientDetails(row).mobile) === mobile);
  if (!matchedRow) return;
  const patient = patientDetails(matchedRow);

  const updates = fields.filter((field) => field.dataTarget === 'patient_weight').flatMap((field) => {
    const value = Number(String(submittedResponse.answers?.[field.id] ?? '').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(value) || value <= 0) return [];
    return [{
      id: `${submittedResponse.id}:${field.id}`,
      patientId: patient.id,
      patientName: patient.name,
      mobile,
      type: 'weight',
      value,
      unit: 'kg',
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
    [WORKSPACE_BRANCH, PATIENT_UPDATES_STATE_KEY],
  );
  const current = Array.isArray(currentResult.rows[0]?.value) ? currentResult.rows[0].value : [];
  const ids = new Set(current.map((item) => item.id));
  const next = [...updates.filter((item) => !ids.has(item.id)), ...current];
  await db.query(
    `insert into app_state (branch, key, value, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (branch, key)
     do update set value = excluded.value, updated_at = now()`,
    [WORKSPACE_BRANCH, PATIENT_UPDATES_STATE_KEY, JSON.stringify(next)],
  );
}

app.get('/api/health', asyncHandler(async (_request, response) => {
  const db = getPool();
  if (!db) return response.json({ ok: true, database: false });
  await db.query('select 1');
  response.json({ ok: true, database: true });
}));

app.get('/api/app-state', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const result = await db.query(
    'select key, value, updated_at from app_state where branch = $1 order by key',
    [WORKSPACE_BRANCH],
  );
  response.json(result.rows);
}));

app.put('/api/app-state/:key', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const key = String(request.params.key ?? '').trim();
  if (!key) return response.status(400).json({ error: 'State key is required.' });
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

app.put('/api/forms/:slug', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const slug = String(request.params.slug ?? '').trim();
  const form = request.body;
  if (!slug || !form?.id || !form?.title) return response.status(400).json({ error: 'A valid form is required.' });
  await db.query(
    `insert into public_forms (slug, form_id, form, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (slug)
     do update set form_id = excluded.form_id, form = excluded.form, updated_at = now()`,
    [slug, String(form.id), JSON.stringify({ ...form, slug })],
  );
  response.json({ form: { ...form, slug } });
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

app.get('/api/forms/:identifier/responses', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const identifier = String(request.params.identifier ?? '').trim();
  const formResult = await db.query('select slug from public_forms where slug = $1 or form_id = $1 limit 1', [identifier]);
  const slug = formResult.rows[0]?.slug;
  if (!slug) return response.json({ responses: [] });
  const result = await db.query('select response from form_responses where form_slug = $1 order by submitted_at desc', [slug]);
  response.json({ responses: result.rows.map((row) => row.response) });
}));

app.put('/api/attendance/forms/:slug', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const slug = String(request.params.slug ?? '').trim();
  const form = request.body;
  if (!slug || !form?.sessionId || !String(form?.title ?? '').trim()) return response.status(400).json({ error: 'A valid attendance form is required.' });
  await db.query(
    `insert into public_attendance_forms (slug, form, updated_at) values ($1, $2::jsonb, now())
     on conflict (slug) do update set form = excluded.form, updated_at = now()`,
    [slug, JSON.stringify({ ...form, slug })],
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
      const stateResult = await client.query('select value from app_state where branch = $1 and key = $2 for update', [WORKSPACE_BRANCH, ATTENDANCE_STATE_KEY]);
      const sessions = Array.isArray(stateResult.rows[0]?.value) ? stateResult.rows[0].value : [];
      const record = { id: String(submitted.id), name: String(submitted.name).trim(), mobile: String(submitted.mobile ?? '').trim(), source: 'Public Form', status: 'Present', note: 'Marked through public attendance form', submittedAt: submitted.submittedAt ?? new Date().toISOString() };
      const sessionIndex = sessions.findIndex((session) => session.id === form.sessionId || session.publicSlug === slug);
      if (sessionIndex >= 0) sessions[sessionIndex] = { ...sessions[sessionIndex], records: [...(sessions[sessionIndex].records ?? []).filter((item) => item.id !== record.id), record] };
      else sessions.unshift({ id: form.sessionId, title: form.title, group: form.group ?? 'Mixed Group', date: form.date ?? '', time: form.time ?? '', mode: form.mode ?? 'Offline', notes: form.notes ?? '', publicSlug: slug, records: [record], createdAt: new Date().toISOString() });
      await client.query(
        `insert into app_state (branch, key, value, updated_at) values ($1, $2, $3::jsonb, now())
         on conflict (branch, key) do update set value = excluded.value, updated_at = now()`,
        [WORKSPACE_BRANCH, ATTENDANCE_STATE_KEY, JSON.stringify(sessions)],
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
