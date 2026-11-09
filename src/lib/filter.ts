import type { Task, TaskSort, ViewFilters } from "@/lib/types";
import { matchesDueFilter } from "@/lib/dates";

export function applyFilters(tasks: Task[], f: ViewFilters): Task[] {
  const q = f.search.trim().toLowerCase();
  return tasks.filter((t) => {
    // Completion
    if (f.completion === "incomplete" && t.completed) return false;
    if (f.completion === "complete" && !t.completed) return false;

    // Project
    if (f.projectId && !t.project_ids.includes(f.projectId)) return false;

    // Priority
    if (f.priorities.length && (!t.priority || !f.priorities.includes(t.priority)))
      return false;

    // Due date
    if (!matchesDueFilter(t.due_date, f.due)) return false;

    // Search
    if (q) {
      const hay = `${t.name} ${t.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Stable sort: incomplete first, then by the chosen order.
 * - "manual": by position (drag-and-drop order)
 * - "due_asc" / "due_desc": by due date; tasks without a due date always go
 *   last, ties fall back to position.
 */
export function sortTasks(tasks: Task[], sort: TaskSort = "manual"): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sort !== "manual" && a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      const diff = Date.parse(a.due_date) - Date.parse(b.due_date);
      if (diff !== 0) return sort === "due_asc" ? diff : -diff;
    }
    return a.position - b.position;
  });
}
