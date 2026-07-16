-- Server-side enforcement of Free-plan caps (backstop for the client pre-checks).
create or replace function public.user_plan(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when s.status in ('active','trialing','past_due') then s.plan else 'free' end
  from public.subscriptions s where s.user_id = uid;
$$;
revoke execute on function public.user_plan(uuid) from anon, authenticated, public;

-- Free plan: max 5 projects per owner.
create or replace function public.enforce_project_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  if coalesce(public.user_plan(new.owner_id), 'free') = 'free' then
    select count(*) into cnt from public.projects where owner_id = new.owner_id;
    if cnt >= 5 then
      raise exception 'Free plan is limited to 5 projects. Upgrade to add more.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists projects_enforce_limit on public.projects;
create trigger projects_enforce_limit before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- Free plan: max 2 collaborators per project.
create or replace function public.enforce_member_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_uid uuid; cnt int;
begin
  select owner_id into owner_uid from public.projects where id = new.project_id;
  if coalesce(public.user_plan(owner_uid), 'free') = 'free' then
    select count(*) into cnt from public.project_members where project_id = new.project_id;
    if cnt >= 2 then
      raise exception 'Free plan is limited to 2 collaborators per project. Upgrade to add more.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists members_enforce_limit on public.project_members;
create trigger members_enforce_limit before insert on public.project_members
  for each row execute function public.enforce_member_limit();
