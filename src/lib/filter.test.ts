import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { applyFilters, sortTasks } from "./filter";
import { DEFAULT_FILTERS, type Task, type ViewFilters } from "./types";

const NOW = new Date("2026-07-15T12:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

let seq = 0;
function task(over: Partial<Task> = {}): Task {
  return {
    id: `t${++seq}`,
    creator_id: "u1",
    assignee_id: null,
    section_id: null,
    parent_task_id: null,
    name: "Task",
    description: null,
    priority: null,
    due_date: null,
    completed: false,
    completed_at: null,
    position: 1000,
    recurrence: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    project_ids: [],
    subtask_count: 0,
    subtask_done: 0,
    comment_count: 0,
    ...over,
  };
}

const filters = (over: Partial<ViewFilters> = {}): ViewFilters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe("applyFilters", () => {
  it("filters by completion", () => {
    const list = [task({ completed: false }), task({ completed: true })];
    expect(applyFilters(list, filters({ completion: "incomplete" }))).toHaveLength(1);
    expect(applyFilters(list, filters({ completion: "complete" }))).toHaveLength(1);
    expect(applyFilters(list, filters({ completion: "all" }))).toHaveLength(2);
  });

  it("filters by project membership", () => {
    const list = [task({ project_ids: ["p1"] }), task({ project_ids: ["p2"] })];
    expect(applyFilters(list, filters({ projectId: "p1" }))).toHaveLength(1);
  });

  it("filters by priority", () => {
    const list = [task({ priority: "high" }), task({ priority: "low" }), task()];
    const out = applyFilters(list, filters({ priorities: ["high"] }));
    expect(out).toHaveLength(1);
    expect(out[0].priority).toBe("high");
  });

  it("filters by due date", () => {
    const list = [
      task({ due_date: NOW.toISOString() }),
      task({ due_date: "2026-08-01T00:00:00Z" }),
    ];
    expect(applyFilters(list, filters({ due: "today" }))).toHaveLength(1);
  });

  it("filters by case-insensitive search over name and description", () => {
    const list = [
      task({ name: "Buy MILK" }),
      task({ name: "x", description: "call the plumber" }),
      task({ name: "unrelated" }),
    ];
    expect(applyFilters(list, filters({ search: "milk" }))).toHaveLength(1);
    expect(applyFilters(list, filters({ search: "plumber" }))).toHaveLength(1);
    expect(applyFilters(list, filters({ search: "  " }))).toHaveLength(3);
  });
});

describe("sortTasks", () => {
  it("puts incomplete before complete, then orders by position", () => {
    const list = [
      task({ id: "a", completed: true, position: 1 }),
      task({ id: "b", completed: false, position: 20 }),
      task({ id: "c", completed: false, position: 10 }),
    ];
    expect(sortTasks(list).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input", () => {
    const list = [task({ position: 2 }), task({ position: 1 })];
    const copy = [...list];
    sortTasks(list);
    expect(list).toEqual(copy);
  });
});
