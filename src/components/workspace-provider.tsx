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
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type TaskProjectLink = { task_id: string; project_id: string };
type CommentLite = { id: string; task_id: string };

type Ctx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  me: Profile | null;
  loading: boolean;
  profiles: Profile[];
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

  const refresh = useCallback(async () => {
    const [p, s, pr, t, tp, c] = await Promise.all([
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
    ]);
    setProfiles(p.data ?? []);
    setSections(s.data ?? []);
    setProjects(pr.data ?? []);
    setAllTasks(t.data ?? []);
    setLinks(tp.data ?? []);
    setComments(c.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const me = useMemo(
    () => profiles.find((p) => p.id === userId) ?? null,
    [profiles, userId],
  );

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

  const value: Ctx = {
    supabase,
    userId,
    me,
    loading,
    profiles,
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
  };

  return (
    <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
  );
}

export type { Priority };
