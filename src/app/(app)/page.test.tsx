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

describe("ListPage sorting", () => {
  it("sorts tasks by due date when chosen", async () => {
    const { user } = await renderApp(<ListPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        sections: [],
        tasks: [
          makeTask({ id: "a", name: "No date", position: 1, due_date: null }),
          makeTask({ id: "b", name: "Later", position: 2, due_date: "2026-12-20" }),
          makeTask({ id: "c", name: "Sooner", position: 3, due_date: "2026-12-01" }),
        ],
      },
    });
    const names = () =>
      screen
        .getAllByText(/^(No date|Later|Sooner)$/)
        .map((el) => el.textContent);
    expect(names()).toEqual(["No date", "Later", "Sooner"]);

    await user.selectOptions(screen.getByLabelText("Sort tasks"), "due_asc");
    expect(names()).toEqual(["Sooner", "Later", "No date"]);

    await user.selectOptions(screen.getByLabelText("Sort tasks"), "due_desc");
    expect(names()).toEqual(["Later", "Sooner", "No date"]);
  });
});
