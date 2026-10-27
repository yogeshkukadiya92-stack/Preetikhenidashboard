# PostgreSQL Deployment

## Production application

The live clinic is https://dashboard.shreeayurvedhospital.in. Coolify application
`me86ksda5ecm4kp84pha9nl8` serves this domain on container port 3000.
The historical `https://pn.yogeshaihub.in` address is also mapped to the same application
on port 3000. Restore both domain entries in Coolify when migrating or recreating the resource.
Check `/api/health` on each domain to confirm both application and database readiness.


Mom's Pathshala now uses the app's Node server for shared live data:

- Frontend writes dashboard state to `/api/app-state/:key`.
- The Node server stores state in PostgreSQL table `app_state`.
- The server creates the table automatically on startup.

## Coolify

Use these commands:

```sh
npm install
npm run build
npm run start
```

Set these environment variables:

```sh
DATABASE_URL=postgresql://user:password@host:5432/database
POSTGRES_SSL=false
PORT=3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_SHA256=<sha256-password-hash>
```

When using a Coolify PostgreSQL resource on the same network, use the internal database URL Coolify provides. Keep `POSTGRES_SSL=false` unless the database explicitly requires SSL.
The admin credentials must be available to the running Node server. Existing deployments that already set `VITE_ADMIN_PASSWORD_SHA256` remain compatible, but should move the hash to `ADMIN_PASSWORD_SHA256` so it is no longer treated as a frontend build setting.

## Data Table

The server creates this table if missing:

```sql
create table if not exists app_state (
  branch text not null default 'workspace',
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (branch, key)
);
```
