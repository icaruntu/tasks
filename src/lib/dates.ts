import {
  addDays,
  addHours,
  isToday,
  isTomorrow,
  isPast,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
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

/** Short human label for a due date, including its local time. */
export function formatDueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  const day = isToday(d)
    ? "Today"
    : isTomorrow(d)
      ? "Tomorrow"
      : format(d, isThisYear(d) ? "MMM d" : "MMM d, yyyy");
  return `${day}, ${format(d, "HH:mm")}`;
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

export function toTimeInputValue(dueDate: string | null): string {
  return dueDate ? format(new Date(dueDate), "HH:mm") : "09:00";
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

/** Convert the separate local date and time inputs into a timezone-safe instant. */
export function dateTimeInputToISO(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hours = 9, minutes = 0] = time.split(":").map(Number);
  if (!y || !m || !d || hours > 23 || minutes > 59) return null;
  return new Date(y, m - 1, d, hours, minutes, 0, 0).toISOString();
}

/** Quick rescheduling presets used by the web and native task editors. */
export function snoozeDueDate(
  dueDate: string | null,
  preset: "hour" | "tomorrow",
): string {
  const base = dueDate && new Date(dueDate) > new Date() ? new Date(dueDate) : new Date();
  if (preset === "hour") return addHours(base, 1).toISOString();
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}
