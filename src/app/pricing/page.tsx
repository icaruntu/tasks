"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_META, type Plan } from "@/lib/plans";

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(priceKey: string) {
    setBusy(priceKey);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.url) window.location.href = j.url;
      else setError(j.error ?? "Couldn’t start checkout.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const order: Plan[] = ["free", "pro", "team"];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <Link href="/" className="text-sm text-muted hover:text-[var(--foreground)]">
            ← Back to app
          </Link>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold">Upgrade TaskFlow</h1>
          <p className="text-muted text-sm mt-1">
            Start free. Upgrade when you need more.
          </p>
          <div className="inline-flex mt-4 surface-muted border border-app rounded-lg p-1 text-sm">
            <button
              onClick={() => setYearly(false)}
              className={`px-3 py-1 rounded-md ${!yearly ? "surface shadow-sm font-medium" : "text-muted"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-3 py-1 rounded-md ${yearly ? "surface shadow-sm font-medium" : "text-muted"}`}
            >
              Yearly
            </button>
          </div>
        </div>

        {error && (
          <p className="text-center text-sm text-rose-600 mb-4">{error}</p>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {order.map((plan) => {
            const meta = PLAN_META[plan];
            const isPro = plan === "pro";
            const isTeam = plan === "team";
            return (
              <div
                key={plan}
                className={`surface border rounded-2xl p-6 flex flex-col ${
                  isPro ? "border-[var(--color-primary)] shadow-md" : "border-app"
                }`}
              >
                {isPro && (
                  <span className="self-start text-[11px] font-semibold text-[var(--color-primary)] bg-indigo-50 dark:bg-indigo-950/40 rounded-full px-2 py-0.5 mb-2">
                    Most popular
                  </span>
                )}
                <h2 className="text-lg font-semibold">{meta.name}</h2>
                <p className="text-xs text-muted">{meta.tagline}</p>
                <p className="text-2xl font-bold mt-3">
                  {isPro && yearly ? "$50/yr" : meta.priceLabel}
                </p>
                <ul className="mt-4 space-y-1.5 text-sm flex-1">
                  {meta.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-emerald-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {plan === "free" ? (
                  <Link
                    href="/"
                    className="mt-5 text-center border border-app rounded-lg py-2 text-sm surface-muted"
                  >
                    Current plan
                  </Link>
                ) : (
                  <button
                    onClick={() =>
                      checkout(isTeam ? "team" : yearly ? "pro_yearly" : "pro_monthly")
                    }
                    disabled={!!busy}
                    className="mt-5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {busy ? "Redirecting…" : `Upgrade to ${meta.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted mt-6">
          On iPhone, subscriptions are handled through the App Store. Prices in USD.
        </p>
      </div>
    </div>
  );
}
