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

export type ProductModule = {
  name: string;
  path: string;
  accent: string;
  summary: string;
  state?: string;
};

export type AppPath = "/" | "/todo";

export type TodoTaskStatus = "todo" | "in_progress" | "done";
export type TodoView = "inbox" | "today" | "upcoming" | "all" | "completed";
export type TodoServerView = Exclude<TodoView, "all" | "completed">;

export type TodoProject = {
  id: number;
  name: string;
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
  taskFormError?: string;
  projectFormError?: string;
};

export type TodoTaskPayload = {
  project_id: number | null;
  title: string;
  notes: string | null;
  status?: TodoTaskStatus;
  due_date: string | null;
};

export type TodoProjectPayload = {
  name: string;
};

export type TodoTaskQuery = {
  view?: TodoServerView;
  status?: TodoTaskStatus;
  project_id?: number;
};
