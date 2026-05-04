import "./styles.css";

import { AuthApi } from "./authApi";
import { FinanceApi, type FinanceSettingsPayload } from "./financeApi";
import { isLimitAllocationValid, limitAllocationPercent, normalizeDecimalInput } from "./financeFormat";
import { fetchHealth } from "./health";
import { renderApp } from "./render";
import { TodoApi } from "./todoApi";
import type {
  AppPath,
  AuthState,
  FinanceExpenseCategoryAmounts,
  FinanceExpenseCategoryPercents,
  FinanceState,
  HealthState,
  TodoScope,
  TodoState,
  TodoTaskPayload,
  TodoTaskQuery,
  TodoTaskPriority,
  TodoTaskStatus
} from "./types";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8080" : "");
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Корневой элемент приложения не найден");
}

const root = app;
const authApi = new AuthApi(apiBaseUrl);
const todoApi = new TodoApi(apiBaseUrl);
const financeApi = new FinanceApi(apiBaseUrl);
const compactTodoPanelQuery = window.matchMedia("(max-width: 980px)");
let sidebarCollapsed = compactTodoPanelQuery.matches;
let authState: AuthState = { kind: "loading", providers: [] };
let healthState: HealthState = { kind: "loading" };
let currentPath: AppPath = routeFromPath(window.location.pathname);
let financeState: FinanceState = {
  loading: false,
  saving: false,
  year: new Date().getFullYear(),
  settings: {
    expense_limit_percents: {}
  }
};
let todoState: TodoState = {
  loading: false,
  saving: false,
  projects: [],
  tasks: [],
  scope: { kind: "view", view: "inbox" },
  todoPanelCollapsed: compactTodoPanelQuery.matches,
  searchPanelCollapsed: true,
  showArchivedProjects: false,
  sort: "smart",
  direction: "asc",
  search: ""
};

function render() {
  renderApp(root, {
    apiBaseUrl,
    currentPath,
    sidebarCollapsed,
    authState,
    healthState,
    financeState,
    todoState,
    onNavigate: navigate,
    onStartEmailLogin: (form) => {
      void startEmailLogin(form);
    },
    onLogout: () => {
      void logout();
    },
    onRefreshHealth: () => {
      void refreshHealth();
    },
    onToggleSidebar: () => {
      sidebarCollapsed = !sidebarCollapsed;
      render();
    },
    onRefreshTodo: () => {
      void refreshTodo();
    },
    onRefreshFinance: () => {
      void refreshFinance();
    },
    onChangeFinanceYear: (year) => {
      financeState = { ...financeState, year, formError: undefined };
      void refreshFinance();
    },
    onChangeFinanceSettings: (form) => {
      financeState = { ...financeState, settings: financeSettingsPayload(new FormData(form)) };
    },
    onSaveFinanceSettings: (form) => {
      void saveFinanceSettings(form);
    },
    onSaveFinanceExpenseYear: (forms) => {
      void saveFinanceExpenseYear(forms);
    },
    onSaveFinanceIncomeYear: (forms) => {
      void saveFinanceIncomeYear(forms);
    },
    onSaveFinanceExpenseMonth: (month, form) => {
      void saveFinanceExpenseMonth(month, form);
    },
    onSaveFinanceIncomeMonth: (month, form) => {
      void saveFinanceIncomeMonth(month, form);
    },
    onToggleTodoPanel: () => {
      todoState = { ...todoState, todoPanelCollapsed: !todoState.todoPanelCollapsed };
      render();
    },
    onToggleTodoSearchPanel: () => {
      todoState = { ...todoState, searchPanelCollapsed: !todoState.searchPanelCollapsed };
      render();
    },
    onToggleArchivedProjects: () => {
      todoState = { ...todoState, showArchivedProjects: !todoState.showArchivedProjects };
      render();
    },
    onSelectTodoScope: (scope) => {
      todoState = {
        ...todoState,
        scope,
        editingTaskId: undefined,
        todoPanelCollapsed: compactTodoPanelQuery.matches ? true : todoState.todoPanelCollapsed
      };
      void refreshTodo();
    },
    onChangeTodoQuery: (search, sort, direction) => {
      todoState = { ...todoState, search, sort, direction, editingTaskId: undefined };
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
    onArchiveProject: (projectId) => {
      void archiveProject(projectId);
    },
    onRestoreProject: (projectId) => {
      void restoreProject(projectId);
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

async function refreshAuth() {
  const providers = authState.providers;
  authState = { kind: "loading", providers };
  render();

  try {
    const [nextProviders, me] = await Promise.all([authApi.providers(), authApi.me()]);
    if (me.authenticated) {
      authState = { kind: "authenticated", providers: nextProviders, user: me.user };
    } else {
      authState = {
        kind: "unauthenticated",
        providers: nextProviders,
        message: authMessageFromLocation()
      };
    }
  } catch (error) {
    authState = { kind: "unauthenticated", providers, message: errorMessage(error) };
  }
  render();
}

async function refreshTodo() {
  if (currentPath !== "/todo") {
    return;
  }
  if (authState.kind !== "authenticated") {
    todoState = { ...todoState, loading: false, tasks: [], projects: [] };
    render();
    return;
  }

  todoState = { ...todoState, loading: true, error: undefined };
  render();

  try {
    const [projects, tasks] = await Promise.all([
      todoApi.listProjects({ include_archived: true }),
      todoApi.listTasks(taskQuery(todoState))
    ]);
    todoState = { ...todoState, loading: false, projects, tasks, error: undefined };
  } catch (error) {
    if (isUnauthorized(error)) {
      authState = {
        kind: "unauthenticated",
        providers: authState.providers,
        message: "Сессия истекла. Войдите снова."
      };
    }
    todoState = { ...todoState, loading: false, error: errorMessage(error) };
  }
  render();
}

async function refreshFinance() {
  if (!isFinancePath(currentPath)) {
    return;
  }
  if (authState.kind !== "authenticated") {
    financeState = { ...financeState, loading: false, expenses: undefined, income: undefined };
    render();
    return;
  }

  financeState = { ...financeState, loading: true, error: undefined, formError: undefined };
  render();

  try {
    if (currentPath === "/finance/income") {
      const [settings, income] = await Promise.all([
        financeApi.getSettings(),
        financeApi.listIncome(financeState.year)
      ]);
      financeState = { ...financeState, loading: false, settings, income, error: undefined };
    } else if (currentPath === "/finance/settings") {
      const [settings, expenses, income] = await Promise.all([
        financeApi.getSettings(),
        financeApi.listExpenses(financeState.year),
        financeApi.listIncome(financeState.year)
      ]);
      financeState = { ...financeState, loading: false, settings, expenses, income, error: undefined };
    } else {
      const [settings, expenses] = await Promise.all([
        financeApi.getSettings(),
        financeApi.listExpenses(financeState.year)
      ]);
      financeState = { ...financeState, loading: false, settings, expenses, error: undefined };
    }
  } catch (error) {
    if (isUnauthorized(error)) {
      authState = {
        kind: "unauthenticated",
        providers: authState.providers,
        message: "Сессия истекла. Войдите снова."
      };
    }
    financeState = { ...financeState, loading: false, error: errorMessage(error) };
  }
  render();
}

async function startEmailLogin(form: HTMLFormElement) {
  const formData = new FormData(form);
  const email = String(formData.get("email") ?? "");

  try {
    await authApi.startEmail(email);
    authState = {
      kind: "unauthenticated",
      providers: authState.providers,
      emailSent: true
    };
  } catch (error) {
    authState = {
      kind: "unauthenticated",
      providers: authState.providers,
      message: errorMessage(error)
    };
  }
  render();
}

async function logout() {
  await authApi.logout().catch(() => undefined);
  authState = { kind: "unauthenticated", providers: authState.providers };
  todoState = { ...todoState, projects: [], tasks: [], editingTaskId: undefined };
  financeState = { ...financeState, expenses: undefined, income: undefined };
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
  if (!window.confirm("Удалить эту задачу?")) {
    return;
  }

  todoState = { ...todoState, saving: true, error: undefined };
  render();
  try {
    await todoApi.deleteTask(taskId);
    todoState = {
      ...todoState,
      saving: false,
      editingTaskId: todoState.editingTaskId === taskId ? undefined : todoState.editingTaskId
    };
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
    todoState = { ...todoState, saving: false };
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, error: errorMessage(error) };
    render();
  }
}

async function saveProject(form: HTMLFormElement) {
  const formData = new FormData(form);
  const projectId = optionalNumber(formData.get("project_id"));
  const payload = projectPayload(formData);

  todoState = { ...todoState, saving: true, projectFormError: undefined };
  render();
  try {
    if (projectId) {
      await todoApi.updateProject(projectId, payload);
    } else {
      await todoApi.createProject(payload);
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
  if (!window.confirm("Удалить этот проект и все его задачи? Это действие нельзя отменить.")) {
    return;
  }

  todoState = { ...todoState, saving: true, error: undefined };
  render();
  try {
    await todoApi.deleteProject(projectId);
    if (todoState.scope.kind === "project" && todoState.scope.projectId === projectId) {
      todoState = { ...todoState, saving: false, editingProjectId: undefined, scope: { kind: "view", view: "inbox" } };
    } else {
      todoState = {
        ...todoState,
        saving: false,
        editingProjectId: todoState.editingProjectId === projectId ? undefined : todoState.editingProjectId
      };
    }
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, error: errorMessage(error) };
    render();
  }
}

async function archiveProject(projectId: number) {
  todoState = { ...todoState, saving: true, error: undefined };
  render();
  try {
    await todoApi.archiveProject(projectId);
    todoState = {
      ...todoState,
      saving: false,
      editingProjectId: undefined,
      showArchivedProjects: true
    };
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, error: errorMessage(error) };
    render();
  }
}

async function restoreProject(projectId: number) {
  todoState = { ...todoState, saving: true, error: undefined };
  render();
  try {
    await todoApi.restoreProject(projectId);
    todoState = {
      ...todoState,
      saving: false,
      editingProjectId: undefined
    };
    await refreshTodo();
  } catch (error) {
    todoState = { ...todoState, saving: false, error: errorMessage(error) };
    render();
  }
}

async function saveFinanceExpenseMonth(month: number, form: HTMLFormElement) {
  const payload = financeExpensePayload(new FormData(form));

  financeState = { ...financeState, saving: true, formError: undefined };
  render();

  try {
    await financeApi.saveExpenseMonth(financeState.year, month, payload);
    financeState = { ...financeState, saving: false, formError: undefined };
    await refreshFinance();
  } catch (error) {
    financeState = { ...financeState, saving: false, formError: errorMessage(error) };
    render();
  }
}

async function saveFinanceExpenseYear(forms: HTMLFormElement[]) {
  const saves = forms
    .map((form) => ({
      month: optionalNumber(form.dataset.financeExpenseMonth ?? null),
      payload: financeExpensePayload(new FormData(form))
    }))
    .filter((save): save is { month: number; payload: ReturnType<typeof financeExpensePayload> } => Boolean(save.month));

  financeState = { ...financeState, saving: true, formError: undefined };
  render();

  try {
    for (const save of saves) {
      await financeApi.saveExpenseMonth(financeState.year, save.month, save.payload);
    }
    financeState = { ...financeState, saving: false, formError: undefined };
    await refreshFinance();
  } catch (error) {
    financeState = { ...financeState, saving: false, formError: errorMessage(error) };
    render();
  }
}

async function saveFinanceIncomeMonth(month: number, form: HTMLFormElement) {
  const payload = financeIncomePayload(new FormData(form));

  financeState = { ...financeState, saving: true, formError: undefined };
  render();

  try {
    await financeApi.saveIncomeMonth(financeState.year, month, payload);
    financeState = { ...financeState, saving: false, formError: undefined };
    await refreshFinance();
  } catch (error) {
    financeState = { ...financeState, saving: false, formError: errorMessage(error) };
    render();
  }
}

async function saveFinanceIncomeYear(forms: HTMLFormElement[]) {
  const saves = forms
    .map((form) => ({
      month: optionalNumber(form.dataset.financeIncomeMonth ?? null),
      payload: financeIncomePayload(new FormData(form))
    }))
    .filter((save): save is { month: number; payload: ReturnType<typeof financeIncomePayload> } => Boolean(save.month));

  financeState = { ...financeState, saving: true, formError: undefined };
  render();

  try {
    for (const save of saves) {
      await financeApi.saveIncomeMonth(financeState.year, save.month, save.payload);
    }
    financeState = { ...financeState, saving: false, formError: undefined };
    await refreshFinance();
  } catch (error) {
    financeState = { ...financeState, saving: false, formError: errorMessage(error) };
    render();
  }
}

async function saveFinanceSettings(form: HTMLFormElement) {
  const payload = financeSettingsPayload(new FormData(form));
  const allocationPercent = limitAllocationPercent(Object.values(payload.expense_limit_percents));
  if (!isLimitAllocationValid(allocationPercent)) {
    financeState = {
      ...financeState,
      settings: payload,
      formError: "Лимиты должны быть распределены ровно на 100% дохода."
    };
    render();
    return;
  }

  financeState = { ...financeState, settings: payload, saving: true, formError: undefined };
  render();

  try {
    const settings = await financeApi.saveSettings(payload);
    financeState = { ...financeState, settings, saving: false, formError: undefined };
    await refreshFinance();
  } catch (error) {
    financeState = { ...financeState, saving: false, formError: errorMessage(error) };
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
  if (isFinancePath(currentPath)) {
    void refreshFinance();
  }
}

window.addEventListener("popstate", () => {
  currentPath = routeFromPath(window.location.pathname);
  render();
  if (currentPath === "/todo") {
    void refreshTodo();
  }
  if (isFinancePath(currentPath)) {
    void refreshFinance();
  }
});

function routeFromPath(path: string): AppPath {
  if (path === "/todo") {
    return "/todo";
  }
  if (path === "/finance" || path === "/finance/expenses") {
    return "/finance/expenses";
  }
  if (path === "/finance/income") {
    return "/finance/income";
  }
  if (path === "/finance/settings") {
    return "/finance/settings";
  }
  return "/";
}

function isFinancePath(path: AppPath): boolean {
  return path === "/finance/expenses" || path === "/finance/income" || path === "/finance/settings";
}

function taskQuery(state: TodoState): TodoTaskQuery {
  const query: TodoTaskQuery = {
    sort: state.sort,
    direction: state.direction,
    q: state.search.trim() === "" ? undefined : state.search.trim()
  };
  if (state.scope.kind === "view") {
    switch (state.scope.view) {
      case "inbox":
      case "today":
      case "overdue":
      case "upcoming":
      case "scheduled":
      case "flagged":
        query.view = state.scope.view;
        break;
      case "completed":
        query.status = "done";
        break;
      case "all":
        break;
    }
  } else {
    query.project_id = state.scope.projectId;
  }
  return query;
}

function taskPayload(formData: FormData): TodoTaskPayload {
  const projectID = optionalNumber(formData.get("project_id"));
  const dueDate = optionalString(formData.get("due_date"));
  const dueTime = optionalString(formData.get("due_time"));
  const notes = optionalString(formData.get("notes"));
  const taskURL = optionalString(formData.get("url"));
  const repeatFrequency = repeatFrequencyValue(formData.get("repeat_frequency"));
  const repeatInterval = optionalNumber(formData.get("repeat_interval")) ?? 1;
  const repeatUntil = optionalString(formData.get("repeat_until"));

  return {
    project_id: projectID ?? null,
    title: String(formData.get("title") ?? ""),
    notes,
    url: taskURL,
    due_date: dueDate,
    due_time: dueTime,
    repeat_frequency: repeatFrequency,
    repeat_interval: repeatInterval,
    repeat_until: repeatUntil,
    flagged: formData.get("flagged") === "on",
    priority: priorityValue(formData.get("priority"))
  };
}

function projectPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    start_date: optionalString(formData.get("start_date")),
    end_date: optionalString(formData.get("end_date"))
  };
}

function financeExpensePayload(formData: FormData) {
  const categoryAmounts: Partial<FinanceExpenseCategoryAmounts> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "year") {
      continue;
    }
    categoryAmounts[key as keyof FinanceExpenseCategoryAmounts] = normalizedDecimalString(value) ?? "0.00";
  }
  return { category_amounts: categoryAmounts };
}

function financeIncomePayload(formData: FormData) {
  return {
    salary_amount: normalizedDecimalString(formData.get("salary_amount")) ?? "0.00",
    bonus_percent: normalizedDecimalString(formData.get("bonus_percent")) ?? "0.00",
    total_amount: normalizedDecimalString(formData.get("total_amount")) ?? "0.00"
  };
}

function financeSettingsPayload(formData: FormData): FinanceSettingsPayload {
  const expenseLimitPercents: Partial<FinanceExpenseCategoryPercents> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("limit_percent_")) {
      continue;
    }
    const category = key.replace("limit_percent_", "") as keyof FinanceExpenseCategoryPercents;
    const normalizedValue = normalizedDecimalString(value);
    if (normalizedValue !== null) {
      expenseLimitPercents[category] = normalizedValue;
    }
  }

  return {
    salary_amount: normalizedDecimalString(formData.get("salary_amount")) ?? "0.00",
    bonus_percent: normalizedDecimalString(formData.get("bonus_percent")) ?? "0.00",
    expense_limit_percents: expenseLimitPercents
  };
}

function normalizedDecimalString(value: FormDataEntryValue | null): string | null {
  const text = optionalString(value);
  if (!text) {
    return null;
  }
  return normalizeDecimalInput(text) ?? text;
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

function repeatFrequencyValue(value: FormDataEntryValue | null): TodoTaskPayload["repeat_frequency"] {
  switch (String(value ?? "none")) {
    case "daily":
    case "weekly":
    case "monthly":
    case "yearly":
      return String(value) as TodoTaskPayload["repeat_frequency"];
    default:
      return "none";
  }
}

function priorityValue(value: FormDataEntryValue | null): TodoTaskPriority {
  switch (String(value ?? "none")) {
    case "low":
    case "medium":
    case "high":
      return String(value) as TodoTaskPriority;
    default:
      return "none";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "unauthorized";
}

function authMessageFromLocation(): string | undefined {
  const code = new URLSearchParams(window.location.search).get("auth_error");
  switch (code) {
    case "email_not_allowed":
      return "Этот email не разрешен.";
    case "email_verification_required":
      return "Подтвердите email с помощью ссылки для входа.";
    case "provider_unavailable":
      return "Этот способ входа не настроен.";
    case "auth_failed":
      return "Не удалось войти.";
    default:
      return undefined;
  }
}

render();
void refreshHealth();
void refreshAuth().then(() => {
  if (currentPath === "/todo") {
    void refreshTodo();
  }
  if (isFinancePath(currentPath)) {
    void refreshFinance();
  }
});
if (currentPath === "/todo") {
  render();
}
if (isFinancePath(currentPath)) {
  render();
}
