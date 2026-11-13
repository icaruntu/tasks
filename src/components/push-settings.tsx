"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "./workspace-provider";
import {
  detectPushSupport,
  subscriptionRow,
  urlBase64ToUint8Array,
  type PushSupport,
} from "@/lib/web-push";

type Status = "checking" | "off" | "on" | "denied";

export function PushSettings() {
  const { me } = useWorkspace();
  const [supabase] = useState(() => createClient());
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const s = detectPushSupport();
    setSupport(s);
    if (s !== "supported") return;
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (sub && Notification.permission === "granted") {
          setStatus("on");
          // Keep the server copy fresh (it is dropped if a send ever fails).
          if (me) {
            await supabase
              .from("web_push_subscriptions")
              .upsert(subscriptionRow(me.id, sub), { onConflict: "endpoint" });
          }
        } else {
          setStatus("off");
        }
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, supabase]);

  async function enable() {
    if (!me || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      // iOS only shows the prompt when asked directly from the tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { data: key, error: keyError } = await supabase.rpc("get_web_push_public_key");
      if (keyError || !key) throw new Error("Notifications are not set up on the server yet.");
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));
      const { error } = await supabase
        .from("web_push_subscriptions")
        .upsert(subscriptionRow(me.id, sub), { onConflict: "endpoint" });
      if (error) throw new Error(error.message);
      setStatus("on");
      setMsg({ text: "Notifications are on for this device." });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Could not turn on notifications.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("web_push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setMsg({ text: "Notifications are off for this device." });
    } catch {
      setMsg({ text: "Could not turn off notifications.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!me || busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("notifications").insert({
      user_id: me.id,
      type: "due",
      title: "Test notification",
      body: "Notifications from TaskFlow are working.",
    });
    setMsg(
      error
        ? { text: "Could not send a test notification.", error: true }
        : { text: "Sent. It should arrive in a few seconds." },
    );
    setBusy(false);
  }

  return (
    <section className="surface border border-app rounded-2xl p-5">
      <h2 className="font-semibold text-sm">Notifications</h2>
      <p className="text-xs text-muted mt-0.5 mb-3">
        Get task reminders on this device, even when TaskFlow is closed.
      </p>

      {support === "needs-home-screen" && (
        <div className="text-sm space-y-1">
          <p>On iPhone, notifications work in the Home Screen app:</p>
          <ol className="list-decimal pl-5 text-muted text-xs space-y-0.5">
            <li>In Safari, tap Share, then “Add to Home Screen”.</li>
            <li>Open TaskFlow from the Home Screen icon.</li>
            <li>Come back to Settings and turn notifications on.</li>
          </ol>
          <p className="text-xs text-muted">Requires iOS 16.4 or later.</p>
        </div>
      )}

      {support === "unsupported" && (
        <p className="text-sm text-muted">This browser does not support notifications.</p>
      )}

      {support === "supported" && status === "denied" && (
        <p className="text-sm text-muted">
          Notifications are blocked for TaskFlow. On iPhone, allow them in Settings →
          Notifications → TaskFlow, then reopen the app.
        </p>
      )}

      {support === "supported" && (status === "off" || status === "on") && (
        <div className="flex flex-wrap items-center gap-2">
          {status === "off" ? (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
          ) : (
            <>
              <span className="text-sm font-medium text-emerald-600">● On for this device</span>
              <button
                type="button"
                onClick={sendTest}
                disabled={busy}
                className="border border-app rounded-lg px-3 py-1.5 text-sm surface-muted hover:surface disabled:opacity-60"
              >
                Send test
              </button>
              <button
                type="button"
                onClick={disable}
                disabled={busy}
                className="text-sm text-muted hover:text-[var(--foreground)] px-2 py-1.5 disabled:opacity-60"
              >
                Turn off
              </button>
            </>
          )}
        </div>
      )}

      {msg && (
        <p className={`mt-2 text-xs ${msg.error ? "text-rose-600" : "text-muted"}`}>{msg.text}</p>
      )}
    </section>
  );
}
