-- Fix: creating tasks/projects from the app silently failed on the deployed build.
-- PostgREST's .insert().select() runs INSERT ... RETURNING, and the RETURNING row
-- must pass the table's SELECT policy. tasks_select/projects_select relied solely on
-- helper functions (can_access_task / is_project_member) whose subqueries execute
-- against the statement snapshot taken *before* the INSERT — the brand-new row is
-- invisible to them, so the visibility check failed with
-- "new row violates row-level security policy" (HTTP 403).
-- Sections worked because sections_all checks owner_id = auth.uid() directly on the row.
--
-- Fix: add direct row-level checks so a creator/owner always sees their own row
-- (also a small perf win: the helper functions now short-circuit for own rows).
alter policy tasks_select on public.tasks
  using (creator_id = auth.uid() or assignee_id = auth.uid() or public.can_access_task(id));
alter policy projects_select on public.projects
  using (owner_id = auth.uid() or public.is_project_member(id));
