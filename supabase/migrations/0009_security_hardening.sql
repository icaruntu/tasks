-- Security hardening from the review (#32–#36) plus an atomic task↔project RPC (#30).

-- ── #32: profiles are no longer world-readable to any authenticated user ──
-- Only self, collaborators (either direction), and people you share a project
-- with are visible.
create or replace function public.can_see_profile(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pid = auth.uid()
    or exists (select 1 from collaborators c
      where (c.user_id = auth.uid() and c.collaborator_id = pid)
         or (c.collaborator_id = auth.uid() and c.user_id = pid))
    or exists (
      with mine as (
        select id from projects where owner_id = auth.uid()
        union select project_id from project_members where user_id = auth.uid()
      ), theirs as (
        select id from projects where owner_id = pid
        union select project_id from project_members where user_id = pid
      )
      select 1 from mine join theirs on mine.id = theirs.id);
$$;
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_connected on public.profiles for select to authenticated
  using (public.can_see_profile(id));

-- ── #33: task edits require editor rights; creator_id is immutable ──
create or replace function public.is_project_editor(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m
                 where m.project_id = pid and m.user_id = auth.uid()
                   and m.role in ('owner','editor'));
$$;

create or replace function public.can_edit_task(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, creator_id, assignee_id, parent_task_id from tasks where id = tid
    union all
    select t.id, t.creator_id, t.assignee_id, t.parent_task_id
    from tasks t join chain c on t.id = c.parent_task_id
  )
  select exists (select 1 from chain where creator_id = auth.uid() or assignee_id = auth.uid())
      or exists (select 1 from task_projects tp join chain c on c.id = tp.task_id
                 where public.is_project_editor(tp.project_id));
$$;

create or replace function public.lock_task_creator()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.creator_id is distinct from old.creator_id then
    raise exception 'creator_id is immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_lock_creator on public.tasks;
create trigger tasks_lock_creator before update on public.tasks
  for each row execute function public.lock_task_creator();

alter policy tasks_update on public.tasks
  using (public.can_edit_task(id)) with check (public.can_edit_task(id));
-- Managing project links is an edit too — viewers can no longer attach/detach.
alter policy task_projects_insert on public.task_projects
  with check (public.can_edit_task(task_id) and public.is_project_member(project_id));
alter policy task_projects_delete on public.task_projects
  using (public.can_edit_task(task_id));

-- ── #34: mentions can only target users who can access the task ──
create or replace function public.user_can_access_task(uid uuid, tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, creator_id, assignee_id, parent_task_id from tasks where id = tid
    union all
    select t.id, t.creator_id, t.assignee_id, t.parent_task_id
    from tasks t join chain c on t.id = c.parent_task_id
  )
  select exists (select 1 from chain where creator_id = uid or assignee_id = uid)
      or exists (
        select 1 from task_projects tp join chain c on c.id = tp.task_id
        join projects p on p.id = tp.project_id
        where p.owner_id = uid
           or exists (select 1 from project_members m
                      where m.project_id = tp.project_id and m.user_id = uid));
$$;
alter policy mentions_insert on public.comment_mentions with check (
  exists (select 1 from comments c where c.id = comment_id and c.author_id = auth.uid())
  and public.user_can_access_task(mentioned_user_id, (select task_id from comments where id = comment_id))
);
-- Defence in depth: the notify trigger also verifies access before writing a
-- notification that would leak the task name.
create or replace function public.notify_on_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select tasks.id, tasks.name into t
  from public.comments c join public.tasks on tasks.id = c.task_id
  where c.id = new.comment_id;
  if public.user_can_access_task(new.mentioned_user_id, t.id) then
    insert into public.notifications (user_id, task_id, type, title, body)
    values (new.mentioned_user_id, t.id, 'mentioned', 'You were mentioned', t.name);
  end if;
  return new;
end;
$$;

-- ── #30: atomic replace of a task's project links (client RPC) ──
create or replace function public.set_task_projects(p_task_id uuid, p_project_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_task(p_task_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from task_projects where task_id = p_task_id;
  insert into task_projects (task_id, project_id)
    select p_task_id, pid from unnest(p_project_ids) as pid
    where public.is_project_member(pid);
end;
$$;

-- ── #35: SECURITY DEFINER helpers must not be callable as public RPC ──
-- IMPORTANT: RLS policy expressions evaluate as the *calling* role, so any
-- helper a policy references (can_access_task, can_edit_task, can_see_profile,
-- user_can_access_task, is_project_member/owner/editor) MUST keep EXECUTE for
-- `authenticated` or every policy that uses it fails with "permission denied".
-- We therefore only revoke the trigger-only functions, which are never
-- referenced by a policy and are never meant to be client-callable.
-- (Removing the residual /rpc exposure of the policy helpers themselves — a
-- low-severity boolean access oracle — requires moving them to an unexposed
-- schema; tracked as a follow-up.)
revoke execute on function public.notify_on_assignment() from anon, authenticated, public;
revoke execute on function public.notify_on_comment() from anon, authenticated, public;
revoke execute on function public.notify_on_mention() from anon, authenticated, public;
revoke execute on function public.regenerate_recurring_task() from anon, authenticated, public;
revoke execute on function public.enforce_project_limit() from anon, authenticated, public;
revoke execute on function public.enforce_member_limit() from anon, authenticated, public;
revoke execute on function public.lock_task_creator() from anon, authenticated, public;
-- set_task_projects is an intentional client RPC.
grant execute on function public.set_task_projects(uuid, uuid[]) to authenticated;

-- ── #36: attachment bucket limits (25 MB, safe mime types) ──
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/png','image/jpeg','image/gif','image/webp','image/heic',
      'application/pdf','text/plain','text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip'
    ]
where id = 'attachments';
