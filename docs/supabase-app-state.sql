create table if not exists public.app_state (
  branch text not null default 'workspace',
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (branch, key)
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_select_shared_workspace" on public.app_state;
create policy "app_state_select_shared_workspace"
  on public.app_state
  for select
  to anon, authenticated
  using (branch = 'workspace');

drop policy if exists "app_state_insert_shared_workspace" on public.app_state;
create policy "app_state_insert_shared_workspace"
  on public.app_state
  for insert
  to anon, authenticated
  with check (branch = 'workspace');

drop policy if exists "app_state_update_shared_workspace" on public.app_state;
create policy "app_state_update_shared_workspace"
  on public.app_state
  for update
  to anon, authenticated
  using (branch = 'workspace')
  with check (branch = 'workspace');
