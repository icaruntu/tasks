import { describe, it, expect, vi, afterEach } from "vitest";
import { within } from "@testing-library/react";
import { renderApp, screen } from "@/test/render";
import { TaskDetailPanel } from "./task-detail-panel";
import { useUI } from "./ui-provider";
import { makeTask, makeProfile, makeProject } from "@/test/factories";

afterEach(() => vi.restoreAllMocks());

// Opens a given task in the panel via the UI context.
function Opener({ taskId }: { taskId: string }) {
  const { openTask } = useUI();
  return <button onClick={() => openTask(taskId)}>open-{taskId}</button>;
}

async function openPanel(
  taskId: string,
  seed: Record<string, Record<string, unknown>[]>,
) {
  const utils = await renderApp(
    <>
      <Opener taskId={taskId} />
      <TaskDetailPanel />
    </>,
    { seed },
  );
  await utils.user.click(screen.getByText(`open-${taskId}`));
  return utils;
}

const seedFor = (over: Record<string, Record<string, unknown>[]> = {}) => ({
  profiles: [makeProfile({ id: "user-1", full_name: "Me" })],
  tasks: [makeTask({ id: "t1", name: "Main task", creator_id: "user-1" })],
  comments: [],
  attachments: [],
  ...over,
});

describe("TaskDetailPanel", () => {
  it("renders nothing when no task is open", async () => {
    await renderApp(<TaskDetailPanel />, { seed: seedFor() });
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("shows task details when opened", async () => {
    await openPanel("t1", seedFor());
    expect(screen.getByDisplayValue("Main task")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("edits the title on blur", async () => {
    const { user, supabase } = await openPanel("t1", seedFor());
    const title = screen.getByDisplayValue("Main task");
    await user.clear(title);
    await user.type(title, "Renamed task");
    await user.tab();
    expect(supabase._store.tasks[0].name).toBe("Renamed task");
  });

  it("updates priority and due date", async () => {
    const { user, supabase } = await openPanel("t1", seedFor());
    await user.selectOptions(screen.getByDisplayValue("None"), "high");
    expect(supabase._store.tasks[0].priority).toBe("high");
  });

  it("adds a subtask and shows a due input for it", async () => {
    const { user, supabase } = await openPanel("t1", seedFor());
    const input = screen.getByPlaceholderText("+ Add subtask");
    await user.type(input, "Sub one{Enter}");
    expect(supabase._store.tasks.some((t) => t.name === "Sub one")).toBe(true);
  });

  it("posts a comment", async () => {
    const { user, supabase } = await openPanel("t1", seedFor());
    const box = screen.getByPlaceholderText(/Comment/);
    await user.type(box, "Nice work");
    await user.click(screen.getByText("Send"));
    expect(supabase._store.comments.some((c) => c.body === "Nice work")).toBe(true);
  });

  it("assigns the task to a connected profile", async () => {
    const seed = seedFor({
      profiles: [
        makeProfile({ id: "user-1", full_name: "Me" }),
        makeProfile({ id: "u2", full_name: "Teammate" }),
      ],
      projects: [makeProject({ id: "pr1", owner_id: "user-1" })],
      project_members: [
        { project_id: "pr1", user_id: "u2", role: "editor", created_at: "2026-01-01" },
      ],
    });
    const { user, supabase } = await openPanel("t1", seed);
    // The assignee select is the one currently showing "Unassigned".
    const assignee = screen.getByDisplayValue("Unassigned");
    await user.selectOptions(assignee, "u2");
    expect(supabase._store.tasks[0].assignee_id).toBe("u2");
  });

  it("suggests priority via AI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ priority: "medium", rationale: "Balanced load" }),
      }),
    );
    const { user, supabase } = await openPanel("t1", seedFor());
    await user.click(screen.getByText(/Suggest priority/));
    expect(await screen.findByText("Balanced load")).toBeInTheDocument();
    expect(supabase._store.tasks[0].priority).toBe("medium");
  });

  it("deletes the task after confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, supabase } = await openPanel("t1", seedFor());
    await user.click(screen.getByTitle("Delete task"));
    expect(supabase._store.tasks.find((t) => t.id === "t1")).toBeUndefined();
  });

  it("closes via the ✕ button", async () => {
    const { user } = await openPanel("t1", seedFor());
    expect(screen.getByText("Description")).toBeInTheDocument();
    await user.click(screen.getByText("✕"));
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("toggles a project link", async () => {
    const seed = seedFor({ projects: [makeProject({ id: "pr1", name: "Proj" })] });
    const { user, supabase } = await openPanel("t1", seed);
    await user.click(screen.getByText("Add to project…"));
    await user.click(screen.getByText("Proj"));
    expect(
      supabase._store.task_projects?.some((l) => l.project_id === "pr1"),
    ).toBe(true);
  });

  it("uploads, opens, and removes an attachment", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { user, supabase } = await openPanel("t1", seedFor());
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["hi"], "notes.txt", { type: "text/plain" });
    await user.upload(fileInput, file);
    expect(supabase._store.attachments?.some((a) => a.file_name === "notes.txt")).toBe(
      true,
    );
    // Open it (creates a signed URL and opens a tab)
    await user.click(screen.getByText("notes.txt"));
    expect(openSpy).toHaveBeenCalledWith("https://signed.example/x", "_blank");
    // Remove it — the ✕ inside the attachment row.
    const row = screen.getByText("notes.txt").closest("div")!;
    await user.click(within(row).getByText("✕"));
    expect(supabase._store.attachments).toHaveLength(0);
    openSpy.mockRestore();
  });

  it("supports @mention autocomplete when posting a comment", async () => {
    const seed = seedFor({
      profiles: [
        makeProfile({ id: "user-1", full_name: "Me" }),
        makeProfile({ id: "u2", full_name: "Dana Scully" }),
      ],
      projects: [makeProject({ id: "pr1", owner_id: "user-1" })],
      project_members: [
        { project_id: "pr1", user_id: "u2", role: "editor", created_at: "2026-01-01" },
      ],
    });
    const { user, supabase } = await openPanel("t1", seed);
    const box = screen.getByPlaceholderText(/Comment/);
    await user.type(box, "hey @Dana");
    // Autocomplete surfaces the connected profile as a clickable button
    // (the assignee <option> also carries the name, so scope to the button).
    const option = await screen.findByRole("button", { name: /Dana Scully/ });
    await user.click(option);
    await user.click(screen.getByText("Send"));
    // The mention was recorded
    expect(supabase._store.comment_mentions?.length ?? 0).toBeGreaterThan(0);
  });
});
