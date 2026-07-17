"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "./workspace-provider";
import { useUI } from "./ui-provider";

type Phase = "work" | "short_break" | "long_break";

const DEFAULT_DURATIONS: Record<Phase, number> = {
  work: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

const PHASE_LABEL: Record<Phase, string> = {
  work: "Focus",
  short_break: "Short break",
  long_break: "Long break",
};

export function PomodoroWidget() {
  const { supabase, userId, allTasks, me } = useWorkspace();
  const { pomodoroTaskId, setPomodoroTaskId } = useUI();
  const [phase, setPhase] = useState<Phase>("work");
  const [remaining, setRemaining] = useState(DEFAULT_DURATIONS.work);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  // Per-user durations from settings, falling back to the classic 25/5/15.
  const durations = useMemo<Record<Phase, number>>(
    () => ({
      work: (me?.pomodoro_work_minutes ?? 25) * 60,
      short_break: (me?.pomodoro_short_break_minutes ?? 5) * 60,
      long_break: (me?.pomodoro_long_break_minutes ?? 15) * 60,
    }),
    [me],
  );

  // Sync the idle timer when settings load/change.
  useEffect(() => {
    if (!running) setRemaining(durations[phase]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durations]);

  const task = allTasks.find((t) => t.id === pomodoroTaskId);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining !== 0 || !running) return;
    // Phase finished.
    setRunning(false);
    if (phase === "work") {
      // Log the completed focus session.
      supabase
        .from("pomodoro_sessions")
        .insert({
          user_id: userId,
          task_id: pomodoroTaskId,
          kind: "work",
          duration_seconds: durations.work,
          started_at: startedAtRef.current
            ? new Date(startedAtRef.current).toISOString()
            : new Date().toISOString(),
          ended_at: new Date().toISOString(),
          completed: true,
        })
        .then(() => {});
      const next = cycles + 1;
      setCycles(next);
      const nextPhase: Phase = next % 4 === 0 ? "long_break" : "short_break";
      setPhase(nextPhase);
      setRemaining(durations[nextPhase]);
    } else {
      setPhase("work");
      setRemaining(durations.work);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function toggle() {
    if (!running) startedAtRef.current = Date.now();
    setRunning((r) => !r);
  }
  function reset() {
    setRunning(false);
    setRemaining(durations[phase]);
  }
  function switchPhase(p: Phase) {
    setPhase(p);
    setRemaining(durations[p]);
    setRunning(false);
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = 1 - remaining / durations[phase];

  return (
    <div className="surface border border-app rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          🍅 Pomodoro
        </span>
        <div className="flex gap-1">
          {(["work", "short_break", "long_break"] as Phase[]).map((p) => (
            <button
              key={p}
              onClick={() => switchPhase(p)}
              className={`h-2 w-2 rounded-full ${
                phase === p ? "bg-[var(--color-primary)]" : "bg-[var(--border)]"
              }`}
              title={PHASE_LABEL[p]}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="relative h-12 w-12 rounded-full grid place-items-center shrink-0"
          style={{
            background: `conic-gradient(var(--color-primary) ${pct * 360}deg, var(--border) 0deg)`,
          }}
        >
          <div className="h-9 w-9 rounded-full surface grid place-items-center text-[11px] font-semibold tabular-nums">
            {mm}:{ss}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{PHASE_LABEL[phase]}</p>
          {task ? (
            <p className="text-xs truncate">
              {task.name}{" "}
              <button
                onClick={() => setPomodoroTaskId(null)}
                className="text-muted hover:text-rose-500"
              >
                ✕
              </button>
            </p>
          ) : (
            <p className="text-xs text-muted">No task linked</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-2">
        <button
          onClick={toggle}
          className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg py-1.5 text-xs font-medium"
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={reset}
          className="px-3 surface-muted rounded-lg py-1.5 text-xs"
        >
          Reset
        </button>
      </div>
      {cycles > 0 && (
        <p className="text-[11px] text-muted mt-1.5 text-center">
          {cycles} focus session{cycles > 1 ? "s" : ""} today
        </p>
      )}
    </div>
  );
}
