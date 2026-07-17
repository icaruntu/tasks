export type Priority = "high" | "medium" | "low";
export type MemberRole = "editor" | "viewer";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  pomodoro_work_minutes: number;
  pomodoro_short_break_minutes: number;
  pomodoro_long_break_minutes: number;
};

export type TaskRow = {
  id: string;
  creator_id: string;
  assignee_id: string | null;
  section_id: string | null;
  parent_task_id: string | null;
  name: string;
  description: string | null;
  priority: Priority | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  position: number;
  recurrence: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = TaskRow & {
  project_ids: string[];
  subtask_count: number;
  subtask_done: number;
  comment_count: number;
};

export type Section = {
  id: string;
  owner_id: string;
  name: string;
  position: number;
};

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  archived: boolean;
};

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: MemberRole | "owner";
};

export type Comment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  task_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string }
> = {
  high: { label: "High", color: "#f43f5e" },
  medium: { label: "Medium", color: "#f59e0b" },
  low: { label: "Low", color: "#0ea5e9" },
};

export const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Every weekday" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
