import type { Task, ViewFilters } from "@/lib/types";
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

/** Stable sort: incomplete first, then by position. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.position - b.position;
  });
}
