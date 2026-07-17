import { describe, it, expect } from "vitest";
import {
  INBOX,
  resolveDropSection,
  computeInsertPosition,
  appendPosition,
  rescheduleToDay,
  planListMove,
  planBoardMove,
  planCalendarReschedule,
} from "./dnd";

const t = (id: string, section_id: string | null, position = 0) => ({
  id,
  section_id,
  position,
});

describe("resolveDropSection", () => {
  it("extracts the section id from a prefixed drop target", () => {
    expect(resolveDropSection("sec:abc", "sec:", [])).toBe("abc");
    expect(resolveDropSection("col:xyz", "col:", [])).toBe("xyz");
  });
  it("falls back to the section of the task being dropped onto", () => {
    expect(resolveDropSection("t1", "sec:", [t("t1", "s9")])).toBe("s9");
  });
  it("returns INBOX when the over-task has no section", () => {
    expect(resolveDropSection("t1", "sec:", [t("t1", null)])).toBe(INBOX);
    expect(resolveDropSection("missing", "sec:", [])).toBe(INBOX);
  });
});

describe("computeInsertPosition", () => {
  const list = [{ position: 1000 }, { position: 2000 }, { position: 3000 }];
  it("midpoints between two neighbours", () => {
    expect(computeInsertPosition(list, 1)).toBe(1500);
  });
  it("adds 1000 after the last when only a prev exists", () => {
    expect(computeInsertPosition(list, 3)).toBe(4000);
  });
  it("subtracts 1000 before the first when only a next exists", () => {
    expect(computeInsertPosition(list, 0)).toBe(0);
  });
  it("defaults to 1000 for an empty list", () => {
    expect(computeInsertPosition([], 0)).toBe(1000);
  });
});

describe("appendPosition", () => {
  it("returns max + 1000", () => {
    expect(appendPosition([{ position: 500 }, { position: 2500 }])).toBe(3500);
  });
  it("returns 1000 for an empty column", () => {
    expect(appendPosition([])).toBe(1000);
  });
});

describe("rescheduleToDay", () => {
  it("moves the day while preserving the time", () => {
    const out = rescheduleToDay("2026-08-01", "2026-07-15T14:30:00.000Z");
    expect(out).not.toBeNull();
    expect(out!.slice(0, 10)).toBe("2026-08-01");
  });
  it("defaults an unset due date to 9am on the target day", () => {
    const out = rescheduleToDay("2026-08-01", null);
    expect(out).not.toBeNull();
    expect(out!.slice(0, 10)).toBe("2026-08-01");
  });
  it("returns null when the day does not change", () => {
    const iso = new Date("2026-07-15T14:30:00").toISOString();
    const key = iso.slice(0, 10);
    expect(rescheduleToDay(key, iso)).toBeNull();
  });
});

describe("planListMove", () => {
  const tasks = [
    { id: "a", section_id: null },
    { id: "b", section_id: "s1" },
    { id: "c", section_id: "s1" },
  ];
  const grouped = new Map<string, { id: string; position: number }[]>([
    [INBOX, [{ id: "a", position: 1000 }]],
    ["s1", [{ id: "b", position: 1000 }, { id: "c", position: 2000 }]],
  ]);

  it("returns null when dropped on itself", () => {
    expect(planListMove("a", "a", tasks, grouped)).toBeNull();
  });

  it("moves into a section dropped on a task, computing a midpoint", () => {
    const plan = planListMove("a", "c", tasks, grouped);
    expect(plan).toEqual({ id: "a", sectionId: "s1", position: 1500 });
  });

  it("maps the inbox column back to a null section", () => {
    const plan = planListMove("b", "sec:__inbox__", tasks, grouped);
    expect(plan).toEqual({ id: "b", sectionId: null, position: 2000 });
  });
});

describe("planBoardMove", () => {
  const tasks = [{ id: "a", section_id: null }];
  const grouped = new Map<string, { position: number }[]>([
    ["s1", [{ position: 1000 }, { position: 3000 }]],
  ]);

  it("appends to the destination column", () => {
    expect(planBoardMove("a", "col:s1", tasks, grouped)).toEqual({
      id: "a",
      sectionId: "s1",
      position: 4000,
    });
  });

  it("maps the inbox column to a null section", () => {
    expect(planBoardMove("a", "col:__inbox__", tasks, grouped)).toEqual({
      id: "a",
      sectionId: null,
      position: 1000,
    });
  });
});

describe("planCalendarReschedule", () => {
  const tasks = [{ id: "a", due_date: "2026-07-15T14:00:00.000Z" }];

  it("returns null when not dropped on a day cell", () => {
    expect(planCalendarReschedule("a", "not-a-day", tasks)).toBeNull();
  });

  it("returns null for an unknown task", () => {
    expect(planCalendarReschedule("zzz", "day:2026-08-01", tasks)).toBeNull();
  });

  it("returns the new due date when the day changes", () => {
    const plan = planCalendarReschedule("a", "day:2026-08-01", tasks);
    expect(plan?.id).toBe("a");
    expect(plan?.due_date.slice(0, 10)).toBe("2026-08-01");
  });

  it("returns null when the day is unchanged", () => {
    const key = new Date("2026-07-15T14:00:00.000Z").toISOString().slice(0, 10);
    expect(planCalendarReschedule("a", `day:${key}`, tasks)).toBeNull();
  });
});
