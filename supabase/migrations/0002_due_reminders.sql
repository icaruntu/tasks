-- Hourly due-date reminders: notify owner + assignee of due-soon / overdue tasks.
create extension if not exists pg_cron;

create or replace function public.generate_due_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  inserted integer := 0;
begin
  with recipients as (
    select distinct
      t.id as task_id,
      t.name,
      r.uid as user_id,
      (case when t.due_date < now() then 'overdue' else 'due_soon' end)::notification_type as ntype,
      (case when t.due_date < now() then 'Task overdue' else 'Task due soon' end) as title
    from public.tasks t
    cross join lateral (values (t.creator_id), (t.assignee_id)) as r(uid)
    where not t.completed
      and t.parent_task_id is null
      and t.due_date is not null
      and t.due_date < now() + interval '24 hours'
      and r.uid is not null
  ),
  fresh as (
    select rc.* from recipients rc
    where not exists (
      select 1 from public.notifications n
      where n.user_id = rc.user_id
        and n.task_id = rc.task_id
        and n.type = rc.ntype
        and n.created_at > now() - interval '20 hours'
    )
  ),
  ins as (
    insert into public.notifications (user_id, task_id, type, title, body)
    select user_id, task_id, ntype, title, name from fresh
    returning 1
  )
  select count(*) into inserted from ins;
  return inserted;
end;
$$;

revoke execute on function public.generate_due_reminders() from anon, authenticated, public;

select cron.schedule(
  'taskflow-due-reminders',
  '0 * * * *',
  $$ select public.generate_due_reminders(); $$
);
