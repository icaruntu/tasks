"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";
import { Avatar } from "@/components/ui";

export default function SettingsPage() {
  const {
    me,
    collaborators,
    addCollaboratorByEmail,
    removeCollaborator,
    updateMyProfile,
  } = useWorkspace();

  // Collaborators
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);

  // Pomodoro
  const [work, setWork] = useState<number | null>(null);
  const [shortBreak, setShortBreak] = useState<number | null>(null);
  const [longBreak, setLongBreak] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [pomoMsg, setPomoMsg] = useState<string | null>(null);
  const [fontSaving, setFontSaving] = useState(false);
  const [fontMsg, setFontMsg] = useState<string | null>(null);

  const workVal = work ?? me?.pomodoro_work_minutes ?? 25;
  const shortVal = shortBreak ?? me?.pomodoro_short_break_minutes ?? 5;
  const longVal = longBreak ?? me?.pomodoro_long_break_minutes ?? 15;

  async function addCollaborator() {
    if (adding || !email.trim()) return;
    setAdding(true);
    setCollabError(null);
    const err = await addCollaboratorByEmail(email);
    if (err) setCollabError(err);
    else setEmail("");
    setAdding(false);
  }

  async function savePomodoro() {
    setSaving(true);
    setPomoMsg(null);
    const clamp = (v: number, max: number) =>
      Math.min(max, Math.max(1, Math.round(v) || 1));
    const err = await updateMyProfile({
      pomodoro_work_minutes: clamp(workVal, 180),
      pomodoro_short_break_minutes: clamp(shortVal, 60),
      pomodoro_long_break_minutes: clamp(longVal, 120),
    });
    setPomoMsg(err ?? "Saved.");
    setSaving(false);
  }

  async function setFontScale(font_scale: 100 | 115 | 130) {
    if (fontSaving || font_scale === (me?.font_scale ?? 100)) return;
    setFontSaving(true);
    setFontMsg(null);
    const err = await updateMyProfile({ font_scale });
    setFontMsg(err ?? "Text size saved.");
    setFontSaving(false);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-lg font-semibold">Settings</h1>

        {/* Collaborators */}
        <section className="surface border border-app rounded-2xl p-5">
          <h2 className="font-semibold text-sm">Collaborators</h2>
          <p className="text-xs text-muted mt-0.5 mb-3">
            People you work with. Only collaborators (and members of your
            projects) show up when assigning tasks, sharing projects, or
            @mentioning.
          </p>

          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
              placeholder="Add by email…"
              className="flex-1 min-w-0 surface-muted border border-app rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
            <button
              onClick={addCollaborator}
              disabled={adding || !email.trim()}
              className="shrink-0 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
          {collabError && (
            <p className="text-xs text-rose-600 mt-1.5">{collabError}</p>
          )}

          <div className="mt-4 space-y-1">
            {collaborators.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 px-1 py-1.5">
                <Avatar profile={p} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">
                    {p.full_name ?? p.email}
                  </span>
                  {p.full_name && (
                    <span className="block text-xs text-muted truncate">
                      {p.email}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => removeCollaborator(p.id)}
                  className="text-muted hover:text-rose-500 text-sm px-1"
                  title="Remove collaborator"
                >
                  ✕
                </button>
              </div>
            ))}
            {collaborators.length === 0 && (
              <p className="text-xs text-muted px-1 py-2">
                No collaborators yet. Add someone by their email.
              </p>
            )}
          </div>
        </section>

        {/* Accessibility */}
        <section className="surface border border-app rounded-2xl p-5">
          <h2 className="font-semibold text-sm">Text size</h2>
          <p className="text-xs text-muted mt-0.5 mb-3">
            Make text easier to read. This applies across the app, including
            when it is opened from your Home Screen in Safari.
          </p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Text size">
            {(
              [
                [100, "Normal", "text-sm"],
                [115, "Large", "text-base"],
                [130, "Extra large", "text-lg"],
              ] as const
            ).map(([scale, label, sampleClass]) => {
              const selected = (me?.font_scale ?? 100) === scale;
              return (
                <button
                  key={scale}
                  type="button"
                  disabled={fontSaving}
                  onClick={() => setFontScale(scale)}
                  aria-label={label}
                  aria-pressed={selected}
                  className={`min-h-14 rounded-lg border px-2 py-2 transition disabled:opacity-60 ${
                    selected
                      ? "border-[var(--color-primary)] bg-indigo-50 text-[var(--color-primary)] dark:bg-indigo-950/40"
                      : "border-app surface-muted hover:surface"
                  }`}
                >
                  <span className={`block font-medium ${sampleClass}`}>Aa</span>
                  <span className="mt-0.5 block text-[11px]">{label}</span>
                </button>
              );
            })}
          </div>
          {fontMsg && (
            <p className={`mt-2 text-xs ${fontMsg === "Text size saved." ? "text-muted" : "text-rose-600"}`}>
              {fontMsg}
            </p>
          )}
        </section>

        {/* Pomodoro */}
        <section className="surface border border-app rounded-2xl p-5">
          <h2 className="font-semibold text-sm">🍅 Pomodoro</h2>
          <p className="text-xs text-muted mt-0.5 mb-3">
            Durations in minutes for the focus timer.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Focus"
              value={workVal}
              min={1}
              max={180}
              onChange={setWork}
            />
            <NumberField
              label="Short break"
              value={shortVal}
              min={1}
              max={60}
              onChange={setShortBreak}
            />
            <NumberField
              label="Long break"
              value={longVal}
              min={1}
              max={120}
              onChange={setLongBreak}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={savePomodoro}
              disabled={saving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {pomoMsg && (
              <p
                className={`text-xs ${
                  pomoMsg === "Saved." ? "text-muted" : "text-rose-600"
                }`}
              >
                {pomoMsg}
              </p>
            )}
          </div>
        </section>

        {/* Billing link */}
        <section className="surface border border-app rounded-2xl p-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">Billing</h2>
            <p className="text-xs text-muted mt-0.5">
              Manage your plan and payment details.
            </p>
          </div>
          <Link
            href="/settings/billing"
            className="border border-app rounded-lg px-4 py-2 text-sm surface-muted hover:surface"
          >
            Open billing
          </Link>
        </section>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col">
      {/* Fixed-height label area so a wrapping label ("Short break") doesn't
          push its input below the others in the grid. */}
      <span className="text-xs text-muted leading-tight min-h-[2.25rem] flex items-start">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full surface-muted border border-app rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />
    </label>
  );
}
