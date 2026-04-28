export type HealthPayload = {
  service: string;
  status: "ok" | "degraded" | string;
  version: string;
  checks: Record<string, { status: string; latency?: string; error?: string }>;
};

export type HealthState =
  | { kind: "loading" }
  | { kind: "online"; payload: HealthPayload }
  | { kind: "offline"; message: string };

export type AuthProvider = {
  id: string;
  name: string;
  kind: "oauth" | "email" | string;
};

export type AuthUser = {
  email: string;
  provider: string;
};

export type AuthState =
  | { kind: "loading"; providers: AuthProvider[] }
  | { kind: "unauthenticated"; providers: AuthProvider[]; message?: string; emailSent?: boolean }
  | { kind: "authenticated"; providers: AuthProvider[]; user: AuthUser };

export type ProductModule = {
  name: string;
  path: string;
  accent: string;
  summary: string;
  state?: string;
};

export type AppPath = "/" | "/todo";

export type TodoTaskStatus = "todo" | "in_progress" | "done";
export type TodoView = "inbox" | "today" | "overdue" | "upcoming" | "scheduled" | "flagged" | "all" | "completed";
export type TodoServerView = Exclude<TodoView, "all" | "completed">;
export type TodoTaskPriority = "none" | "low" | "medium" | "high";
export type TodoRepeatFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type TodoSort = "smart" | "due" | "created" | "title" | "priority";
export type TodoSortDirection = "asc" | "desc";

export type TodoProject = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TodoTask = {
  id: number;
  project_id: number | null;
  title: string;
  notes: string | null;
  status: TodoTaskStatus;
  due_date: string | null;
  due_time: string | null;
  repeat_frequency: TodoRepeatFrequency;
  repeat_interval: number;
  repeat_until: string | null;
  flagged: boolean;
  priority: TodoTaskPriority;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type TodoScope =
  | { kind: "view"; view: TodoView }
  | { kind: "project"; projectId: number };

export type TodoState = {
  loading: boolean;
  saving: boolean;
  error?: string;
  projects: TodoProject[];
  tasks: TodoTask[];
  scope: TodoScope;
  editingTaskId?: number;
  editingProjectId?: number;
  todoPanelCollapsed?: boolean;
  sort: TodoSort;
  direction: TodoSortDirection;
  search: string;
  taskFormError?: string;
  projectFormError?: string;
};

export type TodoTaskPayload = {
  project_id: number | null;
  title: string;
  notes: string | null;
  status?: TodoTaskStatus;
  due_date: string | null;
  due_time: string | null;
  repeat_frequency: TodoRepeatFrequency;
  repeat_interval: number;
  repeat_until: string | null;
  flagged: boolean;
  priority: TodoTaskPriority;
};

export type TodoProjectPayload = {
  name: string;
  start_date: string | null;
  end_date: string | null;
};

export type TodoTaskQuery = {
  view?: TodoServerView;
  status?: TodoTaskStatus;
  project_id?: number;
  sort?: TodoSort;
  direction?: TodoSortDirection;
  q?: string;
};
