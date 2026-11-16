-- Focus Room timer schema.
-- Paste into the Supabase SQL Editor and run once.
-- Safe to re-run: tables are created only if missing, policies are replaced.

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  archived boolean not null default false
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  constraint sessions_end_reason_check check (end_reason in ('pause', 'stop'))
);

alter table public.sessions
  add column if not exists end_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_end_reason_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_end_reason_check
      check (end_reason in ('pause', 'stop'));
  end if;
end $$;

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.milestones enable row level security;

drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_insert_own on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
drop policy if exists tasks_delete_own on public.tasks;

create policy tasks_select_own
  on public.tasks
  for select
  to authenticated
  using (user_id = auth.uid());

create policy tasks_insert_own
  on public.tasks
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy tasks_update_own
  on public.tasks
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy tasks_delete_own
  on public.tasks
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists sessions_select_own on public.sessions;
drop policy if exists sessions_insert_own on public.sessions;
drop policy if exists sessions_update_own on public.sessions;
drop policy if exists sessions_delete_own on public.sessions;

create policy sessions_select_own
  on public.sessions
  for select
  to authenticated
  using (user_id = auth.uid());

create policy sessions_insert_own
  on public.sessions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks
      where tasks.id = task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy sessions_update_own
  on public.sessions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks
      where tasks.id = task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy sessions_delete_own
  on public.sessions
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists milestones_select_own on public.milestones;
drop policy if exists milestones_insert_own on public.milestones;
drop policy if exists milestones_update_own on public.milestones;
drop policy if exists milestones_delete_own on public.milestones;

create policy milestones_select_own
  on public.milestones
  for select
  to authenticated
  using (user_id = auth.uid());

create policy milestones_insert_own
  on public.milestones
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks
      where tasks.id = task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy milestones_update_own
  on public.milestones
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks
      where tasks.id = task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy milestones_delete_own
  on public.milestones
  for delete
  to authenticated
  using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.milestones to authenticated;

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_task_id_idx on public.sessions (task_id);
create index if not exists sessions_open_idx on public.sessions (user_id) where ended_at is null;
create index if not exists milestones_user_id_idx on public.milestones (user_id);
create index if not exists milestones_task_id_idx on public.milestones (task_id);
create index if not exists milestones_created_at_idx on public.milestones (task_id, created_at);
