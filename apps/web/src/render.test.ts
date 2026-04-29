import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderApp } from "./render";
import type { AuthState, FinanceExpensesYear, FinanceIncomeYear, FinanceState, HealthState, TodoProject, TodoState, TodoTask } from "./types";

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
    expect(smartListLabels()).toEqual(["Входящие", "Сегодня", "Просрочено", "Скоро", "Запланировано", "С флагом", "Все", "Готово"]);
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

    const dueDate = root.querySelector<HTMLInputElement>('#task-settings-panel input[name="due_date"]');

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

    const projectSelect = root.querySelector<HTMLSelectElement>('#task-settings-panel select[name="project_id"]');

    expect(projectSelect?.value).toBe("2");
  });

  it("renders a compact project composer row", () => {
    renderApp(root, optionsForTodo());

    const form = root.querySelector<HTMLFormElement>("#project-form");

    expect(form?.classList.contains("project-row")).toBe(true);
    expect(form?.querySelector<HTMLInputElement>('input[name="name"]')?.placeholder).toBe("Новый проект");
    expect(form?.querySelector<HTMLInputElement>('input[name="project_id"]')).toBeNull();
    expect(form?.querySelector<HTMLInputElement>('input[name="start_date"]')).toBeNull();
    expect(form?.querySelector<HTMLInputElement>('input[name="end_date"]')).toBeNull();
    expect(form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent?.trim()).toBe("+");
  });

  it("opens project settings in a drawer", () => {
    const options = optionsForTodo({
      todoState: todoState({
        editingProjectId: 2,
        projects: [project({ id: 2, name: "Work", start_date: "2026-04-01", end_date: "2026-04-30" })]
      })
    });

    renderApp(root, options);

    expect(root.querySelector("#project-form input[name='start_date']")).toBeNull();
    expect(root.querySelector(".settings-backdrop")).not.toBeNull();
    expect(root.querySelector(".project-settings-panel")?.getAttribute("role")).toBe("dialog");
    expect(root.querySelector<HTMLInputElement>("#project-settings-form input[name='project_id']")?.value).toBe("2");
    expect(root.querySelector<HTMLInputElement>("#project-settings-form input[name='name']")?.value).toBe("Work");
    expect(root.querySelector<HTMLInputElement>("#project-settings-form input[name='start_date']")?.value).toBe("2026-04-01");
    expect(root.querySelector<HTMLInputElement>("#project-settings-form input[name='end_date']")?.value).toBe("2026-04-30");

    root.querySelector<HTMLButtonElement>("#cancel-project-edit-secondary")?.click();
    root.querySelector<HTMLFormElement>("#project-settings-form")?.dispatchEvent(new Event("submit", { bubbles: true }));

    expect(options.onCancelProjectEdit).toHaveBeenCalled();
    expect(options.onSaveProject).toHaveBeenCalledWith(root.querySelector("#project-settings-form"));
  });

  it("keeps advanced task fields in a task settings drawer", () => {
    renderApp(root, optionsForTodo());

    const form = root.querySelector<HTMLFormElement>("#task-form");
    const settingsButton = root.querySelector<HTMLButtonElement>("[data-open-task-settings]");
    const panel = root.querySelector<HTMLElement>("#task-settings-panel");

    expect(root.querySelector(".task-details")).toBeNull();
    expect(settingsButton?.closest(".task-form-actions")).not.toBeNull();
    expect(settingsButton?.textContent?.trim()).toBe("⚙");
    expect(settingsButton?.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hasAttribute("hidden")).toBe(true);
    expect(form?.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')).toBeNull();
    expect(form?.querySelector<HTMLSelectElement>('select[name="project_id"]')).toBeNull();
    expect(form?.querySelector<HTMLInputElement>('input[name="due_date"]')).toBeNull();
    expect(panel?.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')?.getAttribute("form")).toBe("task-form");
    expect(panel?.querySelector<HTMLSelectElement>('select[name="project_id"]')?.getAttribute("form")).toBe("task-form");
    expect(panel?.querySelector<HTMLInputElement>('input[name="due_date"]')?.getAttribute("form")).toBe("task-form");
    expect(panel?.querySelector<HTMLInputElement>('input[name="due_time"]')?.getAttribute("form")).toBe("task-form");
    expect(panel?.querySelector<HTMLSelectElement>('select[name="repeat_frequency"]')).not.toBeNull();
    expect(panel?.querySelector<HTMLSelectElement>('select[name="priority"]')).not.toBeNull();
    expect(panel?.querySelector<HTMLInputElement>('input[name="flagged"]')).not.toBeNull();

    settingsButton?.click();

    expect(settingsButton?.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.hasAttribute("hidden")).toBe(false);

    panel!.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')!.value = "Details live here";
    panel!.querySelector<HTMLSelectElement>('select[name="project_id"]')!.value = "";
    panel!.querySelector<HTMLInputElement>('input[name="due_date"]')!.value = "2026-04-28";
    panel!.querySelector<HTMLInputElement>('input[name="due_time"]')!.value = "09:30";
    panel!.querySelector<HTMLSelectElement>('select[name="priority"]')!.value = "high";
    panel!.querySelector<HTMLInputElement>('input[name="flagged"]')!.checked = true;
    const formData = new FormData(form!);

    expect(formData.get("notes")).toBe("Details live here");
    expect(formData.get("project_id")).toBe("");
    expect(formData.get("due_date")).toBe("2026-04-28");
    expect(formData.get("due_time")).toBe("09:30");
    expect(formData.get("priority")).toBe("high");
    expect(formData.get("flagged")).toBe("on");

    root.querySelector<HTMLButtonElement>("[data-close-task-settings]")?.click();

    expect(settingsButton?.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hasAttribute("hidden")).toBe(true);
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

  it("toggles the anton-os sidebar", () => {
    const options = optionsForTodo({ sidebarCollapsed: true });

    renderApp(root, options);

    expect(root.querySelector(".app-shell")?.classList.contains("sidebar-collapsed")).toBe(true);
    expect(root.querySelector("#toggle-sidebar")?.getAttribute("aria-expanded")).toBe("false");

    root.querySelector<HTMLButtonElement>("#toggle-sidebar")?.click();

    expect(options.onToggleSidebar).toHaveBeenCalled();
  });

  it("submits search and sort controls", () => {
    const options = optionsForTodo({
      todoState: todoState({ search: "milk", sort: "priority", direction: "desc" })
    });

    renderApp(root, options);

    expect(root.querySelector<HTMLInputElement>('input[name="q"]')?.value).toBe("milk");
    root.querySelector<HTMLSelectElement>('select[name="sort"]')!.value = "due";
    root.querySelector<HTMLSelectElement>('select[name="direction"]')!.value = "asc";
    root.querySelector<HTMLFormElement>("#todo-query-form")?.dispatchEvent(new Event("submit", { bubbles: true }));

    expect(options.onChangeTodoQuery).toHaveBeenCalledWith("milk", "due", "asc");
  });

  it("hides the new task composer in Completed", () => {
    renderApp(root, optionsForTodo({ todoState: todoState({ scope: { kind: "view", view: "completed" } }) }));

    expect(root.querySelector("#task-form")).toBeNull();
    expect(smartListButton("completed")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps task editing available in Completed", () => {
    const options = optionsForTodo({
      todoState: todoState({
        scope: { kind: "view", view: "completed" },
        editingTaskId: 2,
        tasks: [task({ id: 2, title: "Paid bill", notes: "Already paid", status: "done" })]
      })
    });

    renderApp(root, options);

    const settingsForm = root.querySelector<HTMLFormElement>("#task-settings-form");

    expect(root.querySelector("#task-form")).toBeNull();
    expect(settingsForm).not.toBeNull();
    expect(settingsForm?.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe("Paid bill");
    expect(settingsForm?.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')?.value).toBe("Already paid");
    expect(settingsForm?.querySelector<HTMLButtonElement>('[data-delete-current-task-id="2"]')).not.toBeNull();
    expect(root.querySelector('select[name="status"]')).toBeNull();

    settingsForm?.dispatchEvent(new Event("submit", { bubbles: true }));
    root.querySelector<HTMLButtonElement>("[data-cancel-task-edit]")?.click();

    expect(options.onSaveTask).toHaveBeenCalledWith(settingsForm);
    expect(options.onCancelTaskEdit).toHaveBeenCalled();
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

  it("hides empty project and due metadata on task rows", () => {
    renderApp(
      root,
      optionsForTodo({
        todoState: todoState({
          projects: [project({ id: 2, name: "Work" })],
          tasks: [
            task({ id: 1, title: "Loose task" }),
            task({ id: 2, title: "Scheduled task", project_id: 2, due_date: "2026-04-28" })
          ]
        })
      })
    );

    const looseTask = root.querySelector('[data-edit-task-id="1"]')?.closest(".task-item");
    const scheduledTask = root.querySelector('[data-edit-task-id="2"]')?.closest(".task-item");

    expect(looseTask?.querySelector(".task-meta")).toBeNull();
    expect(looseTask?.textContent).not.toContain("Входящие");
    expect(looseTask?.textContent).not.toContain("Без даты");
    expect(scheduledTask?.querySelector(".task-meta")?.textContent).toContain("Work");
    expect(scheduledTask?.querySelector(".task-meta")?.textContent).toContain("2026-04-28");
  });

  it("opens task settings from a single gear action", () => {
    const options = optionsForTodo({
      todoState: todoState({ tasks: [task({ id: 1, title: "Buy milk" })] })
    });

    renderApp(root, options);

    expect(root.querySelector("[data-delete-task-id]")).toBeNull();
    const settingsButton = root.querySelector<HTMLButtonElement>('[data-edit-task-id="1"]');

    expect(settingsButton?.textContent?.trim()).toBe("⚙");

    settingsButton?.click();

    expect(options.onEditTask).toHaveBeenCalledWith(1);
  });

  it("renders login controls for unauthenticated app access", () => {
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
    expect(root.querySelector(".module-card")).toBeNull();
    expect(root.textContent).toContain("Личный anton415 OS");
    expect(root.querySelector<HTMLInputElement>('input[name="email"]')).not.toBeNull();
    expect(root.querySelector<HTMLAnchorElement>(".oauth-button")?.href).toBe(
      "http://api.test/api/v1/auth/github/start?redirect=%2Ftodo"
    );

    root.querySelector<HTMLFormElement>("#email-login-form")?.dispatchEvent(new Event("submit", { bubbles: true }));

    expect(options.onStartEmailLogin).toHaveBeenCalled();
  });

  it("keeps the platform shell behind the global login guard", () => {
    const options = optionsForTodo({
      currentPath: "/",
      authState: {
        kind: "unauthenticated",
        providers: [{ id: "github", name: "GitHub", kind: "oauth" }]
      }
    });

    renderApp(root, options);

    expect(root.querySelector(".module-card")).toBeNull();
    expect(root.querySelector("h1")?.textContent).toBe("Вход");
    expect(root.querySelector<HTMLAnchorElement>(".oauth-button")?.href).toBe(
      "http://api.test/api/v1/auth/github/start?redirect=%2F"
    );
  });

  it("renders Finance expense months and saves the year from the year row", () => {
    const options = optionsForTodo({
      currentPath: "/finance/expenses",
      financeState: financeState({
        settings: {
          salary_amount: "100000.00",
          bonus_percent: "0.00",
          expense_limit_percents: { restaurants: "1.00" }
        },
        expenses: financeExpensesYear()
      })
    });

    renderApp(root, options);

    expect(root.querySelector(".module-nav a.active")?.textContent).toContain("Финансы");
    expect(root.querySelector(".finance-tabs a.active")?.textContent).toBe("Расходы");
    expect(root.querySelector('[data-route="/finance/settings"]')?.textContent).toBe("Настройки");
    expect(root.textContent).toContain("Итого за год");
    expect(root.textContent).toContain("2 500,00 ₽");
    expect(root.querySelector(".finance-expense-header")?.textContent).not.toContain("Сохранить");
    expect(root.querySelector('[data-finance-expense-month="1"] button')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('[data-finance-expense-month="4"] input[name="restaurants"]')?.value).toBe("1 500,00");
    expect(root.querySelector<HTMLInputElement>('[data-finance-expense-month="4"] input[name="investments"]')?.value).toBe("1 000,00");
    expect(root.querySelector('[data-finance-expense-month="4"] label.limit-over input[name="restaurants"]')).not.toBeNull();
    expect(root.querySelector(".finance-average-row")?.textContent).toContain("Среднее в месяц");
    expect(root.querySelector(".finance-average-row")?.textContent).toContain("125,00");

    root.querySelector<HTMLInputElement>('[data-finance-expense-month="4"] input[name="restaurants"]')!.value = "1 700,00";
    root.querySelector<HTMLButtonElement>("#save-finance-year")?.click();

    expect(options.onSaveFinanceExpenseYear).toHaveBeenCalledWith(
      Array.from(root.querySelectorAll('[data-finance-expense-month]'))
    );
  });

  it("renders Finance income and changes year", () => {
    const options = optionsForTodo({
      currentPath: "/finance/income",
      financeState: financeState({
        year: 2026,
        settings: {
          salary_amount: "210000.00",
          bonus_percent: "15.50",
          expense_limit_percents: {}
        },
        income: financeIncomeYear()
      })
    });

    renderApp(root, options);

    expect(root.querySelector(".finance-tabs a.active")?.textContent).toBe("Доходы");
    expect(root.textContent).toContain("Доход за год");
    expect(root.textContent).not.toContain("Заполнено месяцев");
    expect(root.textContent).toContain("250 000,00 ₽");
    expect(root.querySelector(".finance-year-toolbar")).toBeNull();
    expect(root.querySelector(".finance-income-settings")).toBeNull();
    expect(root.querySelector(".finance-income-header")?.textContent).toContain("Общий доход");
    expect(root.querySelector(".finance-income-header")?.textContent).not.toContain("Сохранить");
    expect(root.querySelector(".finance-income-header")?.textContent).not.toContain("Оклад");
    expect(root.querySelector(".finance-income-header")?.textContent).not.toContain("% премии");
    expect(root.querySelector('[data-finance-income-month="4"] button')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('[data-finance-income-month="4"] label input[name="salary_amount"]')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('[data-finance-income-month="4"] label input[name="bonus_percent"]')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('[data-finance-income-month="4"] input[name="total_amount"]')?.value).toBe("250 000,00");

    root.querySelector<HTMLInputElement>('#finance-year-form input[name="year"]')!.value = "2027";
    root.querySelector<HTMLFormElement>("#finance-year-form")?.dispatchEvent(new Event("submit", { bubbles: true }));
    root.querySelector<HTMLButtonElement>("#save-finance-year")?.click();

    expect(options.onChangeFinanceYear).toHaveBeenCalledWith(2027);
    expect(options.onSaveFinanceIncomeYear).toHaveBeenCalledWith(Array.from(root.querySelectorAll('[data-finance-income-month]')));
    const savedForm = vi.mocked(options.onSaveFinanceIncomeYear).mock.calls[0][0][3];
    const savedFormData = new FormData(savedForm);
    expect(savedFormData.get("salary_amount")).toBe("210000.00");
    expect(savedFormData.get("bonus_percent")).toBe("15.50");
  });

  it("renders Finance settings for income and category limits", () => {
    const options = optionsForTodo({
      currentPath: "/finance/settings",
      financeState: financeState({
        settings: {
          salary_amount: "200000.00",
          bonus_percent: "25.00",
          expense_limit_percents: { restaurants: "10.00" }
        },
        expenses: financeExpensesYear(),
        income: financeIncomeYear()
      })
    });

    renderApp(root, options);

    expect(root.querySelector(".finance-tabs a.active")?.textContent).toBe("Настройки");
    expect(root.querySelector<HTMLInputElement>('[data-finance-income-setting="salary_amount"]')?.value).toBe("200 000,00");
    expect(root.querySelector<HTMLInputElement>('[data-finance-income-setting="bonus_percent"]')?.value).toBe("25,00");
    expect(root.querySelector<HTMLInputElement>('[data-finance-income-calculated="total_amount"]')?.value).toBe("250 000,00");
    expect(root.querySelector<HTMLInputElement>('[data-finance-limit-percent="restaurants"]')?.value).toBe("10,00");
    expect(root.querySelector<HTMLOutputElement>('[data-finance-limit-amount="restaurants"]')?.value).toBe("25 000,00");

    const salaryInput = root.querySelector<HTMLInputElement>('[data-finance-income-setting="salary_amount"]')!;
    salaryInput.value = "300 000,00";
    salaryInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.querySelector<HTMLInputElement>('[data-finance-income-calculated="total_amount"]')?.value).toBe("375 000,00");
    expect(root.querySelector<HTMLOutputElement>('[data-finance-limit-amount="restaurants"]')?.value).toBe("37 500,00");
    expect(options.onChangeFinanceSettings).toHaveBeenCalled();
  });
});

function optionsForTodo(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return {
    apiBaseUrl: "http://api.test",
    currentPath: "/todo",
    sidebarCollapsed: false,
    authState: authState(),
    healthState: { kind: "online", payload: healthPayload() },
    financeState: financeState(),
    todoState: todoState(),
    onNavigate: vi.fn(),
    onStartEmailLogin: vi.fn(),
    onLogout: vi.fn(),
    onRefreshHealth: vi.fn(),
    onToggleSidebar: vi.fn(),
    onRefreshTodo: vi.fn(),
    onRefreshFinance: vi.fn(),
    onChangeFinanceYear: vi.fn(),
    onChangeFinanceSettings: vi.fn(),
    onSaveFinanceExpenseYear: vi.fn(),
    onSaveFinanceIncomeYear: vi.fn(),
    onSaveFinanceExpenseMonth: vi.fn(),
    onSaveFinanceIncomeMonth: vi.fn(),
    onToggleTodoPanel: vi.fn(),
    onChangeTodoQuery: vi.fn(),
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
    sort: "smart",
    direction: "asc",
    search: "",
    ...overrides
  };
}

function financeState(overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    loading: false,
    saving: false,
    year: 2026,
    settings: {
      expense_limit_percents: {}
    },
    ...overrides
  };
}

function financeExpensesYear(overrides: Partial<FinanceExpensesYear> = {}): FinanceExpensesYear {
  const categories = [
    { code: "restaurants" as const, label: "Restaurants", classification: "expense" as const },
    { code: "groceries" as const, label: "Groceries", classification: "expense" as const },
    { code: "personal" as const, label: "Personal", classification: "expense" as const },
    { code: "utilities" as const, label: "Utilities", classification: "expense" as const },
    { code: "transport" as const, label: "Transport", classification: "expense" as const },
    { code: "gifts" as const, label: "Gifts", classification: "expense" as const },
    { code: "investments" as const, label: "Investments", classification: "transfer" as const },
    { code: "entertainment" as const, label: "Entertainment", classification: "expense" as const },
    { code: "education" as const, label: "Education", classification: "expense" as const }
  ];
  const zeroAmounts = {
    restaurants: "0.00",
    groceries: "0.00",
    personal: "0.00",
    utilities: "0.00",
    transport: "0.00",
    gifts: "0.00",
    investments: "0.00",
    entertainment: "0.00",
    education: "0.00"
  };
  return {
    year: 2026,
    currency: "RUB",
    categories,
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      category_amounts:
        index === 3
          ? { ...zeroAmounts, restaurants: "1500.00", investments: "1000.00" }
          : { ...zeroAmounts },
      total_amount: index === 3 ? "2500.00" : "0.00",
      spending_total_amount: index === 3 ? "1500.00" : "0.00"
    })),
    annual_totals_by_category: { ...zeroAmounts, restaurants: "1500.00", investments: "1000.00" },
    annual_total_amount: "2500.00",
    annual_spending_total_amount: "1500.00",
    ...overrides
  };
}

function financeIncomeYear(overrides: Partial<FinanceIncomeYear> = {}): FinanceIncomeYear {
  return {
    year: 2026,
    currency: "RUB",
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      salary_amount: index === 3 ? "200000.00" : "0.00",
      bonus_percent: index === 3 ? "25.00" : "0.00",
      total_amount: index === 3 ? "250000.00" : "0.00"
    })),
    annual_total_amount: "250000.00",
    average_monthly_total_amount: "250000.00",
    ...overrides
  };
}

function project(overrides: Partial<TodoProject> = {}): TodoProject {
  return {
    id: 1,
    name: "Home",
    start_date: null,
    end_date: null,
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
    due_time: null,
    repeat_frequency: "none",
    repeat_interval: 1,
    repeat_until: null,
    flagged: false,
    priority: "none",
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
