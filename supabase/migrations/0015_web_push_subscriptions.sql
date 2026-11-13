-- Applied to production as 21_web_push_subscriptions; committed here so the
-- repo matches the live schema.
create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index web_push_subscriptions_user_idx on public.web_push_subscriptions(user_id);

alter table public.web_push_subscriptions enable row level security;
create policy "web_push_subscriptions_select_own" on public.web_push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "web_push_subscriptions_insert_own" on public.web_push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "web_push_subscriptions_update_own" on public.web_push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "web_push_subscriptions_delete_own" on public.web_push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
