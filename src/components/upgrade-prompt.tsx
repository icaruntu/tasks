"use client";

import Link from "next/link";

export function UpgradePrompt({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 grid place-items-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm surface border border-app rounded-2xl shadow-xl p-6 text-center">
          <div className="text-3xl mb-2">✨</div>
          <h2 className="font-semibold text-lg">{title}</h2>
          <p className="text-sm text-muted mt-1">{message}</p>
          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 border border-app rounded-lg py-2 text-sm surface-muted"
            >
              Not now
            </button>
            <Link
              href="/pricing"
              className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg py-2 text-sm font-medium"
            >
              See plans
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
