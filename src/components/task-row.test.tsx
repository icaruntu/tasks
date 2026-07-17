import { describe, it, expect } from "vitest";
import { renderApp, screen } from "@/test/render";
import { TaskRow, SubtaskRow } from "./task-row";
import { makeTask, makeProfile } from "@/test/factories";
import type { Task } from "@/lib/types";

const asTask = (over: Partial<Task> = {}): Task => ({
  ...makeTask(),
  project_ids: [],
  subtask_count: 0,
  subtask_done: 0,
  comment_count: 0,
  ...over,
});

describe("TaskRow", () => {
  it("renders the task name and metadata badges", async () => {
    const task = asTask({
      name: "Ship it",
      priority: "high",
      due_date: "2026-07-20T09:00:00Z",
      subtask_count: 3,
      subtask_done: 1,
      comment_count: 2,
      recurrence: "weekly",
    });
    await renderApp(<TaskRow task={task} />, { seed: { profiles: [] } });
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("☑ 1/3")).toBeInTheDocument();
    expect(screen.getByText("💬 2")).toBeInTheDocument();
    expect(screen.getByText("🔁")).toBeInTheDocument();
  });

  it("toggles completion via the checkbox and writes to supabase", async () => {
    const task = asTask({ id: "t-toggle", completed: false });
    const { user, supabase } = await renderApp(<TaskRow task={task} />, {
      seed: { tasks: [makeTask({ id: "t-toggle" })], profiles: [] },
    });
    await user.click(screen.getByTitle("Mark complete"));
    expect(supabase._store.tasks[0].completed).toBe(true);
  });

  it("shows the assignee avatar when assigned", async () => {
    const assignee = makeProfile({ id: "a1", full_name: "Dana Scully" });
    const task = asTask({ assignee_id: "a1" });
    await renderApp(<TaskRow task={task} />, {
      seed: { profiles: [assignee] },
    });
    expect(screen.getByTitle("Dana Scully")).toBeInTheDocument();
  });
});

describe("SubtaskRow", () => {
  it("renders indented with a due badge and toggles completion", async () => {
    const sub = makeTask({
      id: "s1",
      name: "A subtask",
      parent_task_id: "p1",
      due_date: "2026-07-20T09:00:00Z",
      priority: "low",
    });
    const { user, supabase } = await renderApp(<SubtaskRow subtask={sub} />, {
      seed: { tasks: [makeTask({ id: "s1", parent_task_id: "p1" })], profiles: [] },
    });
    expect(screen.getByText("A subtask")).toBeInTheDocument();
    await user.click(screen.getByTitle("Mark complete"));
    expect(supabase._store.tasks[0].completed).toBe(true);
  });
});
