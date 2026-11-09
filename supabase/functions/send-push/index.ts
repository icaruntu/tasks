// Supabase Edge Function: send-push
// Sends Expo pushes for a notification created in Postgres. The caller provides
// only the notification UUID; title/body/recipient are loaded server-side.
//
// Deploy:  supabase functions deploy send-push
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected), and
// PUSH_HOOK_SECRET (a shared value kept in Supabase Vault for the DB trigger).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const HOOK_SECRET = Deno.env.get("PUSH_HOOK_SECRET");

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!HOOK_SECRET || !safeEqual(req.headers.get("x-hook-secret") ?? "", HOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  const { notification_id } = await req.json().catch(() => ({}));
  if (typeof notification_id !== "string" || !/^[0-9a-f-]{36}$/i.test(notification_id)) {
    return new Response("bad request", { status: 400 });
  }

  const { data: notification } = await supabase
    .from("notifications")
    .select("user_id,title,body")
    .eq("id", notification_id)
    .maybeSingle();
  if (!notification) return new Response("not found", { status: 404 });

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", notification.user_id);

  if (!tokens?.length) return new Response(JSON.stringify({ sent: 0 }));

  const messages = tokens.map((t) => ({
    to: t.token,
    title: notification.title,
    body: notification.body ?? "",
    sound: "default",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) console.error("expo push failed", await res.text());

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
