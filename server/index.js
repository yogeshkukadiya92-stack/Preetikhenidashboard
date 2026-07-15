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
}

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
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
  const branch = String(request.query.branch ?? 'workspace');
  const result = await db.query(
    'select key, value, updated_at from app_state where branch = $1 order by key',
    [branch],
  );
  response.json(result.rows);
}));

app.put('/api/app-state/:key', asyncHandler(async (request, response) => {
  const db = getPool();
  if (!db) return response.status(503).json({ error: 'PostgreSQL is not configured.' });
  const branch = String(request.body?.branch ?? 'workspace');
  const key = String(request.params.key ?? '').trim();
  if (!key) return response.status(400).json({ error: 'State key is required.' });
  const value = request.body?.value;
  if (value === undefined) return response.status(400).json({ error: 'State value is required.' });
  await db.query(
    `insert into app_state (branch, key, value, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (branch, key)
     do update set value = excluded.value, updated_at = now()`,
    [branch, key, JSON.stringify(value)],
  );
  response.status(204).end();
}));

app.use(express.static(distDir));

app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error.' });
});

await ensureSchema();

app.listen(port, () => {
  console.log(`Mom's Pathshala server listening on port ${port}`);
});
