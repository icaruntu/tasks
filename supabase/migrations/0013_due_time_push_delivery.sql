-- Send a separate reminder at the exact due timestamp (the existing
-- `due_soon` reminder remains useful 24 hours beforehand).
alter type public.notification_type add value if not exists 'due';

create extension if not exists pg_net with schema extensions;

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
      (case
        when t.due_date <= now() then 'due'
        else 'due_soon'
      end)::notification_type as ntype,
      (case
        when t.due_date <= now() then 'Task due now'
        else 'Task due soon'
      end) as title
    from public.tasks t
    cross join lateral (values (t.creator_id), (t.assignee_id)) as r(uid)
    where not t.completed
      and t.due_date is not null
      -- The five-minute grace period survives a temporarily delayed cron run.
      and t.due_date > now() - interval '5 minutes'
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

-- The former hourly cadence cannot deliver a reminder at the selected time.
do $$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'taskflow-due-reminders';
  if job_id is not null then perform cron.unschedule(job_id); end if;
end;
$$;

select cron.schedule(
  'taskflow-due-reminders',
  '* * * * *',
  $$ select public.generate_due_reminders(); $$
);
