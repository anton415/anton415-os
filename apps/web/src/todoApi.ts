import type {
  TodoProject,
  TodoProjectPayload,
  TodoTask,
  TodoTaskPayload,
  TodoTaskQuery
} from "./types";

type DataEnvelope<T> = {
  data: T;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class TodoApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TodoApiError";
    this.code = code;
  }
}

export class TodoApi {
  private readonly baseUrl: string;

  constructor(apiBaseUrl: string) {
    this.baseUrl = apiBaseUrl.replace(/\/$/, "");
  }

  listProjects(): Promise<TodoProject[]> {
    return this.request<TodoProject[]>("/api/v1/todo/projects");
  }

  createProject(payload: TodoProjectPayload): Promise<TodoProject> {
    return this.request<TodoProject>("/api/v1/todo/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  updateProject(id: number, payload: TodoProjectPayload): Promise<TodoProject> {
    return this.request<TodoProject>(`/api/v1/todo/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }

  async deleteProject(id: number): Promise<void> {
    await this.request<void>(`/api/v1/todo/projects/${id}`, { method: "DELETE" });
  }

  listTasks(query: TodoTaskQuery): Promise<TodoTask[]> {
    const params = new URLSearchParams();
    if (query.view) {
      params.set("view", query.view);
    }
    if (query.status) {
      params.set("status", query.status);
    }
    if (query.project_id) {
      params.set("project_id", String(query.project_id));
    }
    if (query.sort) {
      params.set("sort", query.sort);
    }
    if (query.direction) {
      params.set("direction", query.direction);
    }
    if (query.q) {
      params.set("q", query.q);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.request<TodoTask[]>(`/api/v1/todo/tasks${suffix}`);
  }

  createTask(payload: TodoTaskPayload): Promise<TodoTask> {
    return this.request<TodoTask>("/api/v1/todo/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  updateTask(id: number, payload: Partial<TodoTaskPayload>): Promise<TodoTask> {
    return this.request<TodoTask>(`/api/v1/todo/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }

  async deleteTask(id: number): Promise<void> {
    await this.request<void>(`/api/v1/todo/tasks/${id}`, { method: "DELETE" });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers
      }
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json()) as DataEnvelope<T> & ErrorEnvelope;
    if (!response.ok) {
      throw new TodoApiError(
        payload.error?.code ?? "request_failed",
        payload.error?.message ?? `Request failed with status ${response.status}`
      );
    }

    return payload.data;
  }
}
