"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";
import { PLAN_META, isPaid } from "@/lib/plans";

export default function BillingSettingsPage() {
  const { plan } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = PLAN_META[plan];

  async function manage() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (j.url) window.location.href = j.url;
      else setError(j.error ?? "Couldn’t open billing.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold mb-4">Billing</h1>

        <div className="surface border border-app rounded-2xl p-5">
          <p className="text-xs text-muted">Current plan</p>
          <p className="text-xl font-semibold mt-0.5">{meta.name}</p>
          <p className="text-sm text-muted">{meta.tagline}</p>

          <div className="mt-5 flex gap-2">
            {isPaid(plan) ? (
              <button
                onClick={manage}
                disabled={busy}
                className="border border-app rounded-lg px-4 py-2 text-sm surface-muted disabled:opacity-60"
              >
                {busy ? "Opening…" : "Manage billing"}
              </button>
            ) : (
              <Link
                href="/pricing"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                Upgrade
              </Link>
            )}
            <Link
              href="/pricing"
              className="border border-app rounded-lg px-4 py-2 text-sm surface-muted"
            >
              Compare plans
            </Link>
          </div>
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  );
}
