-- #37: close the AI-quota TOCTOU. The old flow counted usage, then made a
-- multi-second model call, then logged usage — so N concurrent requests all
-- passed the check. This atomically reserves a usage row (a single count+insert
-- statement) *before* the model call, returning the new row id or null when
-- over the monthly limit. Tokens are recorded onto that row afterwards.
create or replace function public.reserve_ai_request(p_feature text, p_limit integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  start_ts timestamptz := date_trunc('month', now());
  new_id uuid;
begin
  insert into public.ai_usage (user_id, feature)
  select auth.uid(), p_feature
  where (
    select count(*) from public.ai_usage
    where user_id = auth.uid() and created_at >= start_ts
  ) < p_limit
  returning id into new_id;
  return new_id; -- null when over the limit
end;
$$;
grant execute on function public.reserve_ai_request(text, integer) to authenticated;
