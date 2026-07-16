"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useWorkspace } from "./workspace-provider";
import { useUI } from "./ui-provider";
import { Check, DueBadge, PriorityDot, Avatar } from "./ui";
import type { Task } from "@/lib/types";

export function SortableTaskRow({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <TaskRow task={task} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  );
}

export function TaskRow({
  task,
  dragHandle,
}: {
  task: Task;
  dragHandle?: Record<string, unknown>;
}) {
  const { toggleComplete, profiles } = useWorkspace();
  const { openTask, openTaskId } = useUI();
  const assignee = profiles.find((p) => p.id === task.assignee_id);

  return (
    <div
      onClick={() => openTask(task.id)}
      className={`group flex items-center gap-3 pl-2 pr-3 py-2 border-b border-app cursor-pointer transition ${
        openTaskId === task.id ? "surface-muted" : "hover:surface-muted"
      }`}
    >
      <span
        {...dragHandle}
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 text-muted cursor-grab active:cursor-grabbing px-0.5 select-none"
        title="Drag to reorder"
      >
        ⠿
      </span>

      <Check
        checked={task.completed}
        onChange={() => toggleComplete(task.id, !task.completed)}
      />

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm truncate ${
            task.completed ? "line-through text-muted" : ""
          }`}
        >
          {task.name}
        </p>
        <div className="flex items-center gap-2.5 mt-0.5 empty:hidden">
          {task.priority && <PriorityDot priority={task.priority} />}
          {task.subtask_count > 0 && (
            <span className="text-[11px] text-muted">
              ☑ {task.subtask_done}/{task.subtask_count}
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="text-[11px] text-muted">💬 {task.comment_count}</span>
          )}
          {task.recurrence && (
            <span className="text-[11px] text-muted" title="Repeats">
              🔁
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <DueBadge date={task.due_date} />
        {assignee && <Avatar profile={assignee} size={22} />}
      </div>
    </div>
  );
}
