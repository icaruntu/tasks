-- Enable Supabase Realtime on the collaborative tables.
do $$
declare t text;
begin
  foreach t in array array[
    'tasks','task_projects','sections','projects','project_members','comments','notifications'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
