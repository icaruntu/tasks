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

  // Realtime: re-sync when any relevant table changes (debounced).
  useEffect(() => {
    const tables = [
      "tasks",
      "task_projects",
      "sections",
      "projects",
      "project_members",
      "comments",
      "notifications",
    ] as const;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh(), 400);
    };
    const channel = supabase.channel("workspace-changes");
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        schedule,
      );
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

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
      if (error || !data) return null;
      setAllTasks((prev) => [...prev, data]);
      return data;
    },
    [supabase, userId],
  );

  const updateTask = useCallback<Ctx["updateTask"]>(
    async (id, patch) => {
      setAllTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      await supabase.from("tasks").update(patch).eq("id", id);
    },
    [supabase],
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
      await supabase.from("tasks").update({ completed }).eq("id", id);
    },
    [supabase],
  );

  const deleteTask = useCallback<Ctx["deleteTask"]>(
    async (id) => {
      setAllTasks((prev) =>
        prev.filter((t) => t.id !== id && t.parent_task_id !== id),
      );
      await supabase.from("tasks").delete().eq("id", id);
    },
    [supabase],
  );

  const moveTask = useCallback<Ctx["moveTask"]>(
    async (id, sectionId, position) => {
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, section_id: sectionId, position } : t,
        ),
      );
      await supabase
        .from("tasks")
        .update({ section_id: sectionId, position })
        .eq("id", id);
    },
    [supabase],
  );

  const createSection = useCallback<Ctx["createSection"]>(
    async (name) => {
      const maxPos = sections.reduce((m, s) => Math.max(m, s.position), 0);
      const { data } = await supabase
        .from("sections")
        .insert({ name, owner_id: userId, position: maxPos + 1000 })
        .select("*")
        .single();
      if (data) setSections((prev) => [...prev, data]);
    },
    [supabase, userId, sections],
  );

  const updateSection = useCallback<Ctx["updateSection"]>(
    async (id, patch) => {
      setSections((prev) =>
        prev
          .map((s) => (s.id === id ? { ...s, ...patch } : s))
          .sort((a, b) => a.position - b.position),
      );
      await supabase.from("sections").update(patch).eq("id", id);
    },
    [supabase],
  );

  const deleteSection = useCallback<Ctx["deleteSection"]>(
    async (id) => {
      setSections((prev) => prev.filter((s) => s.id !== id));
      setAllTasks((prev) =>
        prev.map((t) => (t.section_id === id ? { ...t, section_id: null } : t)),
      );
      await supabase.from("sections").delete().eq("id", id);
    },
    [supabase],
  );

  const createProject = useCallback<Ctx["createProject"]>(
    async (name, color) => {
      const { data } = await supabase
        .from("projects")
        .insert({ name, color, owner_id: userId })
        .select("*")
        .single();
      if (data) setProjects((prev) => [...prev, data]);
    },
    [supabase, userId],
  );

  const updateProject = useCallback<Ctx["updateProject"]>(
    async (id, patch) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      await supabase.from("projects").update(patch).eq("id", id);
    },
    [supabase],
  );

  const deleteProject = useCallback<Ctx["deleteProject"]>(
    async (id) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setLinks((prev) => prev.filter((l) => l.project_id !== id));
      await supabase.from("projects").delete().eq("id", id);
    },
    [supabase],
  );

  const setTaskProjects = useCallback<Ctx["setTaskProjects"]>(
    async (taskId, projectIds) => {
      setLinks((prev) => [
        ...prev.filter((l) => l.task_id !== taskId),
        ...projectIds.map((project_id) => ({ task_id: taskId, project_id })),
      ]);
      await supabase.from("task_projects").delete().eq("task_id", taskId);
      if (projectIds.length) {
        await supabase
          .from("task_projects")
          .insert(projectIds.map((project_id) => ({ task_id: taskId, project_id })));
      }
    },
    [supabase],
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
  };

  return (
    <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
  );
}

export type { Priority };
