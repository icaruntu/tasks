-- Collaborators (#38/#39): explicit, user-managed list of people you work with.
-- Pickers (mentions, share, assignee) are restricted to these + project members.
create table public.collaborators (
  user_id uuid not null references public.profiles(id) on delete cascade,
  collaborator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, collaborator_id),
  check (user_id <> collaborator_id)
);
create index collaborators_collaborator_idx on public.collaborators(collaborator_id);

alter table public.collaborators enable row level security;
-- Both sides can see the link; only the initiating user manages it.
create policy "collaborators_select" on public.collaborators for select to authenticated
  using (user_id = auth.uid() or collaborator_id = auth.uid());
create policy "collaborators_insert" on public.collaborators for insert to authenticated
  with check (user_id = auth.uid());
create policy "collaborators_delete" on public.collaborators for delete to authenticated
  using (user_id = auth.uid());

-- Per-user Pomodoro durations (#39), editable via the existing profiles_update_own policy.
alter table public.profiles
  add column pomodoro_work_minutes integer not null default 25
    check (pomodoro_work_minutes between 1 and 180),
  add column pomodoro_short_break_minutes integer not null default 5
    check (pomodoro_short_break_minutes between 1 and 60),
  add column pomodoro_long_break_minutes integer not null default 15
    check (pomodoro_long_break_minutes between 1 and 120);
