"use client";

import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useWorkspace } from "@/components/workspace-provider";
import { useUI } from "@/components/ui-provider";
import { FilterBar } from "@/components/filter-bar";
import { Check, DueBadge, PriorityBadge, Avatar } from "@/components/ui";
import { applyFilters, sortTasks } from "@/lib/filter";
import type { Task } from "@/lib/types";

const INBOX = "__inbox__";

export default function BoardPage() {
  const { tasks, sections, moveTask, loading } = useWorkspace();
  const { filters } = useUI();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visible = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);
  const grouped = useMemo(() => {
    const m = new Map<string, Task[]>();
    m.set(INBOX, []);
    for (const s of sections) m.set(s.id, []);
    for (const t of visible) {
      const k = t.section_id ?? INBOX;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    for (const [k, v] of m) m.set(k, sortTasks(v));
    return m;
  }, [visible, sections]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    let destSection: string;
    const overId = String(over.id);
    if (overId.startsWith("col:")) destSection = overId.slice(4);
    else {
      const t = tasks.find((x) => x.id === overId);
      destSection = t?.section_id ?? INBOX;
    }
    const list = grouped.get(destSection) ?? [];
    const maxPos = list.reduce((m, t) => Math.max(m, t.position), 0);
    moveTask(activeId, destSection === INBOX ? null : destSection, maxPos + 1000);
  }

  if (loading)
    return (
      <div className="h-full grid place-items-center text-muted text-sm">
        Loading…
      </div>
    );

  const cols = [
    { id: INBOX, name: "Inbox" },
    ...sections.map((s) => ({ id: s.id, name: s.name })),
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-8 py-4 border-b border-app flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Board</h1>
        <FilterBar />
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full items-start">
            {cols.map((c) => (
              <Column
                key={c.id}
                id={c.id}
                name={c.name}
                tasks={grouped.get(c.id) ?? []}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}

function Column({
  id,
  name,
  tasks,
}: {
  id: string;
  name: string;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` });
  return (
    <div className="w-72 shrink-0 flex flex-col max-h-full">
      <div className="flex items-center gap-2 px-1 mb-2">
        <h2 className="text-sm font-semibold">{name}</h2>
        <span className="text-xs text-muted">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`surface-muted rounded-xl p-2 space-y-2 overflow-y-auto flex-1 min-h-24 transition ${
          isOver ? "ring-2 ring-[var(--color-primary)]" : ""
        }`}
      >
        {tasks.map((t) => (
          <Card key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

function Card({ task }: { task: Task }) {
  const { toggleComplete, profiles } = useWorkspace();
  const { openTask } = useUI();
  const { attributes, listeners, setNodeRef } = useCardDrag(task.id);
  const assignee = profiles.find((p) => p.id === task.assignee_id);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openTask(task.id)}
      className="surface border border-app rounded-lg p-3 cursor-pointer hover:shadow-sm"
    >
      <div className="flex items-start gap-2">
        <Check
          size={18}
          checked={task.completed}
          onChange={() => toggleComplete(task.id, !task.completed)}
        />
        <p
          className={`text-sm flex-1 ${
            task.completed ? "line-through text-muted" : ""
          }`}
        >
          {task.name}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-2 pl-6 flex-wrap empty:hidden">
        {task.priority && <PriorityBadge priority={task.priority} />}
        <DueBadge date={task.due_date} />
        {task.subtask_count > 0 && (
          <span className="text-[11px] text-muted">
            ☑ {task.subtask_done}/{task.subtask_count}
          </span>
        )}
        {assignee && (
          <span className="ml-auto">
            <Avatar profile={assignee} size={20} />
          </span>
        )}
      </div>
    </div>
  );
}

function useCardDrag(id: string) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return { attributes, listeners, setNodeRef };
}
