// Supabase Edge Function: send-push
// Sends Expo and Web Push notifications for a notification created in Postgres.
// The caller (the notifications insert trigger) provides only the notification
// UUID; title/body/recipient are loaded server-side.
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Config:  nothing to paste. The hook secret and VAPID keys live in Supabase
// Vault and are read via public.push_delivery_config() (service_role only).
// The VAPID key pair is generated here on first use, so the private key never
// leaves Supabase. PUSH_HOOK_SECRET is still honoured as a fallback.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const ENV_HOOK_SECRET = Deno.env.get("PUSH_HOOK_SECRET");
const VAPID_SUBJECT = "mailto:icaruntu@hotmail.com";

type PushConfig = {
  push_hook_secret?: string;
  web_push_public_key?: string;
  web_push_private_key?: string;
};

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function loadConfig(): Promise<PushConfig> {
  const { data, error } = await supabase.rpc("push_delivery_config");
  if (error) throw error;
  return (data ?? {}) as PushConfig;
}

/** Generate a P-256 VAPID key pair and store it unless one already exists. */
async function ensureVapidKeys(cfg: PushConfig): Promise<PushConfig> {
  if (cfg.web_push_public_key && cfg.web_push_private_key) return cfg;
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const { data, error } = await supabase.rpc("init_web_push_keys", {
    p_public: base64url(rawPublic),
    p_private: jwk.d!,
  });
  if (error) throw error;
  return data as PushConfig;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let cfg: PushConfig;
  try {
    cfg = await loadConfig();
  } catch (error) {
    console.error("could not load push config", error);
    return new Response("config unavailable", { status: 500 });
  }

  const provided = req.headers.get("x-hook-secret") ?? "";
  const accepted = [cfg.push_hook_secret, ENV_HOOK_SECRET].filter(Boolean) as string[];
  if (!accepted.some((secret) => safeEqual(provided, secret))) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    cfg = await ensureVapidKeys(cfg);
  } catch (error) {
    console.error("could not initialise VAPID keys", error);
  }

  const { notification_id } = await req.json().catch(() => ({}));
  if (typeof notification_id !== "string" || !/^[0-9a-f-]{36}$/i.test(notification_id)) {
    return new Response("bad request", { status: 400 });
  }

  const { data: notification } = await supabase
    .from("notifications")
    .select("user_id,title,body,task_id")
    .eq("id", notification_id)
    .maybeSingle();
  if (!notification) return new Response("not found", { status: 404 });

  const [{ data: tokens }, { data: webSubscriptions }] = await Promise.all([
    supabase.from("push_tokens").select("token").eq("user_id", notification.user_id),
    supabase
      .from("web_push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", notification.user_id),
  ]);

  // Expo (native app)
  const messages = (tokens ?? []).map((t) => ({
    to: t.token,
    title: notification.title,
    body: notification.body ?? "",
    sound: "default",
  }));
  if (messages.length) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) console.error("expo push failed", await res.text());
  }

  // Web Push (Home Screen web app on iOS 16.4+, desktop browsers)
  const canWebPush = Boolean(cfg.web_push_public_key && cfg.web_push_private_key);
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body ?? "",
    url: "/",
    tag: notification.task_id ? `task-${notification.task_id}` : `notification-${notification_id}`,
  });
  const webResults = await Promise.all(
    (canWebPush ? webSubscriptions ?? [] : []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          {
            vapidDetails: {
              subject: VAPID_SUBJECT,
              publicKey: cfg.web_push_public_key!,
              privateKey: cfg.web_push_private_key!,
            },
            TTL: 60 * 60,
            urgency: "high",
          },
        );
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // The browser dropped this subscription; forget it.
          await supabase.from("web_push_subscriptions").delete().eq("id", subscription.id);
        }
        console.error("web push failed", statusCode, error);
        return false;
      }
    }),
  );

  return new Response(
    JSON.stringify({ expoSent: messages.length, webSent: webResults.filter(Boolean).length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
