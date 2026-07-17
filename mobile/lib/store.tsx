import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./supabase";
import type {
  Comment,
  Notification,
  Profile,
  Project,
  ProjectMember,
  Section,
  Task,
  TaskRow,
} from "./types";

type Ctx = {
  userId: string;
  me: Profile | null;
  loading: boolean;
  profiles: Profile[];
  connectedProfiles: Profile[];
  collaborators: Profile[];
  sections: Section[];
  projects: Project[];
  tasks: Task[];
  allTasks: TaskRow[];
  notifications: Notification[];
  unreadCount: number;
  members: ProjectMember[];

  refresh: () => Promise<void>;
  subtasksOf: (taskId: string) => TaskRow[];
  projectIdsOf: (taskId: string) => string[];

  createTask: (input: Partial<TaskRow> & { name: string }) => Promise<TaskRow | null>;
  updateTask: (id: string, patch: Partial<TaskRow>) => Promise<void>;
  toggleComplete: (id: string, completed: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  createSection: (name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;

  createProject: (name: string, color: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setTaskProjects: (taskId: string, projectIds: string[]) => Promise<void>;

  addCollaboratorByEmail: (email: string) => Promise<string | null>;
  removeCollaborator: (collaboratorId: string) => Promise<void>;
  updateMyProfile: (patch: Partial<Profile>) => Promise<string | null>;

  commentsOf: (taskId: string) => Promise<Comment[]>;
  addComment: (taskId: string, body: string) => Promise<void>;

  markAllNotificationsRead: () => Promise<void>;
  signOut: () => Promise<void>;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return c;
}

type CollabLink = { user_id: string; collaborator_id: string };

export function WorkspaceProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<TaskRow[]>([]);
  const [links, setLinks] = useState<{ task_id: string; project_id: string }[]>([]);
  const [comments, setComments] = useState<{ id: string; task_id: string }[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [collabLinks, setCollabLinks] = useState<CollabLink[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    const [p, s, pr, t, tp, c, m, n, col] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("sections").select("*").order("position"),
      supabase.from("projects").select("*").eq("archived", false).order("created_at"),
      supabase.from("tasks").select("*").order("position"),
      supabase.from("task_projects").select("task_id, project_id"),
      supabase.from("comments").select("id, task_id"),
      supabase.from("project_members").select("*"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("collaborators").select("user_id, collaborator_id"),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setSections((s.data as Section[]) ?? []);
    setProjects((pr.data as Project[]) ?? []);
    setAllTasks((t.data as TaskRow[]) ?? []);
    setLinks((tp.data as { task_id: string; project_id: string }[]) ?? []);
    setComments((c.data as { id: string; task_id: string }[]) ?? []);
    setMembers((m.data as ProjectMember[]) ?? []);
    setNotifications((n.data as Notification[]) ?? []);
    setCollabLinks((col.data as CollabLink[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh(), 400);
    };
    const channel = supabase.channel("mobile-workspace");
    for (const table of ["tasks", "task_projects", "sections", "projects", "project_members", "comments", "notifications"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const me = useMemo(() => profiles.find((p) => p.id === userId) ?? null, [profiles, userId]);

  const linksByTask = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of links) {
      const arr = map.get(l.task_id) ?? [];
      arr.push(l.project_id);
      map.set(l.task_id, arr);
    }
    return map;
  }, [links]);

  const commentsByTask = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments) map.set(c.task_id, (map.get(c.task_id) ?? 0) + 1);
    return map;
  }, [comments]);

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const t of allTasks) {
      if (t.parent_task_id) {
        const arr = map.get(t.parent_task_id) ?? [];
        arr.push(t);
        map.set(t.parent_task_id, arr);
      }
    }
    return map;
  }, [allTasks]);

  const tasks = useMemo<Task[]>(
    () =>
      allTasks
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
        }),
    [allTasks, subtasksByParent, linksByTask, commentsByTask],
  );

  const collaborators = useMemo<Profile[]>(() => {
    const ids = new Set(collabLinks.filter((l) => l.user_id === userId).map((l) => l.collaborator_id));
    return profiles.filter((p) => ids.has(p.id));
  }, [collabLinks, profiles, userId]);

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

  const subtasksOf = useCallback((taskId: string) => subtasksByParent.get(taskId) ?? [], [subtasksByParent]);
  const projectIdsOf = useCallback((taskId: string) => linksByTask.get(taskId) ?? [], [linksByTask]);

  const createTask = useCallback<Ctx["createTask"]>(
    async (input) => {
      const { data } = await supabase
        .from("tasks")
        .insert({ ...input, creator_id: userId })
        .select("*")
        .single();
      if (data) setAllTasks((prev) => [...prev, data as TaskRow]);
      return (data as TaskRow) ?? null;
    },
    [userId],
  );

  const updateTask = useCallback<Ctx["updateTask"]>(async (id, patch) => {
    setAllTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.from("tasks").update(patch).eq("id", id);
  }, []);

  const toggleComplete = useCallback<Ctx["toggleComplete"]>(async (id, completed) => {
    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed, completed_at: completed ? new Date().toISOString() : null } : t,
      ),
    );
    await supabase.from("tasks").update({ completed }).eq("id", id);
  }, []);

  const deleteTask = useCallback<Ctx["deleteTask"]>(async (id) => {
    setAllTasks((prev) => prev.filter((t) => t.id !== id && t.parent_task_id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }, []);

  const createSection = useCallback<Ctx["createSection"]>(
    async (name) => {
      const maxPos = sections.reduce((m, s) => Math.max(m, s.position), 0);
      const { data } = await supabase
        .from("sections")
        .insert({ name, owner_id: userId, position: maxPos + 1000 })
        .select("*")
        .single();
      if (data) setSections((prev) => [...prev, data as Section]);
    },
    [sections, userId],
  );

  const deleteSection = useCallback<Ctx["deleteSection"]>(async (id) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setAllTasks((prev) => prev.map((t) => (t.section_id === id ? { ...t, section_id: null } : t)));
    await supabase.from("sections").delete().eq("id", id);
  }, []);

  const createProject = useCallback<Ctx["createProject"]>(
    async (name, color) => {
      const { data } = await supabase
        .from("projects")
        .insert({ name, color, owner_id: userId })
        .select("*")
        .single();
      if (data) setProjects((prev) => [...prev, data as Project]);
    },
    [userId],
  );

  const deleteProject = useCallback<Ctx["deleteProject"]>(async (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setLinks((prev) => prev.filter((l) => l.project_id !== id));
    await supabase.from("projects").delete().eq("id", id);
  }, []);

  const setTaskProjects = useCallback<Ctx["setTaskProjects"]>(async (taskId, projectIds) => {
    setLinks((prev) => [
      ...prev.filter((l) => l.task_id !== taskId),
      ...projectIds.map((project_id) => ({ task_id: taskId, project_id })),
    ]);
    await supabase.from("task_projects").delete().eq("task_id", taskId);
    if (projectIds.length) {
      await supabase.from("task_projects").insert(projectIds.map((project_id) => ({ task_id: taskId, project_id })));
    }
  }, []);

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
      if (collabLinks.some((l) => l.user_id === userId && l.collaborator_id === profile.id))
        return "Already a collaborator.";
      const { error } = await supabase
        .from("collaborators")
        .insert({ user_id: userId, collaborator_id: profile.id });
      if (error) return error.message;
      setCollabLinks((prev) => [...prev, { user_id: userId, collaborator_id: profile.id }]);
      return null;
    },
    [collabLinks, userId],
  );

  const removeCollaborator = useCallback<Ctx["removeCollaborator"]>(
    async (collaboratorId) => {
      setCollabLinks((prev) =>
        prev.filter((l) => !(l.user_id === userId && l.collaborator_id === collaboratorId)),
      );
      await supabase.from("collaborators").delete().eq("user_id", userId).eq("collaborator_id", collaboratorId);
    },
    [userId],
  );

  const updateMyProfile = useCallback<Ctx["updateMyProfile"]>(
    async (patch) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) return error.message;
      setProfiles((prev) => prev.map((p) => (p.id === userId ? { ...p, ...patch } : p)));
      return null;
    },
    [userId],
  );

  const commentsOf = useCallback<Ctx["commentsOf"]>(async (taskId) => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at");
    return (data as Comment[]) ?? [];
  }, []);

  const addComment = useCallback<Ctx["addComment"]>(
    async (taskId, body) => {
      await supabase.from("comments").insert({ task_id: taskId, author_id: userId, body });
      setComments((prev) => [...prev, { id: Math.random().toString(), task_id: taskId }]);
    },
    [userId],
  );

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

  const markAllNotificationsRead = useCallback<Ctx["markAllNotificationsRead"]>(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: Ctx = {
    userId,
    me,
    loading,
    profiles,
    connectedProfiles,
    collaborators,
    sections,
    projects,
    tasks,
    allTasks,
    notifications,
    unreadCount,
    members,
    refresh,
    subtasksOf,
    projectIdsOf,
    createTask,
    updateTask,
    toggleComplete,
    deleteTask,
    createSection,
    deleteSection,
    createProject,
    deleteProject,
    setTaskProjects,
    addCollaboratorByEmail,
    removeCollaborator,
    updateMyProfile,
    commentsOf,
    addComment,
    markAllNotificationsRead,
    signOut,
  };

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}
