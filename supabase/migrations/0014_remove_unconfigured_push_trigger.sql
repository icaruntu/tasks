-- The delivery function is intentionally not exposed without a configured
-- server-to-server secret. Remove the transient trigger from migration 19.
drop trigger if exists notifications_enqueue_push on public.notifications;
drop function if exists private.enqueue_push_notification();
