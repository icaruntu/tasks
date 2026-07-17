import { format, isToday, isTomorrow, isThisYear, startOfDay } from "date-fns";

export function formatDueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, isThisYear(d) ? "MMM d" : "MMM d, yyyy");
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return startOfDay(new Date(dueDate)) < startOfDay(new Date());
}
