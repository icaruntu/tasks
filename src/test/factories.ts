import type {
  Profile,
  Project,
  Section,
  TaskRow,
  Notification,
  ProjectMember,
} from "@/lib/types";

let n = 0;
const id = (p: string) => `${p}-${++n}`;

export function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: over.id ?? id("user"),
    email: "person@test.dev",
    full_name: "Test Person",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    pomodoro_work_minutes: 25,
    pomodoro_short_break_minutes: 5,
    pomodoro_long_break_minutes: 15,
    ...over,
  };
}

export function makeTask(over: Partial<TaskRow> = {}): TaskRow {
  return {
    id: over.id ?? id("task"),
    creator_id: "user-1",
    assignee_id: null,
    section_id: null,
    parent_task_id: null,
    name: "A task",
    description: null,
    priority: null,
    due_date: null,
    completed: false,
    completed_at: null,
    position: 1000,
    recurrence: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: over.id ?? id("project"),
    owner_id: "user-1",
    name: "A project",
    color: "#6366f1",
    archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeSection(over: Partial<Section> = {}): Section {
  return {
    id: over.id ?? id("section"),
    owner_id: "user-1",
    name: "A section",
    position: 1000,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeMember(over: Partial<ProjectMember> = {}): ProjectMember {
  return {
    project_id: over.project_id ?? id("project"),
    user_id: over.user_id ?? id("user"),
    role: "editor",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeNotification(over: Partial<Notification> = {}): Notification {
  return {
    id: over.id ?? id("notif"),
    user_id: "user-1",
    task_id: null,
    type: "assigned",
    title: "Something happened",
    body: null,
    read_at: null,
    emailed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}
