import { productModules } from "./modules";
import type {
  AppPath,
  AuthState,
  HealthState,
  TodoProject,
  TodoRepeatFrequency,
  TodoScope,
  TodoSort,
  TodoSortDirection,
  TodoState,
  TodoTask,
  TodoTaskPriority,
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
  sidebarCollapsed: boolean;
  authState: AuthState;
  healthState: HealthState;
  todoState: TodoState;
  onNavigate: (path: string) => void;
  onStartEmailLogin: (form: HTMLFormElement) => void;
  onLogout: () => void;
  onRefreshHealth: () => void;
  onToggleSidebar: () => void;
  onRefreshTodo: () => void;
  onToggleTodoPanel: () => void;
  onChangeTodoQuery: (search: string, sort: TodoSort, direction: TodoSortDirection) => void;
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
  const workspaceContent =
    options.authState.kind === "authenticated"
      ? options.currentPath === "/todo"
        ? renderTodoPage(options)
        : renderHomePage(options)
      : renderLoginPage(options);

  root.innerHTML = `
    <div class="app-shell ${options.sidebarCollapsed ? "sidebar-collapsed" : ""}">
      <aside class="sidebar" id="anton-os-sidebar" aria-label="Main navigation">
        <div class="sidebar-head">
          <a class="brand" href="/todo" data-route="/todo">
            <span class="brand-mark" aria-hidden="true">A</span>
            <span>
              <strong>anton415 OS</strong>
              <span>modular monolith</span>
            </span>
          </a>
          <button
            class="icon-button small sidebar-collapse"
            type="button"
            data-toggle-sidebar
            aria-controls="anton-os-sidebar"
            aria-expanded="true"
            aria-label="Hide anton-os panel"
            title="Hide anton-os panel"
          >
            &#8249;
          </button>
        </div>
        <nav class="module-nav">
          ${renderModuleNav(options.currentPath)}
        </nav>
      </aside>

      <main class="workspace">
        ${workspaceContent}
      </main>
    </div>
  `;

  bindShellEvents(root, options);
  if (options.authState.kind === "authenticated" && options.currentPath === "/todo") {
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
      <div class="topbar-actions">
        ${renderSidebarToggle(options)}
        ${renderAuthBadge(options.authState)}
        ${renderHealthBadge(options.healthState)}
      </div>
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
  if (options.authState.kind !== "authenticated") {
    return renderLoginPage(options);
  }

  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Todo v1</p>
        <h1>Todo</h1>
      </div>
      <div class="topbar-actions">
        ${renderSidebarToggle(options)}
        <button
          class="icon-button panel-toggle todo-panel-toggle"
          type="button"
          id="toggle-todo-panel"
          data-toggle-todo-panel
          aria-controls="todo-panel"
          aria-expanded="${state.todoPanelCollapsed ? "false" : "true"}"
          aria-label="${state.todoPanelCollapsed ? "Show Todo panel" : "Hide Todo panel"}"
          title="${state.todoPanelCollapsed ? "Show Todo panel" : "Hide Todo panel"}"
        >
          <span aria-hidden="true">&#9776;</span>
          <span>Lists</span>
        </button>
        <span class="auth-chip">${escapeHTML(options.authState.user.email)}</span>
        <button class="icon-button" type="button" id="logout" aria-label="Log out" title="Log out">
          &#8617;
        </button>
        ${renderHealthBadge(options.healthState)}
        <button class="icon-button" type="button" id="refresh-todo" aria-label="Refresh Todo" title="Refresh Todo">
          &#8635;
        </button>
      </div>
    </header>

    ${state.error ? `<div class="inline-error" role="alert">${escapeHTML(state.error)}</div>` : ""}

    <section class="todo-layout ${state.todoPanelCollapsed ? "todo-panel-collapsed" : ""}">
      <aside class="todo-panel ${state.todoPanelCollapsed ? "collapsed" : ""}" id="todo-panel">
        <div class="todo-panel-head">
          <h2>Lists</h2>
          <button
            class="icon-button small"
            type="button"
            data-toggle-todo-panel
            aria-controls="todo-panel"
            aria-expanded="true"
            aria-label="Hide Todo panel"
            title="Hide Todo panel"
          >
            &#8249;
          </button>
        </div>
        ${renderSmartLists(state)}
        ${renderProjectList(state)}
      </aside>
      <section class="todo-main">
        ${renderTodoToolbar(state)}
        ${renderTaskList(state)}
      </section>
    </section>
    ${renderProjectSettingsPanel(state)}
  `;
}

function renderLoginPage(options: RenderOptions): string {
  const state = options.authState;
  const providers = state.providers.filter((provider) => provider.kind === "oauth");
  const emailEnabled = state.providers.some((provider) => provider.id === "email");
  const message = state.kind === "unauthenticated" ? state.message : undefined;
  const emailSent = state.kind === "unauthenticated" ? state.emailSent : false;

  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Private anton415 OS</p>
        <h1>Sign in</h1>
      </div>
      <div class="topbar-actions">
        ${renderSidebarToggle(options)}
        ${renderHealthBadge(options.healthState)}
      </div>
    </header>

    <section class="login-panel" aria-label="Sign in">
      ${
        state.kind === "loading"
          ? `<p class="empty-state">Checking session...</p>`
          : `
            ${message ? `<div class="inline-error" role="alert">${escapeHTML(message)}</div>` : ""}
            ${
              emailSent
                ? `<p class="success-state">Magic link sent.</p>`
                : ""
            }
            ${
              emailEnabled
                ? `
                  <form class="login-form" id="email-login-form">
                    <label>
                      <span>Email</span>
                      <input name="email" type="email" autocomplete="email" required>
                    </label>
                    <button type="submit">Send link</button>
                  </form>
                `
                : ""
            }
            ${
              providers.length > 0
                ? `
                  <div class="oauth-list">
                    ${providers
                      .map(
                        (provider) => `
                          <a class="oauth-button" href="${authStartHref(options.apiBaseUrl, provider.id, options.currentPath)}">
                            ${escapeHTML(provider.name)}
                          </a>
                        `
                      )
                      .join("")}
                  </div>
                `
                : ""
            }
          `
      }
    </section>
  `;
}

function shouldRenderTaskForm(state: TodoState): boolean {
  return state.scope.kind !== "view" || state.scope.view !== "completed";
}

function renderSidebarToggle(options: RenderOptions): string {
  return `
    <button
      class="icon-button panel-toggle sidebar-toggle"
      type="button"
      id="toggle-sidebar"
      data-toggle-sidebar
      aria-controls="anton-os-sidebar"
      aria-expanded="${options.sidebarCollapsed ? "false" : "true"}"
      aria-label="${options.sidebarCollapsed ? "Show anton-os panel" : "Hide anton-os panel"}"
      title="${options.sidebarCollapsed ? "Show anton-os panel" : "Hide anton-os panel"}"
    >
      <span aria-hidden="true">&#9776;</span>
      <span>anton-os</span>
    </button>
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
  { view: "overdue", label: "Overdue", accent: "#b42318" },
  { view: "upcoming", label: "Upcoming", accent: "#f59e0b" },
  { view: "scheduled", label: "Scheduled", accent: "#7c3aed" },
  { view: "flagged", label: "Flagged", accent: "#ec4899" },
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
  return `
    <form class="project-row project-form" id="project-form">
      <label class="project-name-field">
        <span class="visually-hidden">Name</span>
        <input name="name" type="text" value="" placeholder="New project" autocomplete="off" required>
      </label>
      <span class="project-form-actions">
        <button class="icon-button small project-save-button" type="submit" ${state.saving ? "disabled" : ""} aria-label="Create project" title="Create project">
          +
        </button>
      </span>
      ${state.editingProjectId === undefined && state.projectFormError ? `<p class="form-error">${escapeHTML(state.projectFormError)}</p>` : ""}
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
            <span class="project-title">${escapeHTML(project.name)}</span>
            ${projectPeriod(project)}
          </button>
          <span>
            <button class="icon-button small" type="button" data-edit-project-id="${project.id}" aria-label="Project settings ${escapeAttr(project.name)}" title="Project settings">&#9881;</button>
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
      ${renderProjectForm(state)}
    </section>
  `;
}

function renderProjectSettingsPanel(state: TodoState): string {
  const project = state.projects.find((item) => item.id === state.editingProjectId);
  if (!project) {
    return "";
  }

  return `
    <div class="settings-backdrop" role="presentation"></div>
    <aside class="project-settings-panel" role="dialog" aria-modal="true" aria-labelledby="project-settings-title">
      <div class="settings-panel-header">
        <div>
          <p class="section-label">Project</p>
          <h2 id="project-settings-title">Settings</h2>
        </div>
        <button class="icon-button small" type="button" id="cancel-project-edit" aria-label="Close project settings" title="Close project settings">&#215;</button>
      </div>
      <form class="project-settings-form" id="project-settings-form">
        <input type="hidden" name="project_id" value="${project.id}">
        <label>
          <span>Name</span>
          <input name="name" type="text" value="${escapeAttr(project.name)}" autocomplete="off" required>
        </label>
        <div class="settings-form-grid">
          <label>
            <span>Start</span>
            <input name="start_date" type="date" value="${escapeAttr(project.start_date ?? "")}">
          </label>
          <label>
            <span>End</span>
            <input name="end_date" type="date" value="${escapeAttr(project.end_date ?? "")}">
          </label>
        </div>
        ${state.projectFormError ? `<p class="form-error">${escapeHTML(state.projectFormError)}</p>` : ""}
        <div class="settings-form-actions">
          <button class="secondary-button" type="button" id="cancel-project-edit-secondary">Cancel</button>
          <button class="primary-button" type="submit" ${state.saving ? "disabled" : ""}>Save</button>
        </div>
      </form>
    </aside>
  `;
}

function projectPeriod(project: TodoProject): string {
  if (!project.start_date && !project.end_date) {
    return "";
  }
  const start = project.start_date ?? "Any";
  const end = project.end_date ?? "Open";
  return `<small>${escapeHTML(start)} - ${escapeHTML(end)}</small>`;
}

function renderTodoToolbar(state: TodoState): string {
  return `
    <form class="todo-toolbar" id="todo-query-form" role="search">
      <label class="compact-field todo-search-field">
        <span class="visually-hidden">Search tasks</span>
        <input name="q" type="search" value="${escapeAttr(state.search)}" placeholder="Search">
      </label>
      <div class="todo-sort-controls">
        <label class="compact-field">
          <span class="visually-hidden">Sort tasks</span>
          <select name="sort">
            ${renderSortOption("smart", "Smart", state.sort)}
            ${renderSortOption("due", "Due", state.sort)}
            ${renderSortOption("created", "Created", state.sort)}
            ${renderSortOption("title", "Title", state.sort)}
            ${renderSortOption("priority", "Priority", state.sort)}
          </select>
        </label>
        <label class="compact-field">
          <span class="visually-hidden">Sort direction</span>
          <select name="direction">
            ${renderDirectionOption("asc", "Asc", state.direction)}
            ${renderDirectionOption("desc", "Desc", state.direction)}
          </select>
        </label>
        <button class="icon-button" type="submit" aria-label="Apply task filters" title="Apply task filters">&#8981;</button>
      </div>
    </form>
  `;
}

function renderSortOption(value: TodoSort, label: string, selected: TodoSort): string {
  return `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
}

function renderDirectionOption(value: TodoSortDirection, label: string, selected: TodoSortDirection): string {
  return `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
}

function renderTaskForm(state: TodoState): string {
  const selectedProjectID = state.scope.kind === "project" ? state.scope.projectId : null;
  const dueDate = defaultDueDateForScope(state.scope);
  const renderSettingsButton = state.editingTaskId === undefined;

  return `
    <form class="task-item task-form" id="task-form">
      <span class="complete-button task-form-marker" aria-hidden="true"></span>
      <div class="task-main">
        <div class="task-title-row">
          <label class="task-title-field">
            <span class="visually-hidden">Title</span>
            <input name="title" type="text" value="" placeholder="New task" autocomplete="off" required>
          </label>
        </div>
        ${state.taskFormError ? `<p class="form-error">${escapeHTML(state.taskFormError)}</p>` : ""}
      </div>
      <div class="task-actions task-form-actions">
        ${
          renderSettingsButton
            ? `
              <button
                class="icon-button small task-settings-button"
                type="button"
                data-open-task-settings
                aria-controls="task-settings-panel"
                aria-expanded="false"
                aria-label="Task settings"
                title="Task settings"
              >
                &#9881;
              </button>
            `
            : ""
        }
        <button class="icon-button small task-form-submit" type="submit" aria-label="Create task" title="Create task" ${state.saving ? "disabled" : ""}>
          +
        </button>
      </div>
    </form>
    ${
      renderSettingsButton
        ? renderNewTaskSettingsPanel({
            projects: state.projects,
            selectedProjectID,
            notes: "",
            dueDate,
            dueTime: "",
            repeatFrequency: "none",
            repeatInterval: 1,
            repeatUntil: "",
            priority: "none",
            flagged: false
          })
        : ""
    }
  `;
}

function renderNewTaskSettingsPanel(values: {
  projects: TodoProject[];
  selectedProjectID: number | null;
  notes: string;
  dueDate: string;
  dueTime: string;
  repeatFrequency: TodoRepeatFrequency;
  repeatInterval: number;
  repeatUntil: string;
  priority: TodoTaskPriority;
  flagged: boolean;
}): string {
  return `
    <div class="settings-backdrop task-settings-backdrop" role="presentation" data-close-task-settings hidden></div>
    <aside
      class="project-settings-panel task-settings-panel"
      id="task-settings-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-settings-title"
      hidden
    >
      <div class="settings-panel-header">
        <div>
          <p class="section-label">Task</p>
          <h2 id="task-settings-title">Settings</h2>
        </div>
        <button class="icon-button small" type="button" data-close-task-settings aria-label="Close task settings" title="Close task settings">&#215;</button>
      </div>
      <div class="project-settings-form task-settings-form">
        <label>
          <span>Notes</span>
          <textarea form="task-form" name="notes" rows="3" placeholder="Notes">${escapeHTML(values.notes)}</textarea>
        </label>
        <div class="settings-form-grid">
          <label>
            <span>Project</span>
            <select form="task-form" name="project_id">
              <option value="" ${values.selectedProjectID === null ? "selected" : ""}>Inbox</option>
              ${values.projects.map((project) => renderProjectOption(project, values.selectedProjectID)).join("")}
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input form="task-form" name="due_date" type="date" value="${escapeAttr(values.dueDate)}">
          </label>
          <label>
            <span>Due time</span>
            <input form="task-form" name="due_time" type="time" value="${escapeAttr(values.dueTime)}">
          </label>
          <label>
            <span>Repeat</span>
            <select form="task-form" name="repeat_frequency">
              ${renderRepeatOption("none", "No repeat", values.repeatFrequency)}
              ${renderRepeatOption("daily", "Daily", values.repeatFrequency)}
              ${renderRepeatOption("weekly", "Weekly", values.repeatFrequency)}
              ${renderRepeatOption("monthly", "Monthly", values.repeatFrequency)}
              ${renderRepeatOption("yearly", "Yearly", values.repeatFrequency)}
            </select>
          </label>
          <label>
            <span>Every</span>
            <input form="task-form" name="repeat_interval" type="number" min="1" step="1" value="${values.repeatInterval}">
          </label>
          <label>
            <span>Until</span>
            <input form="task-form" name="repeat_until" type="date" value="${escapeAttr(values.repeatUntil)}">
          </label>
        </div>
        <label>
          <span>Priority</span>
          <select form="task-form" name="priority">
            ${renderPriorityOption("none", "No priority", values.priority)}
            ${renderPriorityOption("low", "Low", values.priority)}
            ${renderPriorityOption("medium", "Medium", values.priority)}
            ${renderPriorityOption("high", "High", values.priority)}
          </select>
        </label>
        <label class="task-flag-field">
          <input form="task-form" name="flagged" type="checkbox" ${values.flagged ? "checked" : ""}>
          <span>Flag</span>
        </label>
        <div class="settings-form-actions">
          <button class="primary-button" type="button" data-close-task-settings>Done</button>
        </div>
      </div>
    </aside>
  `;
}

function renderExistingTaskSettingsPanel(state: TodoState): string {
  const task = state.tasks.find((item) => item.id === state.editingTaskId);
  if (!task) {
    return "";
  }

  return `
    <div class="settings-backdrop task-settings-backdrop" role="presentation" data-cancel-task-edit></div>
    <aside
      class="project-settings-panel task-settings-panel"
      id="task-settings-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-settings-title"
    >
      <div class="settings-panel-header">
        <div>
          <p class="section-label">Task</p>
          <h2 id="task-settings-title">Settings</h2>
        </div>
        <button class="icon-button small" type="button" data-cancel-task-edit aria-label="Close task settings" title="Close task settings">&#215;</button>
      </div>
      <form class="project-settings-form task-settings-form" id="task-settings-form">
        <input type="hidden" name="task_id" value="${task.id}">
        <label>
          <span>Name</span>
          <input name="title" type="text" value="${escapeAttr(task.title)}" autocomplete="off" required>
        </label>
        <label>
          <span>Notes</span>
          <textarea name="notes" rows="3" placeholder="Notes">${escapeHTML(task.notes ?? "")}</textarea>
        </label>
        <div class="settings-form-grid">
          <label>
            <span>Project</span>
            <select name="project_id">
              <option value="" ${task.project_id === null ? "selected" : ""}>Inbox</option>
              ${state.projects.map((project) => renderProjectOption(project, task.project_id)).join("")}
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input name="due_date" type="date" value="${escapeAttr(task.due_date ?? "")}">
          </label>
          <label>
            <span>Due time</span>
            <input name="due_time" type="time" value="${escapeAttr(task.due_time ?? "")}">
          </label>
          <label>
            <span>Repeat</span>
            <select name="repeat_frequency">
              ${renderRepeatOption("none", "No repeat", task.repeat_frequency)}
              ${renderRepeatOption("daily", "Daily", task.repeat_frequency)}
              ${renderRepeatOption("weekly", "Weekly", task.repeat_frequency)}
              ${renderRepeatOption("monthly", "Monthly", task.repeat_frequency)}
              ${renderRepeatOption("yearly", "Yearly", task.repeat_frequency)}
            </select>
          </label>
          <label>
            <span>Every</span>
            <input name="repeat_interval" type="number" min="1" step="1" value="${task.repeat_interval}">
          </label>
          <label>
            <span>Until</span>
            <input name="repeat_until" type="date" value="${escapeAttr(task.repeat_until ?? "")}">
          </label>
        </div>
        <label>
          <span>Priority</span>
          <select name="priority">
            ${renderPriorityOption("none", "No priority", task.priority)}
            ${renderPriorityOption("low", "Low", task.priority)}
            ${renderPriorityOption("medium", "Medium", task.priority)}
            ${renderPriorityOption("high", "High", task.priority)}
          </select>
        </label>
        <label class="task-flag-field">
          <input name="flagged" type="checkbox" ${task.flagged ? "checked" : ""}>
          <span>Flag</span>
        </label>
        ${state.taskFormError ? `<p class="form-error">${escapeHTML(state.taskFormError)}</p>` : ""}
        <div class="settings-form-actions">
          <button class="secondary-button danger" type="button" data-delete-current-task-id="${task.id}">Delete</button>
          <button class="secondary-button" type="button" data-cancel-task-edit>Cancel</button>
          <button class="primary-button" type="submit" ${state.saving ? "disabled" : ""}>Save</button>
        </div>
      </form>
    </aside>
  `;
}

function renderProjectOption(project: TodoProject, selectedProjectID: number | null): string {
  return `<option value="${project.id}" ${selectedProjectID === project.id ? "selected" : ""}>${escapeHTML(project.name)}</option>`;
}

function renderRepeatOption(value: TodoRepeatFrequency, label: string, selected: TodoRepeatFrequency): string {
  return `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
}

function renderPriorityOption(value: TodoTaskPriority, label: string, selected: TodoTaskPriority): string {
  return `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
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
  const taskForm = shouldRenderTaskForm(state) ? renderTaskForm(state) : "";
  const taskSettingsPanel = renderExistingTaskSettingsPanel(state);

  if (state.loading) {
    return `
      <section class="task-list" aria-label="Tasks">
        ${taskForm}
        ${taskSettingsPanel}
        <p class="empty-state">Loading tasks...</p>
      </section>
    `;
  }

  if (state.tasks.length === 0) {
    return `
      <section class="task-list" aria-label="Tasks">
        ${taskForm}
        ${taskSettingsPanel}
        <p class="empty-state">No tasks in this view.</p>
      </section>
    `;
  }

  return `
    <section class="task-list" aria-label="Tasks">
      ${taskForm}
      ${state.tasks.map((task) => renderTaskItem(task, state.projects, state.saving)).join("")}
      ${taskSettingsPanel}
    </section>
  `;
}

function renderTaskItem(task: TodoTask, projects: TodoProject[], saving: boolean): string {
  const project = projects.find((item) => item.id === task.project_id);
  const done = task.status === "done";
  const nextStatus: TodoTaskStatus = done ? "todo" : "done";
  const markers = taskMarkers(task);
  const metaItems = [
    project ? `<div><dt>Project</dt><dd>${escapeHTML(project.name)}</dd></div>` : "",
    task.due_date ? `<div><dt>Due</dt><dd>${escapeHTML(taskDueLabel(task))}</dd></div>` : "",
    task.repeat_frequency !== "none" ? `<div><dt>Repeat</dt><dd>${escapeHTML(repeatLabel(task))}</dd></div>` : "",
    task.priority !== "none" ? `<div><dt>Priority</dt><dd>${escapeHTML(priorityLabel(task.priority))}</dd></div>` : ""
  ]
    .filter(Boolean)
    .join("");

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
          <h2>${markers}${escapeHTML(task.title)}</h2>
        </div>
        ${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ""}
        ${metaItems ? `<dl class="task-meta">${metaItems}</dl>` : ""}
      </div>
      <div class="task-actions">
        <button class="icon-button small" type="button" data-edit-task-id="${task.id}" aria-label="Task settings ${escapeAttr(task.title)}" title="Task settings">&#9881;</button>
      </div>
    </article>
  `;
}

function taskMarkers(task: TodoTask): string {
  const markers = [];
  if (task.flagged) {
    markers.push(`<span class="task-marker flagged" aria-label="Flagged" title="Flagged">&#9873;</span>`);
  }
  if (task.priority !== "none") {
    markers.push(`<span class="task-marker priority-${task.priority}" aria-label="${priorityLabel(task.priority)} priority" title="${priorityLabel(task.priority)} priority">${prioritySymbol(task.priority)}</span>`);
  }
  return markers.join("");
}

function taskDueLabel(task: TodoTask): string {
  if (!task.due_date) {
    return "No date";
  }
  return task.due_time ? `${task.due_date} ${task.due_time}` : task.due_date;
}

function repeatLabel(task: TodoTask): string {
  const base = repeatName(task.repeat_frequency);
  const interval = task.repeat_interval > 1 ? ` every ${task.repeat_interval}` : "";
  const until = task.repeat_until ? ` until ${task.repeat_until}` : "";
  return `${base}${interval}${until}`;
}

function repeatName(frequency: TodoRepeatFrequency): string {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return "No repeat";
  }
}

function priorityLabel(priority: TodoTaskPriority): string {
  switch (priority) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    default:
      return "No";
  }
}

function prioritySymbol(priority: TodoTaskPriority): string {
  switch (priority) {
    case "low":
      return "!";
    case "medium":
      return "!!";
    case "high":
      return "!!!";
    default:
      return "";
  }
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

function renderAuthBadge(state: AuthState): string {
  if (state.kind === "authenticated") {
    return `<span class="health-badge health-badge-ok">Signed in</span>`;
  }
  if (state.kind === "unauthenticated") {
    return `<span class="health-badge health-badge-down">Signed out</span>`;
  }
  return `<span class="health-badge">Checking session</span>`;
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

  root.querySelectorAll("[data-toggle-sidebar]").forEach((button) => {
    button.addEventListener("click", options.onToggleSidebar);
  });
  root.querySelector("#refresh-health")?.addEventListener("click", options.onRefreshHealth);
  root.querySelector("#logout")?.addEventListener("click", options.onLogout);
  root.querySelector<HTMLFormElement>("#email-login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onStartEmailLogin(event.currentTarget as HTMLFormElement);
  });
}

function bindTodoEvents(root: HTMLElement, options: RenderOptions) {
  root.querySelector("#refresh-todo")?.addEventListener("click", options.onRefreshTodo);
  root.querySelectorAll("[data-toggle-todo-panel]").forEach((button) => {
    button.addEventListener("click", options.onToggleTodoPanel);
  });
  root.querySelector<HTMLFormElement>("#todo-query-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    applyTodoQuery(form, options);
  });
  root.querySelectorAll<HTMLSelectElement>("#todo-query-form select").forEach((select) => {
    select.addEventListener("change", () => {
      const form = select.closest("form");
      if (form instanceof HTMLFormElement) {
        applyTodoQuery(form, options);
      }
    });
  });

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
  root.querySelector<HTMLFormElement>("#task-settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onSaveTask(event.currentTarget as HTMLFormElement);
  });

  root.querySelectorAll("[data-cancel-task-edit]").forEach((button) => {
    button.addEventListener("click", options.onCancelTaskEdit);
  });
  root.querySelector("[data-open-task-settings]")?.addEventListener("click", () => {
    setTaskSettingsOpen(root, true);
  });
  root.querySelectorAll("[data-close-task-settings]").forEach((button) => {
    button.addEventListener("click", () => {
      setTaskSettingsOpen(root, false);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-edit-task-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = numberFromDataset(button.dataset.editTaskId);
      if (taskId) {
        options.onEditTask(taskId);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-delete-current-task-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = numberFromDataset(button.dataset.deleteCurrentTaskId);
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
  root.querySelector<HTMLFormElement>("#project-settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onSaveProject(event.currentTarget as HTMLFormElement);
  });

  root.querySelector("#cancel-project-edit")?.addEventListener("click", options.onCancelProjectEdit);
  root.querySelector("#cancel-project-edit-secondary")?.addEventListener("click", options.onCancelProjectEdit);

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

function setTaskSettingsOpen(root: HTMLElement, open: boolean) {
  root.querySelector<HTMLElement>(".task-settings-backdrop")?.toggleAttribute("hidden", !open);
  root.querySelector<HTMLElement>(".task-settings-panel")?.toggleAttribute("hidden", !open);
  root.querySelector<HTMLButtonElement>("[data-open-task-settings]")?.setAttribute("aria-expanded", open ? "true" : "false");
}

function applyTodoQuery(form: HTMLFormElement, options: RenderOptions) {
  const formData = new FormData(form);
  options.onChangeTodoQuery(
    String(formData.get("q") ?? ""),
    sortValue(formData.get("sort")),
    directionValue(formData.get("direction"))
  );
}

function numberFromDataset(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function sortValue(value: FormDataEntryValue | null): TodoSort {
  switch (String(value ?? "smart")) {
    case "due":
    case "created":
    case "title":
    case "priority":
      return String(value) as TodoSort;
    default:
      return "smart";
  }
}

function directionValue(value: FormDataEntryValue | null): TodoSortDirection {
  return String(value ?? "asc") === "desc" ? "desc" : "asc";
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

function authStartHref(apiBaseUrl: string, providerId: string, redirectPath: AppPath): string {
  const params = new URLSearchParams({ redirect: redirectPath });
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/auth/${encodeURIComponent(providerId)}/start?${params.toString()}`;
}
