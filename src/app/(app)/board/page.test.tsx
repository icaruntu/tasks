import { describe, it, expect } from "vitest";
import { renderApp, screen } from "@/test/render";
import BoardPage from "./page";
import { makeTask, makeSection, makeProfile } from "@/test/factories";

describe("BoardPage", () => {
  it("renders columns for inbox and sections with their tasks", async () => {
    await renderApp(<BoardPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        sections: [makeSection({ id: "s1", name: "In progress" })],
        tasks: [
          makeTask({ id: "t1", name: "Inbox task", section_id: null }),
          makeTask({ id: "t2", name: "WIP task", section_id: "s1" }),
        ],
      },
    });
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Inbox task")).toBeInTheDocument();
    expect(screen.getByText("WIP task")).toBeInTheDocument();
  });

  it("toggles a card's completion", async () => {
    const { user, supabase } = await renderApp(<BoardPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        tasks: [makeTask({ id: "t1", name: "Card", completed: false })],
      },
    });
    await user.click(screen.getByTitle("Mark complete"));
    expect(supabase._store.tasks[0].completed).toBe(true);
  });

  it("renders card metadata (priority, due, subtasks, assignee)", async () => {
    await renderApp(<BoardPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1", full_name: "Ann" })],
        tasks: [
          makeTask({
            id: "p",
            name: "Rich card",
            priority: "high",
            due_date: "2026-07-20T09:00:00Z",
            assignee_id: "user-1",
          }),
          makeTask({ id: "s", parent_task_id: "p", completed: true }),
        ],
      },
    });
    expect(screen.getByText("Rich card")).toBeInTheDocument();
    expect(screen.getByText("☑ 1/1")).toBeInTheDocument();
  });
});
