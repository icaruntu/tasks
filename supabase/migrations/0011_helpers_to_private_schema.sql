-- #35: move the RLS policy-helper functions out of the PostgREST-exposed
-- `public` schema into `private`, so they can't be called as /rpc endpoints
-- (the access-oracle residual) while RLS policies still reference them by
-- qualified name. `authenticated` keeps EXECUTE (RLS evaluates as the caller),
-- but PostgREST does not serve functions outside its exposed schemas.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_project_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid());
$$;
create or replace function private.is_project_owner(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid());
$$;
create or replace function private.is_project_editor(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid() and m.role in ('owner','editor'));
$$;
create or replace function private.can_access_task(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, creator_id, assignee_id, parent_task_id from tasks where id = tid
    union all
    select t.id, t.creator_id, t.assignee_id, t.parent_task_id from tasks t join chain c on t.id = c.parent_task_id
  )
  select exists (select 1 from chain where creator_id = auth.uid() or assignee_id = auth.uid())
      or exists (select 1 from task_projects tp join chain c on c.id = tp.task_id where private.is_project_member(tp.project_id));
$$;
create or replace function private.can_edit_task(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, creator_id, assignee_id, parent_task_id from tasks where id = tid
    union all
    select t.id, t.creator_id, t.assignee_id, t.parent_task_id from tasks t join chain c on t.id = c.parent_task_id
  )
  select exists (select 1 from chain where creator_id = auth.uid() or assignee_id = auth.uid())
      or exists (select 1 from task_projects tp join chain c on c.id = tp.task_id where private.is_project_editor(tp.project_id));
$$;
create or replace function private.can_see_profile(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pid = auth.uid()
    or exists (select 1 from collaborators c where (c.user_id = auth.uid() and c.collaborator_id = pid) or (c.collaborator_id = auth.uid() and c.user_id = pid))
    or exists (
      with mine as (select id from projects where owner_id = auth.uid() union select project_id from project_members where user_id = auth.uid()),
           theirs as (select id from projects where owner_id = pid union select project_id from project_members where user_id = pid)
      select 1 from mine join theirs on mine.id = theirs.id);
$$;
create or replace function private.user_can_access_task(uid uuid, tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, creator_id, assignee_id, parent_task_id from tasks where id = tid
    union all
    select t.id, t.creator_id, t.assignee_id, t.parent_task_id from tasks t join chain c on t.id = c.parent_task_id
  )
  select exists (select 1 from chain where creator_id = uid or assignee_id = uid)
      or exists (select 1 from task_projects tp join chain c on c.id = tp.task_id join projects p on p.id = tp.project_id
                 where p.owner_id = uid or exists (select 1 from project_members m where m.project_id = tp.project_id and m.user_id = uid));
$$;
grant execute on function private.is_project_member(uuid), private.is_project_owner(uuid), private.is_project_editor(uuid),
  private.can_access_task(uuid), private.can_edit_task(uuid), private.can_see_profile(uuid), private.user_can_access_task(uuid,uuid)
  to authenticated;

-- Repoint every policy that referenced a public helper to its private twin.
alter policy projects_select on public.projects using (private.is_project_member(id));
alter policy members_select on public.project_members using (private.is_project_member(project_id));
alter policy members_insert on public.project_members with check (private.is_project_owner(project_id));
alter policy members_update on public.project_members using (private.is_project_owner(project_id)) with check (private.is_project_owner(project_id));
alter policy members_delete on public.project_members using (private.is_project_owner(project_id) or user_id = auth.uid());
alter policy tasks_select on public.tasks using (creator_id = auth.uid() or assignee_id = auth.uid() or private.can_access_task(id));
alter policy tasks_update on public.tasks using (private.can_edit_task(id)) with check (private.can_edit_task(id));
alter policy task_projects_select on public.task_projects using (private.can_access_task(task_id));
alter policy task_projects_insert on public.task_projects with check (private.can_edit_task(task_id) and private.is_project_member(project_id));
alter policy task_projects_delete on public.task_projects using (private.can_edit_task(task_id));
alter policy comments_select on public.comments using (private.can_access_task(task_id));
alter policy comments_insert on public.comments with check (author_id = auth.uid() and private.can_access_task(task_id));
alter policy mentions_select on public.comment_mentions using (exists (select 1 from comments c where c.id = comment_id and private.can_access_task(c.task_id)));
alter policy mentions_insert on public.comment_mentions with check (exists (select 1 from comments c where c.id = comment_id and c.author_id = auth.uid()) and private.user_can_access_task(mentioned_user_id, (select task_id from comments where id = comment_id)));
alter policy attachments_select on public.attachments using (private.can_access_task(task_id));
alter policy attachments_insert on public.attachments with check (uploaded_by = auth.uid() and private.can_access_task(task_id));
alter policy profiles_select_connected on public.profiles using (private.can_see_profile(id));
alter policy attachments_read on storage.objects using (bucket_id = 'attachments' and private.can_access_task((split_part(name, '/', 1))::uuid));
alter policy attachments_upload on storage.objects with check (bucket_id = 'attachments' and private.can_access_task((split_part(name, '/', 1))::uuid));

-- Repoint the SECURITY DEFINER functions that call the helpers.
create or replace function public.set_task_projects(p_task_id uuid, p_project_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.can_edit_task(p_task_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from task_projects where task_id = p_task_id;
  insert into task_projects (task_id, project_id) select p_task_id, pid from unnest(p_project_ids) as pid where private.is_project_member(pid);
end; $$;
create or replace function public.notify_on_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select tasks.id, tasks.name into t from public.comments c join public.tasks on tasks.id = c.task_id where c.id = new.comment_id;
  if private.user_can_access_task(new.mentioned_user_id, t.id) then
    insert into public.notifications (user_id, task_id, type, title, body) values (new.mentioned_user_id, t.id, 'mentioned', 'You were mentioned', t.name);
  end if;
  return new;
end; $$;

-- Remove the exposed public helpers.
drop function public.can_access_task(uuid);
drop function public.can_edit_task(uuid);
drop function public.can_see_profile(uuid);
drop function public.user_can_access_task(uuid, uuid);
drop function public.is_project_member(uuid);
drop function public.is_project_owner(uuid);
drop function public.is_project_editor(uuid);
