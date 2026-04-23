import "./styles.css";

import { fetchHealth } from "./health";
import { renderApp } from "./render";
import { TodoApi } from "./todoApi";
import type {
  AppPath,
  HealthState,
  TodoScope,
  TodoState,
  TodoStatusFilter,
  TodoTaskPayload,
  TodoTaskQuery,
  TodoTaskStatus
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found");
}

const root = app;
const todoApi = new TodoApi(apiBaseUrl);
let healthState: HealthState = { kind: "loading" };
let currentPath: AppPath = routeFromPath(window.location.pathname);
let todoState: TodoState = {
  loading: false,
  saving: false,
  projects: [],
  tasks: [],
  scope: { kind: "view", view: "inbox" },
  statusFilter: "all"
};

function render() {
  renderApp(root, {
    apiBaseUrl,
    currentPath,
    healthState,
    todoState,
    onNavigate: navigate,
    onRefreshHealth: () => {
      void refreshHealth();
    },
    onRefreshTodo: () => {
      void refreshTodo();
    },
    onSelectTodoScope: (scope) => {
      todoState = { ...todoState, scope, editingTaskId: undefined };
      void refreshTodo();
    },
    onSelectTodoStatusFilter: (statusFilter) => {
      todoState = { ...todoState, statusFilter, editingTaskId: undefined };
      void refreshTodo();
    },
    onEditTask: (taskId) => {
      todoState = { ...todoState, editingTaskId: taskId, taskFormError: undefined };
      render();
    },
    onCancelTaskEdit: () => {
      todoState = { ...todoState, editingTaskId: undefined, taskFormError: undefined };
      render();
    },
    onSaveTask: (form) => {
      void saveTask(form);
    },
    onDeleteTask: (taskId) => {
      void deleteTask(taskId);
    },
    onChangeTaskStatus: (taskId, status) => {
      void changeTaskStatus(taskId, status);
    },
    onEditProject: (projectId) => {
      todoState = { ...todoState, editingProjectId: projectId, projectFormError: undefined };
      render();
    },
    onCancelProjectEdit: () => {
      todoState = { ...todoState, editingProjectId: undefined, projectFormError: undefined };
      render();
    },
    onSaveProject: (form) => {
      void saveProject(form);
    },
    onDeleteProject: (projectId) => {
      void deleteProject(projectId);
    }
  });
}

async function refreshHealth() {
  healthState = { kind: "loading" };
  render();
  healthState = await fetchHealth(apiBaseUrl);
  render();
}

async function refreshTodo() {
  if (currentPath !== "/todo") {
    return;
  }

  todoState = { ...todoState, loading: true, error: undefined };
  render();

  try {
    const [projects, tasks] = await Promise.all([
      todoApi.listProjects(),
      todoApi.listTasks(taskQuery(todoState))
    ]);
    todoState = { ...todoState, loading: false, projects, tasks, error: undefined };
  } catch (error) {
    todoState = { ...todoState, loading: false, error: errorMessage(error) };
  }
  render();
}

async function saveTask(form: HTMLFormElement) {
  const formData = new FormData(form);
  const taskId = optionalNumber(formData.get("task_id"));
  const payload = taskPayload(formData);

  todoState = { ...todoState, saving: true, taskFormError: undefined };
  render();

  try {
    if (taskId) {
      await todoApi.updateTask(taskId, payload);
    } else {
      await todoApi.createTask(payload);
    }
    todoState = { ...todoState, saving: false, editingTaskId: undefined, taskFormError: undefined };
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, taskFormError: errorMessage(error) };
    render();
  }
}

async function deleteTask(taskId: number) {
  if (!window.confirm("Delete this task?")) {
    return;
  }

  todoState = { ...todoState, saving: true, error: undefined };
  render();
  try {
    await todoApi.deleteTask(taskId);
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, error: errorMessage(error) };
    render();
  }
}

async function changeTaskStatus(taskId: number, status: TodoTaskStatus) {
  todoState = { ...todoState, saving: true, error: undefined };
  render();
  try {
    await todoApi.updateTask(taskId, { status });
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, error: errorMessage(error) };
    render();
  }
}

async function saveProject(form: HTMLFormElement) {
  const formData = new FormData(form);
  const projectId = optionalNumber(formData.get("project_id"));
  const name = String(formData.get("name") ?? "");

  todoState = { ...todoState, saving: true, projectFormError: undefined };
  render();
  try {
    if (projectId) {
      await todoApi.updateProject(projectId, { name });
    } else {
      await todoApi.createProject({ name });
    }
    todoState = {
      ...todoState,
      saving: false,
      editingProjectId: undefined,
      projectFormError: undefined
    };
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, projectFormError: errorMessage(error) };
    render();
  }
}

async function deleteProject(projectId: number) {
  if (!window.confirm("Delete this project? Tasks must be moved or deleted first.")) {
    return;
  }

  todoState = { ...todoState, saving: true, error: undefined };
  render();
  try {
    await todoApi.deleteProject(projectId);
    if (todoState.scope.kind === "project" && todoState.scope.projectId === projectId) {
      todoState = { ...todoState, scope: { kind: "view", view: "inbox" } };
    }
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, error: errorMessage(error) };
    render();
  }
}

function navigate(path: string) {
  const nextPath = routeFromPath(path);
  if (currentPath !== nextPath) {
    window.history.pushState({}, "", nextPath);
    currentPath = nextPath;
  }
  render();
  if (currentPath === "/todo") {
    void refreshTodo();
  }
}

window.addEventListener("popstate", () => {
  currentPath = routeFromPath(window.location.pathname);
  render();
  if (currentPath === "/todo") {
    void refreshTodo();
  }
});

function routeFromPath(path: string): AppPath {
  return path === "/todo" ? "/todo" : "/";
}

function taskQuery(state: TodoState): TodoTaskQuery {
  const query: TodoTaskQuery = {};
  if (state.scope.kind === "view") {
    query.view = state.scope.view;
  } else {
    query.project_id = state.scope.projectId;
  }
  if (state.statusFilter !== "all") {
    query.status = state.statusFilter;
  }
  return query;
}

function taskPayload(formData: FormData): TodoTaskPayload {
  const projectID = optionalNumber(formData.get("project_id"));
  const dueDate = optionalString(formData.get("due_date"));
  const notes = optionalString(formData.get("notes"));
  const status = String(formData.get("status") ?? "todo") as TodoTaskStatus;

  return {
    project_id: projectID ?? null,
    title: String(formData.get("title") ?? ""),
    notes,
    status,
    due_date: dueDate
  };
}

function optionalString(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  if (text === "") {
    return undefined;
  }

  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

render();
void refreshHealth();
if (currentPath === "/todo") {
  void refreshTodo();
}
