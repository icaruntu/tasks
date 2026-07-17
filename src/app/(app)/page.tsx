"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useWorkspace } from "@/components/workspace-provider";
import { useUI } from "@/components/ui-provider";
import { FilterBar } from "@/components/filter-bar";
import { SectionBlock } from "@/components/section-block";
import { ShareDialog } from "@/components/share-dialog";
import { AiQuickAdd } from "@/components/ai-quick-add";
import { applyFilters, sortTasks } from "@/lib/filter";
import {
  INBOX,
  resolveDropSection,
  computeInsertPosition,
} from "@/lib/dnd";
import type { Task } from "@/lib/types";

export default function ListPage() {
  const { tasks, sections, moveTask, createSection, projects, loading } =
    useWorkspace();
  const { filters } = useUI();
  const [addingSection, setAddingSection] = useState(false);
  const [sharing, setSharing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visible = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  // Group tasks by section (INBOX for null).
  const grouped = useMemo(() => {
    const m = new Map<string, Task[]>();
    m.set(INBOX, []);
    for (const s of sections) m.set(s.id, []);
    for (const t of visible) {
      const key = t.section_id ?? INBOX;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    for (const [k, v] of m) m.set(k, sortTasks(v));
    return m;
  }, [visible, sections]);

  const currentProject = projects.find((p) => p.id === filters.projectId);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Resolve the destination section.
    const destSection = resolveDropSection(overId, "sec:", tasks);
    const list = (grouped.get(destSection) ?? []).filter(
      (t) => t.id !== activeId,
    );
    const overIndex = list.findIndex((t) => t.id === overId);
    const insertAt = overIndex === -1 ? list.length : overIndex;
    const position = computeInsertPosition(list, insertAt);

    moveTask(activeId, destSection === INBOX ? null : destSection, position);
  }

  if (loading) {
    return (
      <div className="h-full grid place-items-center text-muted text-sm">
        Loading your tasks…
      </div>
    );
  }

  const orderedKeys = [INBOX, ...sections.map((s) => s.id)];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-8 py-4 border-b border-app flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          {currentProject ? (
            <>
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: currentProject.color }}
              />
              {currentProject.name}
            </>
          ) : (
            "My Tasks"
          )}
        </h1>
        <div className="flex items-center gap-2">
          {currentProject && (
            <button
              onClick={() => setSharing(true)}
              className="flex items-center gap-1.5 border border-app rounded-lg px-3 py-1.5 text-sm surface-muted hover:surface"
            >
              <span aria-hidden>👥</span> Share
            </button>
          )}
          <FilterBar />
        </div>
      </div>

      {sharing && currentProject && (
        <ShareDialog
          projectId={currentProject.id}
          onClose={() => setSharing(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          <AiQuickAdd />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            {orderedKeys.map((key) => {
              const section = sections.find((s) => s.id === key) ?? null;
              const list = grouped.get(key) ?? [];
              if (key === INBOX && list.length === 0 && sections.length > 0)
                return null;
              return (
                <SortableContext
                  key={key}
                  items={list.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <SectionBlock
                    sectionId={key === INBOX ? null : key}
                    droppableId={`sec:${key}`}
                    name={section ? section.name : "Inbox"}
                    section={section}
                    tasks={list}
                  />
                </SortableContext>
              );
            })}
          </DndContext>

          {addingSection ? (
            <input
              autoFocus
              placeholder="Section name…"
              className="mt-4 w-full surface border border-app rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              onKeyDown={async (e) => {
                const value = e.currentTarget.value.trim();
                if (e.key === "Enter" && value) {
                  await createSection(value);
                  setAddingSection(false);
                }
                if (e.key === "Escape") setAddingSection(false);
              }}
              onBlur={() => setAddingSection(false)}
            />
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              className="mt-4 text-sm text-muted hover:text-[var(--foreground)] flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Add section
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
