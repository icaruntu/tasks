-- Applied to production as web_push_delivery_trigger; committed here so the
-- repo matches the live schema.
-- Invoke the protected Edge Function for every newly-created notification.
-- The shared secret is read only inside Postgres from Supabase Vault.

create or replace function private.enqueue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  hook_secret text;
begin
  select decrypted_secret
    into hook_secret
    from vault.decrypted_secrets
    where name = 'push_hook_secret'
    limit 1;

  if hook_secret is null then
    raise warning 'Push notification skipped: push_hook_secret is not configured';
    return new;
  end if;

  perform net.http_post(
    url := 'https://fxhtvziyuuxvbonstjdy.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', hook_secret
    ),
    body := jsonb_build_object('notification_id', new.id)
  );

  return new;
exception when others then
  raise warning 'Push notification enqueue failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_notification_created_enqueue_push on public.notifications;
create trigger on_notification_created_enqueue_push
after insert on public.notifications
for each row execute function private.enqueue_push_notification();
