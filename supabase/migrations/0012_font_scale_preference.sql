-- Accessibility: persist a per-user text scale for the web/PWA client.
alter table public.profiles
  add column font_scale integer not null default 100
  check (font_scale in (100, 115, 130));
