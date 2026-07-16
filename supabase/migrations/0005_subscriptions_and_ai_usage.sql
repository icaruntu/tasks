-- Provider-agnostic subscription state (written only by webhooks via the service role).
create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro','team')),
  status text not null default 'active',
  provider text check (provider in ('stripe','apple','google')),
  customer_id text,
  subscription_id text,
  seats integer not null default 1,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create index subscriptions_customer_idx on public.subscriptions(customer_id);

alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

-- AI usage log for metering + monthly quota enforcement.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage(user_id, created_at);

alter table public.ai_usage enable row level security;
create policy "ai_usage_select_own" on public.ai_usage for select to authenticated
  using (user_id = auth.uid());
create policy "ai_usage_insert_own" on public.ai_usage for insert to authenticated
  with check (user_id = auth.uid());
