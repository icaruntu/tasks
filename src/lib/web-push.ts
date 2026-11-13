/** Browser-side helpers for Web Push (iOS 16.4+ Home Screen app, desktop). */

export type PushSupport =
  | "supported"
  /** iOS Safari tab: push only works once added to the Home Screen. */
  | "needs-home-screen"
  | "unsupported";

type Env = {
  window?: Window & typeof globalThis;
  navigator?: Navigator;
};

export function isIOS(nav: Navigator | undefined): boolean {
  if (!nav) return false;
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    // iPadOS reports itself as a Mac with touch.
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
  );
}

export function isStandalone(win: (Window & typeof globalThis) | undefined): boolean {
  if (!win) return false;
  return (
    win.matchMedia?.("(display-mode: standalone)").matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPushSupport({
  window: win = typeof window === "undefined" ? undefined : window,
  navigator: nav = typeof navigator === "undefined" ? undefined : navigator,
}: Env = {}): PushSupport {
  if (!win || !nav) return "unsupported";
  const hasApis =
    "serviceWorker" in nav && "PushManager" in win && "Notification" in win;
  if (hasApis) return "supported";
  // iOS only exposes the push APIs inside the installed Home Screen app.
  if (isIOS(nav) && !isStandalone(win)) return "needs-home-screen";
  return "unsupported";
}

/** VAPID keys are base64url; PushManager wants raw bytes. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Shape stored in public.web_push_subscriptions. */
export function subscriptionRow(userId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    updated_at: new Date().toISOString(),
  };
}
