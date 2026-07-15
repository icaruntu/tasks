"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
} from "date-fns";
import { useWorkspace } from "@/components/workspace-provider";
import { useUI } from "@/components/ui-provider";
import { FilterBar } from "@/components/filter-bar";
import { applyFilters } from "@/lib/filter";
import { PRIORITY_META } from "@/lib/types";

export default function CalendarPage() {
  const { tasks, loading } = useWorkspace();
  const { filters, openTask } = useUI();
  const [month, setMonth] = useState(() => new Date());

  const visible = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, typeof visible>();
    for (const t of visible) {
      if (!t.due_date) continue;
      const key = format(new Date(t.due_date), "yyyy-MM-dd");
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return m;
  }, [visible]);

  if (loading)
    return (
      <div className="h-full grid place-items-center text-muted text-sm">
        Loading…
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-8 py-4 border-b border-app flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{format(month, "MMMM yyyy")}</h1>
          <div className="flex gap-1">
            <button
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="surface-muted border border-app rounded-md px-2 py-1 text-sm"
            >
              ‹
            </button>
            <button
              onClick={() => setMonth(new Date())}
              className="surface-muted border border-app rounded-md px-2.5 py-1 text-xs"
            >
              Today
            </button>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="surface-muted border border-app rounded-md px-2 py-1 text-sm"
            >
              ›
            </button>
          </div>
        </div>
        <FilterBar />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-7 gap-px surface-muted border border-app rounded-xl overflow-hidden">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="surface text-xs font-semibold text-muted text-center py-2"
            >
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`surface min-h-24 p-1.5 ${
                  isSameMonth(day, month) ? "" : "opacity-40"
                }`}
              >
                <div
                  className={`text-xs mb-1 h-5 w-5 grid place-items-center rounded-full ${
                    isToday(day)
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-muted"
                  }`}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTask(t.id)}
                      className={`w-full text-left text-[11px] truncate rounded px-1.5 py-0.5 surface-muted hover:ring-1 ring-[var(--color-primary)] flex items-center gap-1 ${
                        t.completed ? "line-through text-muted" : ""
                      }`}
                    >
                      {t.priority && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_META[t.priority].dot}`}
                        />
                      )}
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                  {dayTasks.length > 4 && (
                    <p className="text-[10px] text-muted px-1">
                      +{dayTasks.length - 4} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
