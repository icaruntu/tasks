"use client";

import { PRIORITY_META, type Priority, type Profile } from "@/lib/types";
import { formatDueLabel, isOverdue } from "@/lib/dates";

export function Check({
  checked,
  onChange,
  size = 20,
}: {
  checked: boolean;
  onChange: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`shrink-0 rounded-full border-2 grid place-items-center transition ${
        checked
          ? "bg-emerald-500 border-emerald-500 text-white"
          : "border-[var(--muted)] hover:border-emerald-500"
      }`}
      style={{ width: size, height: size }}
      aria-pressed={checked}
      title={checked ? "Mark incomplete" : "Mark complete"}
    >
      {checked && (
        <svg viewBox="0 0 24 24" width={size - 8} height={size - 8} fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

export function PriorityDot({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  const m = PRIORITY_META[priority];
  return (
    <span className="inline-flex items-center gap-1 text-xs" title={`${m.label} priority`}>
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  const m = PRIORITY_META[priority];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.color}`}
    >
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function DueBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const overdue = isOverdue(date);
  return (
    <span
      className={`text-xs font-medium whitespace-nowrap ${
        overdue ? "text-rose-600" : "text-muted"
      }`}
    >
      {formatDueLabel(date)}
    </span>
  );
}

export function Avatar({
  profile,
  size = 24,
}: {
  profile: Profile | null | undefined;
  size?: number;
}) {
  const name = profile?.full_name ?? profile?.email ?? "?";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue =
    [...(profile?.id ?? name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (profile?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-full grid place-items-center text-white font-medium shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(${hue} 55% 50%)`,
      }}
      title={name}
    >
      {initials}
    </span>
  );
}
