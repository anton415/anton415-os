import { productModules } from "./modules";
import type {
  AppPath,
  HealthState,
  TodoProject,
  TodoScope,
  TodoState,
  TodoTask,
  TodoTaskStatus,
  TodoView
} from "./types";

type SmartList = {
  view: TodoView;
  label: string;
  accent: string;
};

type RenderOptions = {
  apiBaseUrl: string;
  currentPath: AppPath;
  healthState: HealthState;
  todoState: TodoState;
  onNavigate: (path: string) => void;
  onRefreshHealth: () => void;
  onRefreshTodo: () => void;
  onSelectTodoScope: (scope: TodoScope) => void;
  onEditTask: (taskId: number) => void;
  onCancelTaskEdit: () => void;
  onSaveTask: (form: HTMLFormElement) => void;
  onDeleteTask: (taskId: number) => void;
  onChangeTaskStatus: (taskId: number, status: TodoTaskStatus) => void;
  onEditProject: (projectId: number) => void;
  onCancelProjectEdit: () => void;
  onSaveProject: (form: HTMLFormElement) => void;
  onDeleteProject: (projectId: number) => void;
};

export function renderApp(root: HTMLElement, options: RenderOptions) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Main navigation">
        <a class="brand" href="/" data-route="/">
          <span class="brand-mark" aria-hidden="true">A</span>
          <span>
            <strong>anton415 OS</strong>
            <span>modular monolith</span>
          </span>
        </a>
        <nav class="module-nav">
          ${renderModuleNav(options.currentPath)}
        </nav>
      </aside>

      <main class="workspace">
        ${options.currentPath === "/todo" ? renderTodoPage(options) : renderHomePage(options)}
      </main>
    </div>
  `;

  bindShellEvents(root, options);
  if (options.currentPath === "/todo") {
    bindTodoEvents(root, options);
  }
}

function renderHomePage(options: RenderOptions): string {
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Step 3 Todo v1</p>
        <h1>Platform shell</h1>
      </div>
      ${renderHealthBadge(options.healthState)}
    </header>

    <section class="status-panel" aria-live="polite">
      <div>
        <p class="section-label">Backend connectivity</p>
        ${renderHealthDetails(options.healthState, options.apiBaseUrl)}
      </div>
      <button class="icon-button" type="button" id="refresh-health" aria-label="Refresh backend health" title="Refresh backend health">
        &#8635;
      </button>
    </section>

    <section class="module-grid" aria-label="Product modules">
      ${renderModuleCards()}
    </section>
  `;
}

function renderTodoPage(options: RenderOptions): string {
  const state = options.todoState;
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Todo v1</p>
        <h1>Todo</h1>
      </div>
      <div class="topbar-actions">
        ${renderHealthBadge(options.healthState)}
        <button class="icon-button" type="button" id="refresh-todo" aria-label="Refresh Todo" title="Refresh Todo">
          &#8635;
        </button>
      </div>
    </header>

    ${state.error ? `<div class="inline-error" role="alert">${escapeHTML(state.error)}</div>` : ""}

    <section class="todo-layout">
      <aside class="todo-panel">
        ${renderSmartLists(state)}
        ${renderProjectList(state)}
        ${renderProjectForm(state)}
      </aside>
      <section class="todo-main">
        ${renderTaskForm(state)}
        ${renderTaskList(state)}
      </section>
    </section>
  `;
}

function renderModuleNav(currentPath: AppPath): string {
  return productModules
    .map(
      (module) => `
        <a href="${module.path}" data-route="${module.path}" class="${currentPath === module.path ? "active" : ""}">
          <span class="nav-swatch" style="background: ${module.accent}"></span>
          ${escapeHTML(module.name)}
        </a>
      `
    )
    .join("");
}

function renderModuleCards(): string {
  return productModules
    .map(
      (module) => `
        <article class="module-card">
          <div class="module-card-header">
            <span class="module-swatch" style="background: ${module.accent}"></span>
            <h2>${escapeHTML(module.name)}</h2>
          </div>
          <p>${escapeHTML(module.summary)}</p>
          <span class="module-state">${escapeHTML(module.state ?? "not implemented")}</span>
        </article>
      `
    )
    .join("");
}

const smartLists: SmartList[] = [
  { view: "inbox", label: "Inbox", accent: "#2563eb" },
  { view: "today", label: "Today", accent: "#ef4444" },
  { view: "upcoming", label: "Upcoming", accent: "#f59e0b" },
  { view: "all", label: "All", accent: "#64748b" },
  { view: "completed", label: "Completed", accent: "#22c55e" }
];

function renderSmartLists(state: TodoState): string {
  return `
    <section class="smart-list-panel" aria-label="Smart lists">
      <div class="smart-list-grid">
        ${smartLists.map((list) => renderSmartListButton(state, list)).join("")}
      </div>
    </section>
  `;
}

function renderSmartListButton(state: TodoState, list: SmartList): string {
  const active = state.scope.kind === "view" && state.scope.view === list.view;
  return `
    <button class="smart-list-button ${active ? "active" : ""}" type="button" data-todo-view="${list.view}" aria-pressed="${active}">
      <span class="smart-list-icon" style="background: ${list.accent}" aria-hidden="true"></span>
      <span>${escapeHTML(list.label)}</span>
    </button>
  `;
}

function renderProjectForm(state: TodoState): string {
  const project = state.projects.find((item) => item.id === state.editingProjectId);
  return `
    <form class="todo-form" id="project-form">
      <h2>${project ? "Edit project" : "New project"}</h2>
      <input type="hidden" name="project_id" value="${project?.id ?? ""}">
      <label>
        <span>Name</span>
        <input name="name" type="text" value="${escapeAttr(project?.name ?? "")}" placeholder="Project name" autocomplete="off" required>
      </label>
      ${state.projectFormError ? `<p class="form-error">${escapeHTML(state.projectFormError)}</p>` : ""}
      <div class="form-actions">
        <button type="submit" ${state.saving ? "disabled" : ""}>${project ? "Save project" : "Create project"}</button>
        ${project ? `<button class="secondary-button" type="button" id="cancel-project-edit">Cancel</button>` : ""}
      </div>
    </form>
  `;
}

function renderProjectList(state: TodoState): string {
  const projects = state.projects
    .map((project) => {
      const active = state.scope.kind === "project" && state.scope.projectId === project.id;
      return `
        <li class="project-row ${active ? "active" : ""}">
          <button type="button" data-project-id="${project.id}">
            ${escapeHTML(project.name)}
          </button>
          <span>
            <button class="icon-button small" type="button" data-edit-project-id="${project.id}" aria-label="Edit ${escapeAttr(project.name)}" title="Edit project">&#9998;</button>
            <button class="icon-button small danger" type="button" data-delete-project-id="${project.id}" aria-label="Delete ${escapeAttr(project.name)}" title="Delete project">&#8722;</button>
          </span>
        </li>
      `;
    })
    .join("");

  return `
    <section class="project-list" aria-label="Projects">
      <div class="panel-header">
        <h2>Projects</h2>
      </div>
      ${
        state.projects.length === 0
          ? `<p class="empty-state">No projects yet.</p>`
          : `<ul>${projects}</ul>`
      }
    </section>
  `;
}

function renderTaskForm(state: TodoState): string {
  const task = state.tasks.find((item) => item.id === state.editingTaskId);
  const selectedProjectID =
    task?.project_id ?? (state.scope.kind === "project" ? state.scope.projectId : null);
  const dueDate = task?.due_date ?? defaultDueDateForScope(state.scope);

  return `
    <form class="todo-form task-form" id="task-form">
      <h2>${task ? "Edit task" : "New task"}</h2>
      <input type="hidden" name="task_id" value="${task?.id ?? ""}">
      <label>
        <span>Title</span>
        <input name="title" type="text" value="${escapeAttr(task?.title ?? "")}" placeholder="Task title" autocomplete="off" required>
      </label>
      <label>
        <span>Notes</span>
        <textarea name="notes" rows="3" placeholder="Notes">${escapeHTML(task?.notes ?? "")}</textarea>
      </label>
      <div class="form-grid">
        <label>
          <span>Project</span>
          <select name="project_id">
            <option value="" ${selectedProjectID === null ? "selected" : ""}>Inbox</option>
            ${state.projects.map((project) => renderProjectOption(project, selectedProjectID)).join("")}
          </select>
        </label>
        <label>
          <span>Due date</span>
          <input name="due_date" type="date" value="${escapeAttr(dueDate)}">
        </label>
      </div>
      ${state.taskFormError ? `<p class="form-error">${escapeHTML(state.taskFormError)}</p>` : ""}
      <div class="form-actions">
        <button type="submit" ${state.saving ? "disabled" : ""}>${task ? "Save task" : "Create task"}</button>
        ${task ? `<button class="secondary-button" type="button" id="cancel-task-edit">Cancel</button>` : ""}
      </div>
    </form>
  `;
}

function renderProjectOption(project: TodoProject, selectedProjectID: number | null): string {
  return `<option value="${project.id}" ${selectedProjectID === project.id ? "selected" : ""}>${escapeHTML(project.name)}</option>`;
}

function defaultDueDateForScope(scope: TodoScope): string {
  if (scope.kind !== "view" || scope.view !== "today") {
    return "";
  }
  return localDateInputValue(new Date());
}

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderTaskList(state: TodoState): string {
  if (state.loading) {
    return `<section class="task-list"><p class="empty-state">Loading tasks...</p></section>`;
  }

  if (state.tasks.length === 0) {
    return `<section class="task-list"><p class="empty-state">No tasks in this view.</p></section>`;
  }

  return `
    <section class="task-list" aria-label="Tasks">
      ${state.tasks.map((task) => renderTaskItem(task, state.projects, state.saving)).join("")}
    </section>
  `;
}

function renderTaskItem(task: TodoTask, projects: TodoProject[], saving: boolean): string {
  const project = projects.find((item) => item.id === task.project_id);
  const done = task.status === "done";
  const nextStatus: TodoTaskStatus = done ? "todo" : "done";
  return `
    <article class="task-item ${done ? "done" : ""}">
      <button
        class="complete-button"
        type="button"
        data-toggle-task-status-id="${task.id}"
        data-next-status="${nextStatus}"
        aria-label="${done ? `Reopen ${escapeAttr(task.title)}` : `Complete ${escapeAttr(task.title)}`}"
        aria-pressed="${done}"
        ${saving ? "disabled" : ""}
      >
        <span aria-hidden="true">${done ? "&#10003;" : ""}</span>
      </button>
      <div class="task-main">
        <div class="task-title-row">
          <h2>${escapeHTML(task.title)}</h2>
        </div>
        ${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ""}
        <dl class="task-meta">
          <div><dt>Project</dt><dd>${project ? escapeHTML(project.name) : "Inbox"}</dd></div>
          <div><dt>Due</dt><dd>${task.due_date ? escapeHTML(task.due_date) : "No date"}</dd></div>
        </dl>
      </div>
      <div class="task-actions">
        <button class="icon-button small" type="button" data-edit-task-id="${task.id}" aria-label="Edit ${escapeAttr(task.title)}" title="Edit task">&#9998;</button>
        <button class="icon-button small danger" type="button" data-delete-task-id="${task.id}" aria-label="Delete ${escapeAttr(task.title)}" title="Delete task">&#8722;</button>
      </div>
    </article>
  `;
}

function renderHealthBadge(state: HealthState): string {
  if (state.kind === "online") {
    return `<span class="health-badge health-badge-ok">API online</span>`;
  }
  if (state.kind === "offline") {
    return `<span class="health-badge health-badge-down">API offline</span>`;
  }
  return `<span class="health-badge">Checking API</span>`;
}

function renderHealthDetails(state: HealthState, apiBaseUrl: string): string {
  if (state.kind === "loading") {
    return `<h2>Checking health...</h2><p>Calling ${escapeHTML(apiBaseUrl)}/health.</p>`;
  }

  if (state.kind === "offline") {
    return `<h2>Backend unavailable</h2><p>${escapeHTML(state.message)}</p>`;
  }

  const database = state.payload.checks.database;
  return `
    <h2>${escapeHTML(state.payload.service)} is ${escapeHTML(state.payload.status)}</h2>
    <dl class="health-list">
      <div><dt>Version</dt><dd>${escapeHTML(state.payload.version)}</dd></div>
      <div><dt>Database</dt><dd>${escapeHTML(database?.status ?? "unknown")}</dd></div>
      <div><dt>Latency</dt><dd>${escapeHTML(database?.latency ?? "n/a")}</dd></div>
    </dl>
  `;
}

function bindShellEvents(root: HTMLElement, options: RenderOptions) {
  root.querySelectorAll<HTMLAnchorElement>("[data-route]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      options.onNavigate(link.dataset.route ?? "/");
    });
  });

  root.querySelector("#refresh-health")?.addEventListener("click", options.onRefreshHealth);
}

function bindTodoEvents(root: HTMLElement, options: RenderOptions) {
  root.querySelector("#refresh-todo")?.addEventListener("click", options.onRefreshTodo);

  root.querySelectorAll<HTMLButtonElement>("[data-todo-view]").forEach((button) => {
    button.addEventListener("click", () => {
      options.onSelectTodoScope({ kind: "view", view: button.dataset.todoView as TodoView });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = numberFromDataset(button.dataset.projectId);
      if (projectId) {
        options.onSelectTodoScope({ kind: "project", projectId });
      }
    });
  });

  root.querySelector<HTMLFormElement>("#task-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onSaveTask(event.currentTarget as HTMLFormElement);
  });

  root.querySelector("#cancel-task-edit")?.addEventListener("click", options.onCancelTaskEdit);

  root.querySelectorAll<HTMLButtonElement>("[data-edit-task-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = numberFromDataset(button.dataset.editTaskId);
      if (taskId) {
        options.onEditTask(taskId);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-delete-task-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = numberFromDataset(button.dataset.deleteTaskId);
      if (taskId) {
        options.onDeleteTask(taskId);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-toggle-task-status-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = numberFromDataset(button.dataset.toggleTaskStatusId);
      if (taskId) {
        options.onChangeTaskStatus(taskId, button.dataset.nextStatus as TodoTaskStatus);
      }
    });
  });

  root.querySelector<HTMLFormElement>("#project-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onSaveProject(event.currentTarget as HTMLFormElement);
  });

  root.querySelector("#cancel-project-edit")?.addEventListener("click", options.onCancelProjectEdit);

  root.querySelectorAll<HTMLButtonElement>("[data-edit-project-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = numberFromDataset(button.dataset.editProjectId);
      if (projectId) {
        options.onEditProject(projectId);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-delete-project-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = numberFromDataset(button.dataset.deleteProjectId);
      if (projectId) {
        options.onDeleteProject(projectId);
      }
    });
  });
}

function numberFromDataset(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value: string): string {
  return escapeHTML(value);
}
