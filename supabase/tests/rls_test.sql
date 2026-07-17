-- RLS policy regression tests (#45).
-- Run against a local Supabase stack with migrations applied:
--   supabase start
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- A failed ASSERT raises and psql exits non-zero, failing CI. Everything runs in
-- one transaction and is rolled back.

begin;

-- Mirror the base table grants Supabase provides in production, so the tests
-- exercise RLS (which sits on top of grants) rather than tripping on a missing
-- GRANT in the fresh local stack.
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
grant all on all sequences in schema public to authenticated, anon;

-- ── fixtures (as the superuser connection, which bypasses RLS) ──
-- Three users; profiles are created by the handle_new_user trigger.
insert into auth.users (id, email, aud, role)
values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.dev', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000002', 'viewer@test.dev', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-000000000003', 'stranger@test.dev', 'authenticated', 'authenticated');

insert into public.projects (id, owner_id, name)
values ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Shared');
insert into public.project_members (project_id, user_id, role)
values ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000002', 'viewer');
insert into public.tasks (id, creator_id, name)
values ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Owner task');
insert into public.task_projects (task_id, project_id)
values ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000009');

-- Act as a given user for subsequent statements.
create or replace function pg_temp.act(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- 1. Owner sees and can edit their task.
select pg_temp.act('a0000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from public.tasks where id = 'e0000000-0000-0000-0000-000000000010') = 1,
    'owner should see own task';
end $$;
reset role;

-- 2. Viewer member sees the shared task but CANNOT update it (#33).
select pg_temp.act('b0000000-0000-0000-0000-000000000002');
do $$ begin
  assert exists (select 1 from public.tasks where id = 'e0000000-0000-0000-0000-000000000010'),
    'member should see the shared task';
end $$;
do $$ declare n int; begin
  update public.tasks set name = 'hacked' where id = 'e0000000-0000-0000-0000-000000000010';
  get diagnostics n = row_count;
  assert n = 0, 'viewer must not be able to update tasks';
end $$;
reset role;

-- 3. Stranger cannot see the task at all.
select pg_temp.act('c0000000-0000-0000-0000-000000000003');
do $$ begin
  assert not exists (select 1 from public.tasks where id = 'e0000000-0000-0000-0000-000000000010'),
    'stranger must not see the task';
end $$;
reset role;

-- 4. Profiles are not world-readable: stranger sees only themselves (#32).
select pg_temp.act('c0000000-0000-0000-0000-000000000003');
do $$ begin
  assert (select count(*) from public.profiles) = 1,
    'stranger should see only their own profile';
end $$;
reset role;

-- 5. A user cannot create a collaborator link on someone else's behalf.
select pg_temp.act('c0000000-0000-0000-0000-000000000003');
do $$ declare inserted boolean := false; begin
  begin
    insert into public.collaborators (user_id, collaborator_id)
    values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003');
    inserted := true;
  exception when others then inserted := false; end;
  assert not inserted, 'must not insert a collaborator row for another user';
end $$;
reset role;

-- 6. creator_id is immutable (#33): owner cannot reassign creator.
select pg_temp.act('a0000000-0000-0000-0000-000000000001');
do $$ declare failed boolean := false; begin
  begin
    update public.tasks set creator_id = 'c0000000-0000-0000-0000-000000000003'
    where id = 'e0000000-0000-0000-0000-000000000010';
  exception when others then failed := true; end;
  assert failed, 'creator_id must be immutable';
end $$;
reset role;

do $$ begin raise notice 'RLS tests passed'; end $$;

rollback;
