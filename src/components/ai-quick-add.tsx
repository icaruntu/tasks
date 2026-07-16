"use client";

import { useState } from "react";
import { useWorkspace } from "./workspace-provider";
import { useUI } from "./ui-provider";

// Natural-language task capture (#19). Type a sentence; AI structures it into a task.
export function AiQuickAdd() {
  const { createTask, setTaskProjects } = useWorkspace();
  const { openTask, filters } = useUI();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const t = text.trim();
    if (!t || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: t,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "Couldn’t parse that.");
        return;
      }
      const parsed = await res.json();
      const created = await createTask({
        name: parsed.name ?? t,
        due_date: parsed.due_date ?? null,
        priority: parsed.priority ?? null,
      });
      if (created && filters.projectId) {
        await setTaskProjects(created.id, [filters.projectId]);
      }
      setText("");
      if (created) openTask(created.id);
    } catch {
      setErr("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 surface border border-app rounded-xl px-3 py-2 focus-within:border-[var(--color-primary)]">
        <span className="text-[var(--color-primary)]">✨</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={loading}
          placeholder="Try: “Email the vendor next Tuesday 3pm, high priority”"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {loading ? (
          <span className="text-xs text-muted">Thinking…</span>
        ) : (
          text.trim() && (
            <button
              onClick={submit}
              className="text-xs bg-[var(--color-primary)] text-white rounded-md px-2 py-1"
            >
              Add
            </button>
          )
        )}
      </div>
      {err && <p className="text-xs text-rose-600 mt-1 px-1">{err}</p>}
    </div>
  );
}
