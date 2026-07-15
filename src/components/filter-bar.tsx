"use client";

import { useState } from "react";
import { useUI } from "./ui-provider";
import {
  DUE_FILTER_LABELS,
  PRIORITY_META,
  type DueFilter,
  type Priority,
  type CompletionFilter,
} from "@/lib/types";

export function FilterBar() {
  const { filters, setFilters } = useUI();
  const [open, setOpen] = useState(false);

  const activeCount =
    (filters.due ? 1 : 0) +
    filters.priorities.length +
    (filters.completion !== "incomplete" ? 1 : 0);

  function togglePriority(p: Priority) {
    setFilters((f) => ({
      ...f,
      priorities: f.priorities.includes(p)
        ? f.priorities.filter((x) => x !== p)
        : [...f.priorities, p],
    }));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">
          ⌕
        </span>
        <input
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
          placeholder="Search tasks…"
          className="w-full surface-muted border border-app rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 border border-app rounded-lg px-3 py-1.5 text-sm ${
            activeCount ? "surface font-medium" : "surface-muted text-muted"
          }`}
        >
          Filters
          {activeCount > 0 && (
            <span className="bg-[var(--color-primary)] text-white rounded-full text-[10px] h-4 min-w-4 px-1 grid place-items-center">
              {activeCount}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 w-64 surface border border-app rounded-xl shadow-lg z-20 p-3 space-y-4">
              <FilterGroup label="Status">
                <div className="flex gap-1">
                  {(
                    [
                      ["incomplete", "Incomplete"],
                      ["complete", "Complete"],
                      ["all", "All"],
                    ] as [CompletionFilter, string][]
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() =>
                        setFilters((f) => ({ ...f, completion: val }))
                      }
                      className={`flex-1 text-xs py-1.5 rounded-md border border-app ${
                        filters.completion === val
                          ? "bg-[var(--color-primary)] text-white border-transparent"
                          : "surface-muted text-muted"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup label="Due date">
                <div className="space-y-1">
                  {(Object.keys(DUE_FILTER_LABELS) as NonNullable<DueFilter>[]).map(
                    (key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="due"
                          checked={filters.due === key}
                          onChange={() =>
                            setFilters((f) => ({ ...f, due: key }))
                          }
                        />
                        {DUE_FILTER_LABELS[key]}
                      </label>
                    ),
                  )}
                  {filters.due && (
                    <button
                      onClick={() => setFilters((f) => ({ ...f, due: null }))}
                      className="text-xs text-[var(--color-primary)] mt-1"
                    >
                      Clear due date
                    </button>
                  )}
                </div>
              </FilterGroup>

              <FilterGroup label="Priority">
                <div className="flex gap-1.5">
                  {(["high", "medium", "low"] as Priority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border ${
                        filters.priorities.includes(p)
                          ? "surface border-app font-medium"
                          : "surface-muted border-app text-muted"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${PRIORITY_META[p].dot}`} />
                      {PRIORITY_META[p].label}
                    </button>
                  ))}
                </div>
              </FilterGroup>

              {activeCount > 0 && (
                <button
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      due: null,
                      priorities: [],
                      completion: "incomplete",
                    }))
                  }
                  className="w-full text-xs text-muted hover:text-[var(--foreground)] pt-1"
                >
                  Reset filters
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted mb-1.5">{label}</p>
      {children}
    </div>
  );
}
