import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderApp } from "./render";
import type { AuthState, HealthState, TodoProject, TodoState, TodoTask } from "./types";

type RenderOptions = Parameters<typeof renderApp>[1];

let root: HTMLDivElement;

describe("renderApp todo", () => {
  beforeEach(() => {
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  it("renders smart lists and selects scopes without a global status filter", () => {
    const options = optionsForTodo();

    renderApp(root, options);

    expect(root.querySelector("#todo-status-filter")).toBeNull();
    expect(root.querySelector('select[name="status"]')).toBeNull();
    expect(smartListLabels()).toEqual(["Inbox", "Today", "Upcoming", "All", "Completed"]);
    expect(smartListButton("inbox")?.getAttribute("aria-pressed")).toBe("true");

    smartListButton("completed")?.click();

    expect(options.onSelectTodoScope).toHaveBeenCalledWith({ kind: "view", view: "completed" });
  });

  it("escapes task and project text", () => {
    renderApp(
      root,
      optionsForTodo({
        todoState: todoState({
          projects: [project({ id: 2, name: "Home & Work" })],
          tasks: [task({ id: 1, project_id: 2, title: "<script>alert(1)</script>", notes: "Use <b>milk</b>" })]
        })
      })
    );

    expect(root.textContent).toContain("<script>alert(1)</script>");
    expect(root.textContent).toContain("Use <b>milk</b>");
    expect(root.innerHTML).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(root.querySelector("script")).toBeNull();
  });

  it("defaults quick-add due date for Today", () => {
    renderApp(root, optionsForTodo({ todoState: todoState({ scope: { kind: "view", view: "today" } }) }));

    const dueDate = root.querySelector<HTMLInputElement>('input[name="due_date"]');

    expect(dueDate?.value).toBe(localDateInputValue(new Date()));
  });

  it("defaults quick-add project when a project list is selected", () => {
    renderApp(
      root,
      optionsForTodo({
        todoState: todoState({
          scope: { kind: "project", projectId: 2 },
          projects: [project({ id: 1, name: "Home" }), project({ id: 2, name: "Work" })]
        })
      })
    );

    const projectSelect = root.querySelector<HTMLSelectElement>('select[name="project_id"]');

    expect(projectSelect?.value).toBe("2");
  });

  it("renders a compact project composer row", () => {
    renderApp(root, optionsForTodo());

    const form = root.querySelector<HTMLFormElement>("#project-form");

    expect(form?.classList.contains("project-row")).toBe(true);
    expect(form?.querySelector<HTMLInputElement>('input[name="name"]')?.placeholder).toBe("New project");
    expect(form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent?.trim()).toBe("+");
  });

  it("toggles the Todo panel", () => {
    const options = optionsForTodo({
      todoState: todoState({ todoPanelCollapsed: true })
    });

    renderApp(root, options);

    expect(root.querySelector("#todo-panel")?.classList.contains("collapsed")).toBe(true);
    expect(root.querySelector("#toggle-todo-panel")?.getAttribute("aria-expanded")).toBe("false");

    root.querySelector<HTMLButtonElement>("#toggle-todo-panel")?.click();

    expect(options.onToggleTodoPanel).toHaveBeenCalled();
  });

  it("hides the new task composer in Completed", () => {
    renderApp(root, optionsForTodo({ todoState: todoState({ scope: { kind: "view", view: "completed" } }) }));

    expect(root.querySelector("#task-form")).toBeNull();
    expect(smartListButton("completed")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps task editing available in Completed", () => {
    renderApp(
      root,
      optionsForTodo({
        todoState: todoState({
          scope: { kind: "view", view: "completed" },
          editingTaskId: 2,
          tasks: [task({ id: 2, title: "Paid bill", notes: "Already paid", status: "done" })]
        })
      })
    );

    expect(root.querySelector("#task-form")).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe("Paid bill");
    expect(root.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')?.value).toBe("Already paid");
    expect(root.querySelector('select[name="status"]')).toBeNull();
  });

  it("toggles task completion from task rows", () => {
    const options = optionsForTodo({
      todoState: todoState({
        tasks: [task({ id: 1, title: "Buy milk" }), task({ id: 2, title: "Paid bill", status: "done" })]
      })
    });

    renderApp(root, options);

    root.querySelector<HTMLButtonElement>('[data-toggle-task-status-id="1"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-toggle-task-status-id="2"]')?.click();

    expect(options.onChangeTaskStatus).toHaveBeenNthCalledWith(1, 1, "done");
    expect(options.onChangeTaskStatus).toHaveBeenNthCalledWith(2, 2, "todo");
  });

  it("renders login controls for unauthenticated Todo access", () => {
    const options = optionsForTodo({
      authState: {
        kind: "unauthenticated",
        providers: [
          { id: "email", name: "Email link", kind: "email" },
          { id: "github", name: "GitHub", kind: "oauth" }
        ]
      }
    });

    renderApp(root, options);

    expect(root.querySelector("#task-form")).toBeNull();
    expect(root.querySelector<HTMLInputElement>('input[name="email"]')).not.toBeNull();
    expect(root.querySelector<HTMLAnchorElement>(".oauth-button")?.href).toBe(
      "http://api.test/api/v1/auth/github/start?redirect=/todo"
    );

    root.querySelector<HTMLFormElement>("#email-login-form")?.dispatchEvent(new Event("submit", { bubbles: true }));

    expect(options.onStartEmailLogin).toHaveBeenCalled();
  });
});

function optionsForTodo(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    apiBaseUrl: "http://api.test",
    currentPath: "/todo",
    authState: authState(),
    healthState: { kind: "online", payload: healthPayload() },
    todoState: todoState(),
    onNavigate: vi.fn(),
    onStartEmailLogin: vi.fn(),
    onLogout: vi.fn(),
    onRefreshHealth: vi.fn(),
    onRefreshTodo: vi.fn(),
    onToggleTodoPanel: vi.fn(),
    onSelectTodoScope: vi.fn(),
    onEditTask: vi.fn(),
    onCancelTaskEdit: vi.fn(),
    onSaveTask: vi.fn(),
    onDeleteTask: vi.fn(),
    onChangeTaskStatus: vi.fn(),
    onEditProject: vi.fn(),
    onCancelProjectEdit: vi.fn(),
    onSaveProject: vi.fn(),
    onDeleteProject: vi.fn(),
    ...overrides
  };
}

function authState(overrides: Partial<Extract<AuthState, { kind: "authenticated" }>> = {}): AuthState {
  return {
    kind: "authenticated",
    providers: [],
    user: { email: "anton@example.com", provider: "email" },
    ...overrides
  };
}

function healthPayload(): Extract<HealthState, { kind: "online" }>["payload"] {
  return {
    service: "anton415-os-api",
    status: "ok",
    version: "test",
    checks: { database: { status: "ok", latency: "1ms" } }
  };
}

function todoState(overrides: Partial<TodoState> = {}): TodoState {
  return {
    loading: false,
    saving: false,
    projects: [],
    tasks: [],
    scope: { kind: "view", view: "inbox" },
    ...overrides
  };
}

function project(overrides: Partial<TodoProject> = {}): TodoProject {
  return {
    id: 1,
    name: "Home",
    created_at: "2026-04-23T10:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    ...overrides
  };
}

function task(overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id: 1,
    project_id: null,
    title: "Task",
    notes: null,
    status: "todo",
    due_date: null,
    created_at: "2026-04-23T10:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    completed_at: null,
    ...overrides
  };
}

function smartListLabels(): string[] {
  return [...root.querySelectorAll<HTMLButtonElement>("[data-todo-view]")].map((button) =>
    button.textContent?.trim() ?? ""
  );
}

function smartListButton(view: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`[data-todo-view="${view}"]`);
}

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
