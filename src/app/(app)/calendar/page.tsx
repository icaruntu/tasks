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
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useWorkspace } from "@/components/workspace-provider";
import { useUI } from "@/components/ui-provider";
import { FilterBar } from "@/components/filter-bar";
import { applyFilters } from "@/lib/filter";
import { rescheduleToDay } from "@/lib/dnd";
import { PRIORITY_META, type Task } from "@/lib/types";

export default function CalendarPage() {
  const { tasks, updateTask, loading } = useWorkspace();
  const { filters, openTask } = useUI();
  const [month, setMonth] = useState(() => new Date());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visible = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of visible) {
      if (!t.due_date) continue;
      const key = format(new Date(t.due_date), "yyyy-MM-dd");
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return m;
  }, [visible]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("day:")) return;
    const key = overId.slice(4);
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    // Preserve the original time-of-day; just move the calendar day.
    const nextDue = rescheduleToDay(key, task.due_date);
    if (nextDue) updateTask(task.id, { due_date: nextDue });
  }

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
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
              return (
                <DayCell
                  key={key}
                  dayKey={key}
                  label={format(day, "d")}
                  today={isToday(day)}
                  dim={!isSameMonth(day, month)}
                  tasks={tasksByDay.get(key) ?? []}
                  onOpen={openTask}
                />
              );
            })}
          </div>
        </DndContext>
        <p className="text-xs text-muted mt-2 px-1">
          Tip: drag a task to another day to reschedule it.
        </p>
      </div>
    </div>
  );
}

function DayCell({
  dayKey,
  label,
  today,
  dim,
  tasks,
  onOpen,
}: {
  dayKey: string;
  label: string;
  today: boolean;
  dim: boolean;
  tasks: Task[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayKey}` });
  return (
    <div
      ref={setNodeRef}
      className={`surface min-h-24 p-1.5 transition ${dim ? "opacity-40" : ""} ${
        isOver ? "ring-2 ring-inset ring-[var(--color-primary)]" : ""
      }`}
    >
      <div
        className={`text-xs mb-1 h-5 w-5 grid place-items-center rounded-full ${
          today ? "bg-[var(--color-primary)] text-white" : "text-muted"
        }`}
      >
        {label}
      </div>
      <div className="space-y-1">
        {tasks.slice(0, 5).map((t) => (
          <CalendarChip key={t.id} task={t} onOpen={onOpen} />
        ))}
        {tasks.length > 5 && (
          <p className="text-[10px] text-muted px-1">+{tasks.length - 5} more</p>
        )}
      </div>
    </div>
  );
}

function CalendarChip({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`w-full text-left text-[11px] truncate rounded px-1.5 py-0.5 surface-muted hover:ring-1 ring-[var(--color-primary)] flex items-center gap-1 cursor-grab active:cursor-grabbing ${
        task.completed ? "line-through text-muted" : ""
      }`}
    >
      {task.priority && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_META[task.priority].dot}`}
        />
      )}
      <span className="truncate">{task.name}</span>
    </button>
  );
}
