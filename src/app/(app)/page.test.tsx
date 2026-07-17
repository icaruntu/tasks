import { describe, it, expect } from "vitest";
import { renderApp, screen } from "@/test/render";
import ListPage from "./page";
import { makeTask, makeSection, makeProfile } from "@/test/factories";

describe("ListPage", () => {
  it("shows a loading state before data arrives is replaced by content", async () => {
    await renderApp(<ListPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        tasks: [makeTask({ id: "t1", name: "Task A" })],
        sections: [],
      },
    });
    expect(screen.getByText("My Tasks")).toBeInTheDocument();
    expect(screen.getByText("Task A")).toBeInTheDocument();
  });

  it("groups tasks by section", async () => {
    await renderApp(<ListPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        sections: [makeSection({ id: "s1", name: "Doing" })],
        tasks: [makeTask({ id: "t1", name: "Grouped", section_id: "s1" })],
      },
    });
    expect(screen.getByText("Doing")).toBeInTheDocument();
    expect(screen.getByText("Grouped")).toBeInTheDocument();
  });

  it("adds a section", async () => {
    const { user, supabase } = await renderApp(<ListPage />, {
      seed: { profiles: [makeProfile({ id: "user-1" })], tasks: [], sections: [] },
    });
    await user.click(screen.getByText("Add section"));
    const input = screen.getByPlaceholderText("Section name…");
    await user.type(input, "Backlog{Enter}");
    expect(supabase._store.sections.some((s) => s.name === "Backlog")).toBe(true);
  });
});
