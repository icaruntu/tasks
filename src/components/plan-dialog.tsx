"use client";

import { useEffect, useState } from "react";

// "Plan my day" (#21): fetches an AI-generated plan from the user's actionable tasks.
export function PlanDialog({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/plan", { method: "POST" });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setErr(j.error ?? "Couldn’t build a plan.");
        else setPlan(j.plan ?? "");
      } catch {
        if (!cancelled) setErr("Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 grid place-items-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg surface border border-app rounded-2xl shadow-xl p-5 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="text-[var(--color-primary)]">✨</span> Plan my day
            </h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-[var(--foreground)] text-lg"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto text-sm">
            {loading && <p className="text-muted">Building your plan…</p>}
            {err && (
              <p className="text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-md px-3 py-2">
                {err}
              </p>
            )}
            {plan && (
              <div className="whitespace-pre-wrap leading-relaxed">{plan}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
