-- Additive timeline migration. Safe to re-run. Does not rewrite existing rows.

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

alter table public.milestones enable row level security;

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

grant select, insert, update, delete on public.milestones to authenticated;

create index if not exists milestones_user_id_idx on public.milestones (user_id);
create index if not exists milestones_task_id_idx on public.milestones (task_id);
create index if not exists milestones_created_at_idx on public.milestones (task_id, created_at);
