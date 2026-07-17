import { describe, it, expect, vi } from "vitest";
import { renderApp, screen } from "@/test/render";
import { SectionBlock } from "./section-block";
import { makeSection, makeTask } from "@/test/factories";
import type { Task } from "@/lib/types";

const asTask = (over: Partial<Task> = {}): Task => ({
  ...makeTask(),
  project_ids: [],
  subtask_count: 0,
  subtask_done: 0,
  comment_count: 0,
  ...over,
});

describe("SectionBlock", () => {
  it("renders the section name, count, and its tasks", async () => {
    await renderApp(
      <SectionBlock
        sectionId="s1"
        droppableId="sec:s1"
        name="Today"
        section={makeSection({ id: "s1", name: "Today" })}
        tasks={[asTask({ id: "t1", name: "First" })]}
      />,
      { seed: { tasks: [makeTask({ id: "t1", section_id: "s1" })], profiles: [] } },
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
  });

  it("renders subtasks indented under their parent", async () => {
    await renderApp(
      <SectionBlock
        sectionId={null}
        droppableId="sec:inbox"
        name="Inbox"
        section={null}
        tasks={[asTask({ id: "p1", name: "Parent", subtask_count: 1 })]}
      />,
      {
        seed: {
          tasks: [
            makeTask({ id: "p1" }),
            makeTask({ id: "s1", name: "Child sub", parent_task_id: "p1" }),
          ],
          profiles: [],
        },
      },
    );
    expect(screen.getByText("Child sub")).toBeInTheDocument();
  });

  it("adds a task via the inline input", async () => {
    const { user, supabase } = await renderApp(
      <SectionBlock
        sectionId="s1"
        droppableId="sec:s1"
        name="Today"
        section={makeSection({ id: "s1" })}
        tasks={[]}
      />,
      { seed: { tasks: [], profiles: [] } },
    );
    await user.click(screen.getByText("Add task"));
    const input = screen.getByPlaceholderText("Task name, press Enter…");
    await user.type(input, "Brand new{Enter}");
    expect(supabase._store.tasks.some((t) => t.name === "Brand new")).toBe(true);
  });

  it("collapses and expands", async () => {
    const { user } = await renderApp(
      <SectionBlock
        sectionId="s1"
        droppableId="sec:s1"
        name="Today"
        section={makeSection({ id: "s1" })}
        tasks={[asTask({ id: "t1", name: "Visible" })]}
      />,
      { seed: { tasks: [makeTask({ id: "t1" })], profiles: [] } },
    );
    expect(screen.getByText("Visible")).toBeInTheDocument();
    await user.click(screen.getByText("▾"));
    expect(screen.queryByText("Visible")).not.toBeInTheDocument();
  });

  it("renames a section", async () => {
    const { user, supabase } = await renderApp(
      <SectionBlock
        sectionId="s1"
        droppableId="sec:s1"
        name="Today"
        section={makeSection({ id: "s1", name: "Today" })}
        tasks={[]}
      />,
      { seed: { sections: [makeSection({ id: "s1", name: "Today" })], tasks: [] } },
    );
    await user.click(screen.getByText("Today"));
    const input = screen.getByDisplayValue("Today");
    await user.clear(input);
    await user.type(input, "Tomorrow{Enter}");
    expect(supabase._store.sections[0].name).toBe("Tomorrow");
  });

  it("deletes a section after confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, supabase } = await renderApp(
      <SectionBlock
        sectionId="s1"
        droppableId="sec:s1"
        name="Today"
        section={makeSection({ id: "s1", name: "Today" })}
        tasks={[]}
      />,
      { seed: { sections: [makeSection({ id: "s1" })], tasks: [] } },
    );
    await user.click(screen.getByTitle("Delete section"));
    expect(supabase._store.sections).toHaveLength(0);
  });
});
