import type { Task } from "@/lib/types";

export const INBOX = "__inbox__";

/** Resolve the destination section id from a drop target id. */
export function resolveDropSection(
  overId: string,
  prefix: string,
  tasks: Pick<Task, "id" | "section_id">[],
): string {
  if (overId.startsWith(prefix)) return overId.slice(prefix.length);
  const overTask = tasks.find((t) => t.id === overId);
  return overTask?.section_id ?? INBOX;
}

/**
 * Compute the fractional position for a task dropped at `insertAt` within an
 * ordered list (list view). Uses midpoint between neighbours, or ±1000 at ends.
 */
export function computeInsertPosition(
  list: Pick<Task, "position">[],
  insertAt: number,
): number {
  const prev = list[insertAt - 1];
  const next = list[insertAt];
  if (prev && next) return (prev.position + next.position) / 2;
  if (prev) return prev.position + 1000;
  if (next) return next.position - 1000;
  return 1000;
}

/** Append position = max(existing) + 1000 (board columns). */
export function appendPosition(list: Pick<Task, "position">[]): number {
  return list.reduce((m, t) => Math.max(m, t.position), 0) + 1000;
}

/**
 * Given a target day (yyyy-MM-dd) and an existing due date, return the new ISO
 * due date preserving the time-of-day (or 9am when previously unset). Returns
 * null when the day did not actually change.
 */
export function rescheduleToDay(
  dayKey: string,
  currentDue: string | null,
): string | null {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const next = currentDue ? new Date(currentDue) : new Date();
  if (!currentDue) next.setHours(9, 0, 0, 0);
  next.setFullYear(y, mo - 1, d);
  const sameDay =
    currentDue &&
    new Date(currentDue).toISOString().slice(0, 10) ===
      next.toISOString().slice(0, 10);
  return sameDay ? null : next.toISOString();
}

export type MovePlan = {
  id: string;
  sectionId: string | null;
  position: number;
};

/** Plan a list-view reorder/move from a drag (null = no-op). */
export function planListMove(
  activeId: string,
  overId: string,
  tasks: Pick<Task, "id" | "section_id">[],
  grouped: Map<string, Pick<Task, "id" | "position">[]>,
): MovePlan | null {
  if (activeId === overId) return null;
  const destSection = resolveDropSection(overId, "sec:", tasks);
  const list = (grouped.get(destSection) ?? []).filter((t) => t.id !== activeId);
  const overIndex = list.findIndex((t) => t.id === overId);
  const insertAt = overIndex === -1 ? list.length : overIndex;
  const position = computeInsertPosition(list, insertAt);
  return { id: activeId, sectionId: destSection === INBOX ? null : destSection, position };
}

/** Plan a board-view move (append to the destination column). */
export function planBoardMove(
  activeId: string,
  overId: string,
  tasks: Pick<Task, "id" | "section_id">[],
  grouped: Map<string, Pick<Task, "position">[]>,
): MovePlan {
  const destSection = resolveDropSection(overId, "col:", tasks);
  const position = appendPosition(grouped.get(destSection) ?? []);
  return { id: activeId, sectionId: destSection === INBOX ? null : destSection, position };
}

/** Plan a calendar reschedule from a drop onto a day cell (null = no-op). */
export function planCalendarReschedule(
  activeId: string,
  overId: string,
  tasks: Pick<Task, "id" | "due_date">[],
): { id: string; due_date: string } | null {
  if (!overId.startsWith("day:")) return null;
  const task = tasks.find((t) => t.id === activeId);
  if (!task) return null;
  const nextDue = rescheduleToDay(overId.slice(4), task.due_date);
  return nextDue ? { id: activeId, due_date: nextDue } : null;
}
