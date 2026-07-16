-- Recurring tasks: a recurrence rule + regeneration of the next occurrence on completion.
alter table public.tasks
  add column if not exists recurrence text
  check (recurrence in ('daily','weekdays','weekly','monthly'));

create or replace function public.regenerate_recurring_task()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  base timestamptz;
  next_due timestamptz;
begin
  if new.completed and not coalesce(old.completed, false)
     and new.recurrence is not null and new.parent_task_id is null then
    base := coalesce(new.due_date, now());
    next_due := case new.recurrence
      when 'daily' then base + interval '1 day'
      when 'weekly' then base + interval '1 week'
      when 'monthly' then base + interval '1 month'
      when 'weekdays' then case extract(dow from base)::int
        when 5 then base + interval '3 days'
        when 6 then base + interval '2 days'
        else base + interval '1 day'
      end
      else base + interval '1 day'
    end;

    insert into public.tasks
      (creator_id, assignee_id, section_id, name, description, priority, due_date, position, recurrence)
    values
      (new.creator_id, new.assignee_id, new.section_id, new.name, new.description,
       new.priority, next_due, new.position, new.recurrence)
    returning id into new_id;

    insert into public.task_projects (task_id, project_id)
      select new_id, project_id from public.task_projects where task_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_regenerate_recurring on public.tasks;
create trigger tasks_regenerate_recurring
  after update of completed on public.tasks
  for each row execute function public.regenerate_recurring_task();
