"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useWorkspace } from "./workspace-provider";
import { useUI } from "./ui-provider";
import { SortableTaskRow } from "./task-row";
import type { Section, Task } from "@/lib/types";

export function SectionBlock({
  sectionId,
  droppableId,
  name,
  section,
  tasks,
}: {
  sectionId: string | null;
  droppableId: string;
  name: string;
  section: Section | null;
  tasks: Task[];
}) {
  const { createTask, updateSection, deleteSection, setTaskProjects, tasks: allTop } =
    useWorkspace();
  const { filters } = useUI();
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);

  async function addTask(nameStr: string) {
    const val = nameStr.trim();
    if (!val) return;
    const maxPos = allTop
      .filter((t) => (t.section_id ?? null) === sectionId)
      .reduce((m, t) => Math.max(m, t.position), 0);
    const created = await createTask({
      name: val,
      section_id: sectionId,
      position: maxPos + 1000,
      priority: null,
    });
    // If viewing a project, add new tasks to that project automatically.
    if (created && filters.projectId) {
      await setTaskProjects(created.id, [filters.projectId]);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1 group">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted text-xs w-4"
        >
          {collapsed ? "▸" : "▾"}
        </button>
        {renaming && section ? (
          <input
            autoFocus
            defaultValue={section.name}
            className="text-sm font-semibold surface-muted border border-app rounded px-2 py-0.5 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateSection(section.id, {
                  name: e.currentTarget.value.trim() || section.name,
                });
                setRenaming(false);
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={(e) => {
              updateSection(section.id, {
                name: e.currentTarget.value.trim() || section.name,
              });
              setRenaming(false);
            }}
          />
        ) : (
          <h2
            className="text-sm font-semibold cursor-pointer"
            onClick={() => section && setRenaming(true)}
          >
            {name}
          </h2>
        )}
        <span className="text-xs text-muted">{tasks.length}</span>
        {section && (
          <button
            onClick={() => {
              if (confirm(`Delete section "${section.name}"? Tasks move to Inbox.`))
                deleteSection(section.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-500 text-xs ml-auto"
            title="Delete section"
          >
            🗑
          </button>
        )}
      </div>

      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`surface border border-app rounded-xl overflow-hidden transition ${
            isOver ? "ring-2 ring-[var(--color-primary)]" : ""
          }`}
        >
          {tasks.map((t) => (
            <SortableTaskRow key={t.id} task={t} />
          ))}
          {tasks.length === 0 && !adding && (
            <p className="text-xs text-muted px-4 py-3">No tasks</p>
          )}

          {adding ? (
            <input
              autoFocus
              placeholder="Task name, press Enter…"
              className="w-full px-4 py-2.5 text-sm outline-none surface border-t border-app"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  await addTask(e.currentTarget.value);
                  e.currentTarget.value = "";
                }
                if (e.key === "Escape") setAdding(false);
              }}
              onBlur={() => setAdding(false)}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:surface-muted border-t border-app flex items-center gap-2"
            >
              <span className="text-base leading-none">+</span> Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
