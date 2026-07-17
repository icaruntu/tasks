import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { WorkspaceProvider, useWorkspace } from "./workspace-provider";
import { createSupabaseMock } from "@/test/supabase-mock";
import {
  makeTask,
  makeProfile,
  makeProject,
  makeSection,
  makeMember,
} from "@/test/factories";

// Drive the context through an imperative handle exposed on window.
function expose() {
  function Bridge() {
    const ws = useWorkspace();
    (window as unknown as Record<string, unknown>).__ws__ = ws;
    return <span data-testid="loading">{ws.loading ? "loading" : "ready"}</span>;
  }
  return Bridge;
}

async function mount(seed = {}, userId = "user-1") {
  const supabase = createSupabaseMock(seed, { userId });
  (globalThis as Record<string, unknown>).__mockSupabase__ = supabase;
  const Bridge = expose();
  render(
    <WorkspaceProvider userId={userId}>
      <Bridge />
    </WorkspaceProvider>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  const ws = () => (window as unknown as Record<string, unknown>).__ws__ as ReturnType<typeof useWorkspace>;
  return { supabase, ws };
}

describe("WorkspaceProvider data loading", () => {
  it("throws when useWorkspace is used outside the provider", () => {
    function Bad() {
      useWorkspace();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/useWorkspace must be used inside/);
  });

  it("loads and enriches top-level tasks with counts", async () => {
    const { ws } = await mount({
      profiles: [makeProfile({ id: "user-1" })],
      tasks: [
        makeTask({ id: "p", name: "Parent" }),
        makeTask({ id: "c", parent_task_id: "p", completed: true }),
      ],
      comments: [{ id: "cm1", task_id: "p" }],
      task_projects: [{ task_id: "p", project_id: "pr1" }],
    });
    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    const tasks = ws().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subtask_count).toBe(1);
    expect(tasks[0].subtask_done).toBe(1);
    expect(tasks[0].comment_count).toBe(1);
    expect(tasks[0].project_ids).toEqual(["pr1"]);
    expect(ws().subtasksOf("p")).toHaveLength(1);
    expect(ws().projectIdsOf("p")).toEqual(["pr1"]);
  });

  it("resolves the active plan from subscriptions", async () => {
    const { ws } = await mount({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }],
    });
    expect(ws().plan).toBe("pro");
    expect(ws().limits.maxProjects).toBe(Infinity);
  });

  it("treats an inactive subscription as free", async () => {
    const { ws } = await mount({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "canceled" }],
    });
    expect(ws().plan).toBe("free");
  });
});

describe("task mutations", () => {
  it("createTask inserts and appends", async () => {
    const { ws, supabase } = await mount({ tasks: [] });
    await act(async () => {
      await ws().createTask({ name: "New" });
    });
    expect(supabase._store.tasks).toHaveLength(1);
    expect(ws().tasks[0].name).toBe("New");
  });

  it("updateTask patches optimistically and persists", async () => {
    const { ws, supabase } = await mount({
      tasks: [makeTask({ id: "t1", name: "Old" })],
    });
    await act(async () => {
      await ws().updateTask("t1", { name: "Renamed" });
    });
    expect(ws().tasks[0].name).toBe("Renamed");
    expect(supabase._store.tasks[0].name).toBe("Renamed");
  });

  it("toggleComplete sets completed and completed_at", async () => {
    const { ws, supabase } = await mount({
      tasks: [makeTask({ id: "t1", completed: false })],
    });
    await act(async () => {
      await ws().toggleComplete("t1", true);
    });
    expect(ws().tasks[0].completed).toBe(true);
    expect(ws().tasks[0].completed_at).not.toBeNull();
    expect(supabase._store.tasks[0].completed).toBe(true);
  });

  it("deleteTask removes the task and its subtasks from state", async () => {
    const { ws, supabase } = await mount({
      tasks: [makeTask({ id: "p" }), makeTask({ id: "c", parent_task_id: "p" })],
    });
    await act(async () => {
      await ws().deleteTask("p");
    });
    expect(ws().allTasks.find((t) => t.id === "p")).toBeUndefined();
    expect(ws().allTasks.find((t) => t.id === "c")).toBeUndefined();
    expect(supabase._store.tasks.find((t) => t.id === "p")).toBeUndefined();
  });

  it("moveTask updates section and position", async () => {
    const { ws, supabase } = await mount({
      tasks: [makeTask({ id: "t1", section_id: null, position: 1000 })],
    });
    await act(async () => {
      await ws().moveTask("t1", "sec1", 500);
    });
    expect(ws().allTasks[0].section_id).toBe("sec1");
    expect(supabase._store.tasks[0].position).toBe(500);
  });
});

describe("section & project mutations", () => {
  it("createSection appends with an incremented position", async () => {
    const { ws, supabase } = await mount({
      sections: [makeSection({ id: "s1", position: 1000 })],
    });
    await act(async () => {
      await ws().createSection("Later");
    });
    expect(supabase._store.sections).toHaveLength(2);
    expect(ws().sections.some((s) => s.name === "Later")).toBe(true);
  });

  it("updateSection and deleteSection", async () => {
    const { ws, supabase } = await mount({
      sections: [makeSection({ id: "s1", name: "A" })],
      tasks: [makeTask({ id: "t1", section_id: "s1" })],
    });
    await act(async () => {
      await ws().updateSection("s1", { name: "B" });
    });
    expect(ws().sections[0].name).toBe("B");
    await act(async () => {
      await ws().deleteSection("s1");
    });
    expect(ws().sections).toHaveLength(0);
    // task detached from the deleted section in state
    expect(ws().allTasks[0].section_id).toBeNull();
    expect(supabase._store.sections).toHaveLength(0);
  });

  it("createProject / updateProject / deleteProject", async () => {
    const { ws, supabase } = await mount({ projects: [] });
    await act(async () => {
      await ws().createProject("Work", "#fff");
    });
    const id = supabase._store.projects[0].id as string;
    expect(ws().projects).toHaveLength(1);
    await act(async () => {
      await ws().updateProject(id, { name: "Work!" });
    });
    expect(ws().projects[0].name).toBe("Work!");
    await act(async () => {
      await ws().deleteProject(id);
    });
    expect(ws().projects).toHaveLength(0);
  });

  it("setTaskProjects replaces the links", async () => {
    const { ws, supabase } = await mount({
      tasks: [makeTask({ id: "t1" })],
      task_projects: [{ task_id: "t1", project_id: "old" }],
    });
    await act(async () => {
      await ws().setTaskProjects("t1", ["p1", "p2"]);
    });
    expect(ws().projectIdsOf("t1").sort()).toEqual(["p1", "p2"]);
    expect(supabase._store.task_projects).toHaveLength(2);
  });

  it("setTaskProjects with an empty list clears links", async () => {
    const { ws, supabase } = await mount({
      tasks: [makeTask({ id: "t1" })],
      task_projects: [{ task_id: "t1", project_id: "old" }],
    });
    await act(async () => {
      await ws().setTaskProjects("t1", []);
    });
    expect(ws().projectIdsOf("t1")).toEqual([]);
    expect(supabase._store.task_projects).toHaveLength(0);
  });
});

describe("members, collaborators & profile", () => {
  it("membersOf, addMember, updateMemberRole, removeMember", async () => {
    const { ws, supabase } = await mount({
      projects: [makeProject({ id: "pr1", owner_id: "user-1" })],
      project_members: [],
      profiles: [makeProfile({ id: "user-1" }), makeProfile({ id: "u2" })],
    });
    await act(async () => {
      await ws().addMember("pr1", "u2", "editor");
    });
    expect(ws().membersOf("pr1")).toHaveLength(1);
    await act(async () => {
      await ws().updateMemberRole("pr1", "u2", "viewer");
    });
    expect(ws().membersOf("pr1")[0].role).toBe("viewer");
    await act(async () => {
      await ws().removeMember("pr1", "u2");
    });
    expect(ws().membersOf("pr1")).toHaveLength(0);
    expect(supabase._store.project_members).toHaveLength(0);
  });

  it("removing yourself also drops the project locally", async () => {
    const { ws } = await mount({
      projects: [makeProject({ id: "pr1", owner_id: "owner" })],
      project_members: [makeMember({ project_id: "pr1", user_id: "user-1" })],
    });
    await act(async () => {
      await ws().removeMember("pr1", "user-1");
    });
    expect(ws().projects.find((p) => p.id === "pr1")).toBeUndefined();
  });

  it("addCollaboratorByEmail resolves a profile and links it", async () => {
    const { ws, supabase } = await mount({
      profiles: [
        makeProfile({ id: "user-1", email: "me@test.dev" }),
        makeProfile({ id: "u2", email: "friend@x.io", full_name: "Friend" }),
      ],
      collaborators: [],
    });
    let err: string | null = "x";
    await act(async () => {
      err = await ws().addCollaboratorByEmail("friend@x.io");
    });
    expect(err).toBeNull();
    expect(ws().collaborators.some((c) => c.id === "u2")).toBe(true);
    expect(supabase._store.collaborators).toHaveLength(1);
  });

  it("addCollaboratorByEmail rejects unknown, self, and duplicates", async () => {
    const { ws } = await mount({
      profiles: [
        makeProfile({ id: "user-1", email: "me@test.dev" }),
        makeProfile({ id: "u2", email: "friend@x.io" }),
      ],
      collaborators: [{ user_id: "user-1", collaborator_id: "u2" }],
    });
    expect(await actReturn(() => ws().addCollaboratorByEmail(""))).toMatch(/Enter an email/);
    expect(await actReturn(() => ws().addCollaboratorByEmail("nobody@x.io"))).toMatch(
      /No user/,
    );
    expect(await actReturn(() => ws().addCollaboratorByEmail("me@test.dev"))).toMatch(
      /That's you/,
    );
    expect(await actReturn(() => ws().addCollaboratorByEmail("friend@x.io"))).toMatch(
      /Already/,
    );
  });

  it("removeCollaborator unlinks", async () => {
    const { ws, supabase } = await mount({
      profiles: [makeProfile({ id: "user-1" }), makeProfile({ id: "u2" })],
      collaborators: [{ user_id: "user-1", collaborator_id: "u2" }],
    });
    await act(async () => {
      await ws().removeCollaborator("u2");
    });
    expect(ws().collaborators).toHaveLength(0);
    expect(supabase._store.collaborators).toHaveLength(0);
  });

  it("connectedProfiles = self + collaborators + project members", async () => {
    const { ws } = await mount({
      profiles: [
        makeProfile({ id: "user-1" }),
        makeProfile({ id: "collab" }),
        makeProfile({ id: "member" }),
        makeProfile({ id: "stranger" }),
      ],
      collaborators: [{ user_id: "user-1", collaborator_id: "collab" }],
      projects: [makeProject({ id: "pr1", owner_id: "user-1" })],
      project_members: [makeMember({ project_id: "pr1", user_id: "member" })],
    });
    const ids = ws().connectedProfiles.map((p) => p.id).sort();
    expect(ids).toContain("user-1");
    expect(ids).toContain("collab");
    expect(ids).toContain("member");
    expect(ids).not.toContain("stranger");
  });

  it("updateMyProfile persists pomodoro settings", async () => {
    const { ws, supabase } = await mount({
      profiles: [makeProfile({ id: "user-1", pomodoro_work_minutes: 25 })],
    });
    await act(async () => {
      await ws().updateMyProfile({ pomodoro_work_minutes: 50 });
    });
    expect(ws().me?.pomodoro_work_minutes).toBe(50);
    expect(supabase._store.profiles[0].pomodoro_work_minutes).toBe(50);
  });
});

describe("notifications", () => {
  it("unreadCount, markNotificationRead, markAllNotificationsRead", async () => {
    const { ws, supabase } = await mount({
      notifications: [
        { id: "n1", user_id: "user-1", read_at: null, created_at: "2026-01-01", type: "assigned", title: "a", body: null, task_id: null, emailed_at: null },
        { id: "n2", user_id: "user-1", read_at: null, created_at: "2026-01-02", type: "comment", title: "b", body: null, task_id: null, emailed_at: null },
      ],
    });
    expect(ws().unreadCount).toBe(2);
    await act(async () => {
      await ws().markNotificationRead("n1");
    });
    expect(ws().unreadCount).toBe(1);
    await act(async () => {
      await ws().markAllNotificationsRead();
    });
    expect(ws().unreadCount).toBe(0);
    expect(supabase._store.notifications.every((n) => n.read_at)).toBe(true);
  });

  it("reloadNotifications refreshes from the store", async () => {
    const { ws } = await mount({ notifications: [] });
    await act(async () => {
      await ws().reloadNotifications();
    });
    expect(ws().notifications).toEqual([]);
  });
});

// helper: run an async workspace call inside act and return its resolved value
async function actReturn<T>(fn: () => Promise<T>): Promise<T> {
  let out!: T;
  await act(async () => {
    out = await fn();
  });
  return out;
}
