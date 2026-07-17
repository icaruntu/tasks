"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-semibold">
            <span className="h-8 w-8 rounded-lg bg-[var(--color-primary)] text-white grid place-items-center text-lg">
              ✓
            </span>
            TaskFlow
          </div>
          <p className="text-muted text-sm mt-2">
            Simple task management, done together.
          </p>
        </div>

        <div className="surface border border-app rounded-2xl p-6 shadow-sm">
          <div className="flex gap-1 p-1 surface-muted rounded-lg mb-5">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 text-sm py-1.5 rounded-md transition ${
                  mode === m
                    ? "surface shadow-sm font-medium"
                    : "text-muted hover:text-[var(--foreground)]"
                }`}
                type="button"
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form action={formAction} className="space-y-3">
            {mode === "signup" && (
              <Field
                label="Full name"
                name="full_name"
                type="text"
                placeholder="Jane Doe"
                required
              />
            )}
            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
            <Field
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={mode === "signup" ? 10 : 6}
            />

            {state.error && (
              <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-md px-3 py-2">
                {state.error}
              </p>
            )}
            {state.message && (
              <p className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-md px-3 py-2">
                {state.message}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg py-2.5 text-sm font-medium transition disabled:opacity-60"
            >
              {pending
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        {...props}
        className="mt-1 w-full surface-muted border border-app rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] transition"
      />
    </label>
  );
}
