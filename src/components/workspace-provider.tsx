"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  Project,
  Section,
  Task,
  TaskRow,
  Priority,
  ProjectMember,
  Notification,
  MemberRole,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { PLAN_LIMITS, type Plan, type PlanLimits } from "@/lib/plans";

type TaskProjectLink = { task_id: string; project_id: string };
type CommentLite = { id: string; task_id: string };
type Collaborator = { user_id: string; collaborator_id: string };

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

type Ctx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  me: Profile | null;
  loading: boolean;
  profiles: Profile[];
  /** Profiles you're connected to: yourself, your collaborators, and people
   *  you share a project with. Pickers should use this, not `profiles`. */
  connectedProfiles: Profile[];
  sections: Section[];
  projects: Project[];
  /** Top-level tasks (no parent), enriched. */
  tasks: Task[];
  /** All raw task rows including subtasks. */
  allTasks: TaskRow[];
  subtasksOf: (taskId: string) => TaskRow[];
  projectIdsOf: (taskId: string) => string[];
  refresh: () => Promise<void>;

  createTask: (input: Partial<TaskRow> & { name: string }) => Promise<TaskRow | null>;
  updateTask: (id: string, patch: Partial<TaskRow>) => Promise<void>;
  toggleComplete: (id: string, completed: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (
    id: string,
    sectionId: string | null,
    position: number,
  ) => Promise<void>;

  createSection: (name: string) => Promise<void>;
  updateSection: (id: string, patch: Partial<Section>) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;

  createProject: (name: string, color: string) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  setTaskProjects: (taskId: string, projectIds: string[]) => Promise<void>;

  // Project sharing
  membersOf: (projectId: string) => ProjectMember[];

  // Collaborators (settings)
  collaborators: Profile[];
  /** Add a collaborator by exact email. Returns an error message or null on success. */
  addCollaboratorByEmail: (email: string) => Promise<string | null>;
  removeCollaborator: (collaboratorId: string) => Promise<void>;

  /** Update the signed-in user's profile (e.g. pomodoro settings). */
  updateMyProfile: (patch: Partial<Profile>) => Promise<string | null>;
  addMember: (projectId: string, userId: string, role: MemberRole) => Promise<void>;
  updateMemberRole: (
    projectId: string,
    userId: string,
    role: MemberRole,
  ) => Promise<void>;
  removeMember: (projectId: string, userId: string) => Promise<void>;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  reloadNotifications: () => Promise<void>;

  // Billing
  plan: Plan;
  limits: PlanLimits;

  // Transient error surface for failed mutations (#24).
  toast: string | null;
  dismissToast: () => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<TaskRow[]>([]);
  const [links, setLinks] = useState<TaskProjectLink[]>([]);
  const [comments, setComments] = useState<CommentLite[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [collabLinks, setCollabLinks] = useState<Collaborator[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [plan, setPlan] = useState<Plan>("free");
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const refresh = useCallback(async () => {
    const [p, s, pr, t, tp, c, m, n, sub, col] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("sections").select("*").order("position"),
      supabase
        .from("projects")
        .select("*")
        .eq("archived", false)
        .order("created_at"),
      supabase.from("tasks").select("*").order("position"),
      supabase.from("task_projects").select("task_id, project_id"),
      supabase.from("comments").select("id, task_id"),
      supabase.from("project_members").select("*"),
      supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("collaborators").select("user_id, collaborator_id"),
    ]);
    setProfiles(p.data ?? []);
    setSections(s.data ?? []);
    setProjects(pr.data ?? []);
    setAllTasks(t.data ?? []);
    setLinks(tp.data ?? []);
    setComments(c.data ?? []);
    setMembers(m.data ?? []);
    setCollabLinks(col.data ?? []);
    setNotifications(n.data ?? []);
    setPlan(
      sub.data && ACTIVE_STATUSES.has(sub.data.status)
        ? ((sub.data.plan as Plan) ?? "free")
        : "free",
    );
    setLoading(false);
  }, [supabase, userId]);

  // Surface a failed mutation and reconcile optimistic state by re-syncing from
  // the server (rolls back the optimistic change). Returns true if it errored.
  const reportError = useCallback(
    (error: { message?: string } | null): boolean => {
      if (!error) return false;
      setToast(error.message || "Something went wrong — your change was reverted.");
      refresh();
      return true;
    },
    [refresh],
  );

  const reloadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data ?? []);
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: apply row-level changes incrementally instead of refetching the
  // whole workspace on every event (#27). This avoids O(workspace) refetch
  // storms and stops clobbering in-flight optimistic state for unrelated rows.
  // Rarer tables (members/comments) fall back to a debounced refresh.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh(), 400);
    };

    type Payload = {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    };
    const upsertBy = <T extends { id: string }>(
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      row: T,
    ) => setter((prev) => {
      const i = prev.findIndex((x) => x.id === row.id);
      if (i === -1) return [...prev, row];
      const next = [...prev];
      next[i] = { ...next[i], ...row };
      return next;
    });
    const removeBy = <T extends { id: string }>(
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      id: string,
    ) => setter((prev) => prev.filter((x) => x.id !== id));

    const channel = supabase.channel("workspace-changes");

    channel.on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (p) => {
      const { eventType, new: n, old } = p as unknown as Payload;
      if (eventType === "DELETE") removeBy(setAllTasks, old.id as string);
      else upsertBy(setAllTasks, n as unknown as TaskRow);
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "sections" }, (p) => {
      const { eventType, new: n, old } = p as unknown as Payload;
      if (eventType === "DELETE") removeBy(setSections, old.id as string);
      else upsertBy(setSections, n as unknown as Section);
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "projects" }, (p) => {
      const { eventType, new: n, old } = p as unknown as Payload;
      if (eventType === "DELETE") removeBy(setProjects, old.id as string);
      else upsertBy(setProjects, n as unknown as Project);
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "task_projects" }, (p) => {
      const { eventType, new: n, old } = p as unknown as Payload;
      setLinks((prev) => {
        if (eventType === "DELETE") {
          return prev.filter(
            (l) => !(l.task_id === old.task_id && l.project_id === old.project_id),
          );
        }
        const link = { task_id: n.task_id as string, project_id: n.project_id as string };
        if (prev.some((l) => l.task_id === link.task_id && l.project_id === link.project_id))
          return prev;
        return [...prev, link];
      });
    });
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications" },
      () => reloadNotifications(),
    );
    // Comments (counts) and project_members change rarely; a debounced refresh
    // keeps them correct without per-row bookkeeping.
    for (const table of ["comments", "project_members"] as const) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    }

    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, refresh, reloadNotifications]);

  const me = useMemo(
    () => profiles.find((p) => p.id === userId) ?? null,
    [profiles, userId],
  );

  // People you explicitly added as collaborators.
  const collaborators = useMemo<Profile[]>(() => {
    const ids = new Set(
      collabLinks.filter((l) => l.user_id === userId).map((l) => l.collaborator_id),
    );
    return profiles.filter((p) => ids.has(p.id));
  }, [collabLinks, profiles, userId]);

  // Yourself + collaborators (either direction) + anyone sharing a project
  // with you. Pickers (assignee, mentions, share) use this instead of the
  // full platform-wide profile list.
  const connectedProfiles = useMemo<Profile[]>(() => {
    const ids = new Set<string>([userId]);
    for (const l of collabLinks) {
      if (l.user_id === userId) ids.add(l.collaborator_id);
      if (l.collaborator_id === userId) ids.add(l.user_id);
    }
    for (const m of members) ids.add(m.user_id);
    for (const p of projects) ids.add(p.owner_id);
    return profiles.filter((p) => ids.has(p.id));
  }, [collabLinks, members, projects, profiles, userId]);

  const linksByTask = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) {
      const arr = m.get(l.task_id) ?? [];
      arr.push(l.project_id);
      m.set(l.task_id, arr);
    }
    return m;
  }, [links]);

  const commentsByTask = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) m.set(c.task_id, (m.get(c.task_id) ?? 0) + 1);
    return m;
  }, [comments]);

  const subtasksByParent = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of allTasks) {
      if (t.parent_task_id) {
        const arr = m.get(t.parent_task_id) ?? [];
        arr.push(t);
        m.set(t.parent_task_id, arr);
      }
    }
    return m;
  }, [allTasks]);

  const tasks = useMemo<Task[]>(() => {
    return allTasks
      .filter((t) => !t.parent_task_id)
      .map((t) => {
        const subs = subtasksByParent.get(t.id) ?? [];
        return {
          ...t,
          project_ids: linksByTask.get(t.id) ?? [],
          subtask_count: subs.length,
          subtask_done: subs.filter((x) => x.completed).length,
          comment_count: commentsByTask.get(t.id) ?? 0,
        };
      });
  }, [allTasks, subtasksByParent, linksByTask, commentsByTask]);

  const subtasksOf = useCallback(
    (taskId: string) => subtasksByParent.get(taskId) ?? [],
    [subtasksByParent],
  );
  const projectIdsOf = useCallback(
    (taskId: string) => linksByTask.get(taskId) ?? [],
    [linksByTask],
  );

  // ---------- Mutations ----------
  const createTask = useCallback<Ctx["createTask"]>(
    async (input) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, creator_id: userId })
        .select("*")
        .single();
      if (reportError(error) || !data) return null;
      setAllTasks((prev) => [...prev, data]);
      return data;
    },
    [supabase, userId, reportError],
  );

  const updateTask = useCallback<Ctx["updateTask"]>(
    async (id, patch) => {
      setAllTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const toggleComplete = useCallback<Ctx["toggleComplete"]>(
    async (id, completed) => {
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, completed, completed_at: completed ? new Date().toISOString() : null }
            : t,
        ),
      );
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const deleteTask = useCallback<Ctx["deleteTask"]>(
    async (id) => {
      setAllTasks((prev) =>
        prev.filter((t) => t.id !== id && t.parent_task_id !== id),
      );
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const moveTask = useCallback<Ctx["moveTask"]>(
    async (id, sectionId, position) => {
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, section_id: sectionId, position } : t,
        ),
      );
      const { error } = await supabase
        .from("tasks")
        .update({ section_id: sectionId, position })
        .eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const createSection = useCallback<Ctx["createSection"]>(
    async (name) => {
      const maxPos = sections.reduce((m, s) => Math.max(m, s.position), 0);
      const { data, error } = await supabase
        .from("sections")
        .insert({ name, owner_id: userId, position: maxPos + 1000 })
        .select("*")
        .single();
      if (reportError(error)) return;
      if (data) setSections((prev) => [...prev, data]);
    },
    [supabase, userId, sections, reportError],
  );

  const updateSection = useCallback<Ctx["updateSection"]>(
    async (id, patch) => {
      setSections((prev) =>
        prev
          .map((s) => (s.id === id ? { ...s, ...patch } : s))
          .sort((a, b) => a.position - b.position),
      );
      const { error } = await supabase.from("sections").update(patch).eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const deleteSection = useCallback<Ctx["deleteSection"]>(
    async (id) => {
      setSections((prev) => prev.filter((s) => s.id !== id));
      setAllTasks((prev) =>
        prev.map((t) => (t.section_id === id ? { ...t, section_id: null } : t)),
      );
      const { error } = await supabase.from("sections").delete().eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const createProject = useCallback<Ctx["createProject"]>(
    async (name, color) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ name, color, owner_id: userId })
        .select("*")
        .single();
      if (reportError(error)) return;
      if (data) setProjects((prev) => [...prev, data]);
    },
    [supabase, userId, reportError],
  );

  const updateProject = useCallback<Ctx["updateProject"]>(
    async (id, patch) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const deleteProject = useCallback<Ctx["deleteProject"]>(
    async (id) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setLinks((prev) => prev.filter((l) => l.project_id !== id));
      const { error } = await supabase.from("projects").delete().eq("id", id);
      reportError(error);
    },
    [supabase, reportError],
  );

  const setTaskProjects = useCallback<Ctx["setTaskProjects"]>(
    async (taskId, projectIds) => {
      setLinks((prev) => [
        ...prev.filter((l) => l.task_id !== taskId),
        ...projectIds.map((project_id) => ({ task_id: taskId, project_id })),
      ]);
      // Atomic replace via an RPC so a mid-flight failure can't drop all links
      // (#30). The function enforces edit rights + project membership.
      const { error } = await supabase.rpc("set_task_projects", {
        p_task_id: taskId,
        p_project_ids: projectIds,
      });
      reportError(error);
    },
    [supabase, reportError],
  );

  // ---------- Project sharing ----------
  const membersOf = useCallback<Ctx["membersOf"]>(
    (projectId) => members.filter((m) => m.project_id === projectId),
    [members],
  );

  const addMember = useCallback<Ctx["addMember"]>(
    async (projectId, memberUserId, role) => {
      const { data } = await supabase
        .from("project_members")
        .insert({ project_id: projectId, user_id: memberUserId, role })
        .select("*")
        .single();
      if (data) setMembers((prev) => [...prev, data]);
    },
    [supabase],
  );

  const updateMemberRole = useCallback<Ctx["updateMemberRole"]>(
    async (projectId, memberUserId, role) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.project_id === projectId && m.user_id === memberUserId
            ? { ...m, role }
            : m,
        ),
      );
      await supabase
        .from("project_members")
        .update({ role })
        .eq("project_id", projectId)
        .eq("user_id", memberUserId);
    },
    [supabase],
  );

  const removeMember = useCallback<Ctx["removeMember"]>(
    async (projectId, memberUserId) => {
      setMembers((prev) =>
        prev.filter(
          (m) => !(m.project_id === projectId && m.user_id === memberUserId),
        ),
      );
      // If the user removed themselves, the project also disappears for them.
      if (memberUserId === userId) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
      await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", memberUserId);
    },
    [supabase, userId],
  );

  // ---------- Collaborators & profile ----------
  const addCollaboratorByEmail = useCallback<Ctx["addCollaboratorByEmail"]>(
    async (email) => {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return "Enter an email address.";
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalized)
        .maybeSingle();
      if (!profile) return "No user with that email. They need a TaskFlow account first.";
      if (profile.id === userId) return "That's you.";
      if (
        collabLinks.some(
          (l) => l.user_id === userId && l.collaborator_id === profile.id,
        )
      )
        return "Already a collaborator.";
      const { error } = await supabase
        .from("collaborators")
        .insert({ user_id: userId, collaborator_id: profile.id });
      if (error) return error.message;
      setCollabLinks((prev) => [
        ...prev,
        { user_id: userId, collaborator_id: profile.id },
      ]);
      return null;
    },
    [supabase, userId, collabLinks],
  );

  const removeCollaborator = useCallback<Ctx["removeCollaborator"]>(
    async (collaboratorId) => {
      setCollabLinks((prev) =>
        prev.filter(
          (l) => !(l.user_id === userId && l.collaborator_id === collaboratorId),
        ),
      );
      await supabase
        .from("collaborators")
        .delete()
        .eq("user_id", userId)
        .eq("collaborator_id", collaboratorId);
    },
    [supabase, userId],
  );

  const updateMyProfile = useCallback<Ctx["updateMyProfile"]>(
    async (patch) => {
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId);
      if (error) return error.message;
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, ...patch } : p)),
      );
      return null;
    },
    [supabase, userId],
  );

  // ---------- Notifications ----------
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const markNotificationRead = useCallback<Ctx["markNotificationRead"]>(
    async (id) => {
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)),
      );
      await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", id);
    },
    [supabase],
  );

  const markAllNotificationsRead = useCallback<Ctx["markAllNotificationsRead"]>(
    async () => {
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      );
      await supabase
        .from("notifications")
        .update({ read_at: now })
        .is("read_at", null);
    },
    [supabase],
  );

  const value: Ctx = {
    supabase,
    userId,
    me,
    loading,
    profiles,
    connectedProfiles,
    sections,
    projects,
    tasks,
    allTasks,
    subtasksOf,
    projectIdsOf,
    refresh,
    createTask,
    updateTask,
    toggleComplete,
    deleteTask,
    moveTask,
    createSection,
    updateSection,
    deleteSection,
    createProject,
    updateProject,
    deleteProject,
    setTaskProjects,
    membersOf,
    addMember,
    updateMemberRole,
    removeMember,
    collaborators,
    addCollaboratorByEmail,
    removeCollaborator,
    updateMyProfile,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    reloadNotifications,
    plan,
    limits: PLAN_LIMITS[plan],
    toast,
    dismissToast,
  };

  return (
    <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
  );
}

export type { Priority };
