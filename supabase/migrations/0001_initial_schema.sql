-- TaskFlow — full schema (tables, RLS, storage, notification triggers).
-- Apply with `supabase db push` or paste into the Supabase SQL editor.

-- ========================= Enums & helpers =========================
create type task_priority as enum ('high', 'medium', 'low');
create type member_role as enum ('owner', 'editor', 'viewer');
create type notification_type as enum ('due_soon', 'overdue', 'assigned', 'mentioned', 'comment', 'daily_digest');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========================= Profiles =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========================= Core tables =========================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  position double precision not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sections_set_updated_at before update on public.sections
  for each row execute function public.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  section_id uuid references public.sections(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  name text not null,
  description text,
  priority task_priority,
  due_date timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  position double precision not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create index tasks_section_idx on public.tasks(section_id);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index tasks_creator_idx on public.tasks(creator_id);
create index tasks_parent_idx on public.tasks(parent_task_id);
create index tasks_due_idx on public.tasks(due_date);

create or replace function public.sync_task_completed_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.completed and (old.completed is distinct from new.completed) then
    new.completed_at = now();
  elsif not new.completed then
    new.completed_at = null;
  end if;
  return new;
end;
$$;
create trigger tasks_sync_completed before insert or update on public.tasks
  for each row execute function public.sync_task_completed_at();

create table public.task_projects (
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, project_id)
);
create index task_projects_project_idx on public.task_projects(project_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();
create index comments_task_idx on public.comments(task_id);

create table public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (comment_id, mentioned_user_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);
create index attachments_task_idx on public.attachments(task_id);

create table public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  kind text not null default 'work' check (kind in ('work','short_break','long_break')),
  duration_seconds integer not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  completed boolean not null default false
);
create index pomodoro_user_idx on public.pomodoro_sessions(user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read_at);

-- ========================= RLS helper functions =========================
create or replace function public.is_project_member(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid());
$$;

create or replace function public.is_project_owner(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid());
$$;

create or replace function public.can_access_task(tid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  with recursive chain as (
    select id, creator_id, assignee_id, parent_task_id from tasks where id = tid
    union all
    select t.id, t.creator_id, t.assignee_id, t.parent_task_id
    from tasks t join chain c on t.id = c.parent_task_id
  )
  select exists (select 1 from chain where creator_id = auth.uid() or assignee_id = auth.uid())
      or exists (select 1 from task_projects tp join chain c on c.id = tp.task_id
                 where public.is_project_member(tp.project_id));
$$;

-- ========================= RLS policies =========================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;
alter table public.task_projects enable row level security;
alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.attachments enable row level security;
alter table public.pomodoro_sessions enable row level security;
alter table public.notifications enable row level security;

create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "projects_select" on public.projects for select to authenticated using (public.is_project_member(id));
create policy "projects_insert" on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy "projects_update" on public.projects for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects_delete" on public.projects for delete to authenticated using (owner_id = auth.uid());

create policy "members_select" on public.project_members for select to authenticated using (public.is_project_member(project_id));
create policy "members_insert" on public.project_members for insert to authenticated with check (public.is_project_owner(project_id));
create policy "members_update" on public.project_members for update to authenticated using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy "members_delete" on public.project_members for delete to authenticated using (public.is_project_owner(project_id) or user_id = auth.uid());

create policy "sections_all" on public.sections for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "tasks_select" on public.tasks for select to authenticated using (public.can_access_task(id));
create policy "tasks_insert" on public.tasks for insert to authenticated with check (creator_id = auth.uid());
create policy "tasks_update" on public.tasks for update to authenticated using (public.can_access_task(id)) with check (public.can_access_task(id));
create policy "tasks_delete" on public.tasks for delete to authenticated using (creator_id = auth.uid());

create policy "task_projects_select" on public.task_projects for select to authenticated using (public.can_access_task(task_id));
create policy "task_projects_insert" on public.task_projects for insert to authenticated with check (public.can_access_task(task_id) and public.is_project_member(project_id));
create policy "task_projects_delete" on public.task_projects for delete to authenticated using (public.can_access_task(task_id));

create policy "comments_select" on public.comments for select to authenticated using (public.can_access_task(task_id));
create policy "comments_insert" on public.comments for insert to authenticated with check (author_id = auth.uid() and public.can_access_task(task_id));
create policy "comments_update" on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "comments_delete" on public.comments for delete to authenticated using (author_id = auth.uid());

create policy "mentions_select" on public.comment_mentions for select to authenticated
  using (exists (select 1 from comments c where c.id = comment_id and public.can_access_task(c.task_id)));
create policy "mentions_insert" on public.comment_mentions for insert to authenticated
  with check (exists (select 1 from comments c where c.id = comment_id and c.author_id = auth.uid()));
create policy "mentions_delete" on public.comment_mentions for delete to authenticated
  using (exists (select 1 from comments c where c.id = comment_id and c.author_id = auth.uid()));

create policy "attachments_select" on public.attachments for select to authenticated using (public.can_access_task(task_id));
create policy "attachments_insert" on public.attachments for insert to authenticated with check (uploaded_by = auth.uid() and public.can_access_task(task_id));
create policy "attachments_delete" on public.attachments for delete to authenticated using (uploaded_by = auth.uid());

create policy "pomodoro_all" on public.pomodoro_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications_select" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_insert" on public.notifications for insert to authenticated with check (user_id = auth.uid());
create policy "notifications_delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ========================= Storage (attachments bucket) =========================
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

create policy "attachments_read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_access_task((split_part(name, '/', 1))::uuid));
create policy "attachments_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_access_task((split_part(name, '/', 1))::uuid));
create policy "attachments_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and owner = auth.uid());

-- ========================= Notification triggers =========================
create or replace function public.notify_on_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from coalesce(old.assignee_id, '00000000-0000-0000-0000-000000000000')
     and new.assignee_id <> new.creator_id then
    insert into public.notifications (user_id, task_id, type, title, body)
    values (new.assignee_id, new.id, 'assigned', 'You were assigned a task', new.name);
  end if;
  return new;
end;
$$;
create trigger tasks_notify_assignment after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_on_assignment();

create or replace function public.notify_on_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select tasks.id, tasks.name into t
  from public.comments c join public.tasks on tasks.id = c.task_id
  where c.id = new.comment_id;
  insert into public.notifications (user_id, task_id, type, title, body)
  values (new.mentioned_user_id, t.id, 'mentioned', 'You were mentioned', t.name);
  return new;
end;
$$;
create trigger mentions_notify after insert on public.comment_mentions
  for each row execute function public.notify_on_mention();

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record; recipient uuid;
begin
  select creator_id, assignee_id, name into t from public.tasks where id = new.task_id;
  for recipient in select unnest(array[t.creator_id, t.assignee_id]) as uid loop
    if recipient is not null and recipient <> new.author_id then
      insert into public.notifications (user_id, task_id, type, title, body)
      values (recipient, new.task_id, 'comment', 'New comment', t.name)
      on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_on_comment();
