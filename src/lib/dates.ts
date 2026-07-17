import {
  isToday,
  isTomorrow,
  isPast,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  isWithinInterval,
  format,
  isThisYear,
} from "date-fns";
import type { DueFilter } from "@/lib/types";

/** Does a due date match the given due filter? */
export function matchesDueFilter(
  dueDate: string | null,
  filter: DueFilter,
): boolean {
  if (!filter) return true;
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();

  switch (filter) {
    case "overdue":
      return isPast(endOfDay(d)) && !isToday(d) && startOfDay(d) < startOfDay(now);
    case "today":
      return isToday(d);
    case "tomorrow":
      return isTomorrow(d);
    case "this_week":
      return isWithinInterval(d, {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      });
    case "next_week":
      return isWithinInterval(d, {
        start: startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 }),
        end: endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 }),
      });
    case "within_14":
      return isWithinInterval(d, {
        start: startOfDay(now),
        end: endOfDay(addDays(now, 14)),
      });
    default:
      return true;
  }
}

/** Short human label for a due date, e.g. "Today", "Tomorrow", "Mar 5". */
export function formatDueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, isThisYear(d) ? "MMM d" : "MMM d, yyyy");
}

/** Is the due date in the past (before today)? */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  return startOfDay(d) < startOfDay(new Date());
}

export function toDateInputValue(dueDate: string | null): string {
  if (!dueDate) return "";
  return format(new Date(dueDate), "yyyy-MM-dd");
}

/**
 * Convert a `<input type="date">` value (yyyy-MM-dd) to an ISO string anchored
 * at local noon. `new Date("yyyy-MM-dd")` parses as UTC midnight, which renders
 * back as the previous day for users west of UTC (#26); building the date from
 * local components and using noon avoids any DST/offset day-shift.
 */
export function dateInputToISO(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}
