import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  matchesDueFilter,
  formatDueLabel,
  isOverdue,
  toDateInputValue,
} from "./dates";

// Freeze "now" to a Wednesday so week math is deterministic.
const NOW = new Date("2026-07-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const iso = (s: string) => new Date(s).toISOString();

describe("matchesDueFilter", () => {
  it("returns true when no filter set", () => {
    expect(matchesDueFilter(null, null)).toBe(true);
    expect(matchesDueFilter(iso("2026-07-15"), null)).toBe(true);
  });

  it("returns false for a missing due date when a filter is active", () => {
    expect(matchesDueFilter(null, "today")).toBe(false);
  });

  it("matches today / tomorrow", () => {
    expect(matchesDueFilter(iso("2026-07-15T09:00:00Z"), "today")).toBe(true);
    expect(matchesDueFilter(iso("2026-07-16T09:00:00Z"), "today")).toBe(false);
    expect(matchesDueFilter(iso("2026-07-16T09:00:00Z"), "tomorrow")).toBe(true);
  });

  it("matches overdue (before today only)", () => {
    expect(matchesDueFilter(iso("2026-07-10T09:00:00Z"), "overdue")).toBe(true);
    expect(matchesDueFilter(iso("2026-07-15T09:00:00Z"), "overdue")).toBe(false);
    expect(matchesDueFilter(iso("2026-07-20T09:00:00Z"), "overdue")).toBe(false);
  });

  it("matches this_week and next_week", () => {
    expect(matchesDueFilter(iso("2026-07-13T09:00:00Z"), "this_week")).toBe(true);
    expect(matchesDueFilter(iso("2026-07-20T09:00:00Z"), "this_week")).toBe(false);
    expect(matchesDueFilter(iso("2026-07-22T09:00:00Z"), "next_week")).toBe(true);
  });

  it("matches within_14 days", () => {
    expect(matchesDueFilter(iso("2026-07-20T09:00:00Z"), "within_14")).toBe(true);
    expect(matchesDueFilter(iso("2026-08-30T09:00:00Z"), "within_14")).toBe(false);
  });

  it("falls through to true for an unknown filter", () => {
    expect(matchesDueFilter(iso("2026-07-15"), "bogus" as never)).toBe(true);
  });
});

describe("formatDueLabel", () => {
  it("returns empty for null", () => {
    expect(formatDueLabel(null)).toBe("");
  });
  it("labels today / tomorrow", () => {
    expect(formatDueLabel(iso("2026-07-15T09:00:00Z"))).toBe("Today");
    expect(formatDueLabel(iso("2026-07-16T09:00:00Z"))).toBe("Tomorrow");
  });
  it("formats same-year and other-year dates", () => {
    expect(formatDueLabel(iso("2026-03-05T09:00:00Z"))).toBe("Mar 5");
    expect(formatDueLabel(iso("2027-03-05T09:00:00Z"))).toBe("Mar 5, 2027");
  });
});

describe("isOverdue", () => {
  it("is false for null", () => {
    expect(isOverdue(null)).toBe(false);
  });
  it("is true only before today", () => {
    expect(isOverdue(iso("2026-07-14T09:00:00Z"))).toBe(true);
    expect(isOverdue(iso("2026-07-15T09:00:00Z"))).toBe(false);
    expect(isOverdue(iso("2026-07-16T09:00:00Z"))).toBe(false);
  });
});

describe("toDateInputValue", () => {
  it("returns empty for null", () => {
    expect(toDateInputValue(null)).toBe("");
  });
  it("formats to yyyy-MM-dd", () => {
    expect(toDateInputValue(iso("2026-07-15T09:00:00Z"))).toBe("2026-07-15");
  });
});
