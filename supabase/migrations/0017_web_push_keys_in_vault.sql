-- Web Push (VAPID) keys and the trigger's hook secret live in Supabase Vault,
-- so nothing has to be pasted into dashboards. The send-push Edge Function
-- generates the VAPID key pair on first use (the private key never leaves
-- Supabase) and reads everything through push_delivery_config().

-- Public key for browsers to subscribe with. Not secret; signed-in users only.
create or replace function public.get_web_push_public_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare k text;
begin
  select decrypted_secret into k
    from vault.decrypted_secrets
    where name = 'web_push_public_key'
    limit 1;
  return k;
end;
$$;
revoke all on function public.get_web_push_public_key() from public, anon;
grant execute on function public.get_web_push_public_key() to authenticated;

-- Everything the Edge Function needs. service_role only.
create or replace function public.push_delivery_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare cfg jsonb;
begin
  select jsonb_object_agg(name, decrypted_secret) into cfg
    from vault.decrypted_secrets
    where name in ('push_hook_secret', 'web_push_public_key', 'web_push_private_key');
  return coalesce(cfg, '{}'::jsonb);
end;
$$;
revoke all on function public.push_delivery_config() from public, anon, authenticated;
grant execute on function public.push_delivery_config() to service_role;

-- Store a freshly generated VAPID key pair unless one already exists, and
-- return whichever pair is stored (concurrent first calls agree on one).
create or replace function public.init_web_push_keys(p_public text, p_private text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('web_push_keys'));
  if not exists (select 1 from vault.secrets where name = 'web_push_public_key') then
    perform vault.create_secret(p_private, 'web_push_private_key', 'VAPID private key for Web Push');
    perform vault.create_secret(p_public, 'web_push_public_key', 'VAPID public key for Web Push');
  end if;
  return public.push_delivery_config();
end;
$$;
revoke all on function public.init_web_push_keys(text, text) from public, anon, authenticated;
grant execute on function public.init_web_push_keys(text, text) to service_role;
