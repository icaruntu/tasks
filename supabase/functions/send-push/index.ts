// Supabase Edge Function: send-push
// Sends an Expo push for a single notification. Invoke it from a Postgres
// trigger/webhook on `public.notifications` (or a cron that batches unsent
// rows). Body: { user_id, title, body }.
//
// Deploy:  supabase functions deploy send-push
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//          PUSH_HOOK_SECRET (shared secret sent as x-hook-secret).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HOOK_SECRET = Deno.env.get("PUSH_HOOK_SECRET");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function safeEqual(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!HOOK_SECRET || !safeEqual(req.headers.get("x-hook-secret") ?? "", HOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const { user_id, title, body } = await req.json().catch(() => ({}));
  if (!user_id || !title) {
    return new Response("bad request", { status: 400 });
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", user_id);

  if (!tokens?.length) return new Response(JSON.stringify({ sent: 0 }));

  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body: body ?? "",
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
