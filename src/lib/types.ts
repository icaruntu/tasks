import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type Project = Tables<"projects">;
export type Section = Tables<"sections">;
export type TaskRow = Tables<"tasks">;
export type Comment = Tables<"comments">;
export type Attachment = Tables<"attachments">;
export type ProjectMember = Tables<"project_members">;
export type Notification = Tables<"notifications">;

export type MemberRole = "owner" | "editor" | "viewer";

export type Priority = "high" | "medium" | "low";

export type Task = TaskRow & {
  project_ids: string[];
  subtask_count: number;
  subtask_done: number;
  comment_count: number;
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; dot: string; order: number }
> = {
  high: { label: "High", color: "text-rose-600", dot: "bg-rose-500", order: 0 },
  medium: {
    label: "Medium",
    color: "text-amber-600",
    dot: "bg-amber-500",
    order: 1,
  },
  low: { label: "Low", color: "text-sky-600", dot: "bg-sky-500", order: 2 },
};

export type DueFilter =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_week"
  | "within_14"
  | null;

export const DUE_FILTER_LABELS: Record<NonNullable<DueFilter>, string> = {
  overdue: "Due before today",
  today: "Due today",
  tomorrow: "Due tomorrow",
  this_week: "Due this week",
  next_week: "Due next week",
  within_14: "Due within 14 days",
};

export type CompletionFilter = "incomplete" | "complete" | "all";

export type ViewFilters = {
  completion: CompletionFilter;
  due: DueFilter;
  priorities: Priority[];
  projectId: string | null;
  search: string;
};

export const DEFAULT_FILTERS: ViewFilters = {
  completion: "incomplete",
  due: null,
  priorities: [],
  projectId: null,
  search: "",
};
