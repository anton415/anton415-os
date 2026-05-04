import { productModules } from "./modules";
import {
  calculateIncomeAmount,
  calculatePercentAmount,
  currencyLabel,
  divideDecimalAmount,
  expenseLimitStatus,
  formatRussianDecimalInput,
  formatRussianMoneyAmount,
  formatRussianMoneyInput,
  isLimitAllocationValid,
  limitAllocationPercent,
  multiplyDecimalAmount,
  normalizeDecimalInputOrRaw,
  targetProgressStatus
} from "./financeFormat";
import type {
  AppPath,
  AuthState,
  FinanceExpenseCategory,
  FinanceExpenseCategoryAmounts,
  FinanceExpenseMonth,
  FinanceExpensesYear,
  FinanceIncomeMonth,
  FinanceState,
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
};

type RenderOptions = {
  apiBaseUrl: string;
  currentPath: AppPath;
  sidebarCollapsed: boolean;
  authState: AuthState;
  healthState: HealthState;
  financeState: FinanceState;
  todoState: TodoState;
  onNavigate: (path: string) => void;
  onStartEmailLogin: (form: HTMLFormElement) => void;
  onLogout: () => void;
  onRefreshHealth: () => void;
  onToggleSidebar: () => void;
  onRefreshTodo: () => void;
  onRefreshFinance: () => void;
  onChangeFinanceYear: (year: number) => void;
  onChangeFinanceSettings: (form: HTMLFormElement) => void;
  onSaveFinanceSettings: (form: HTMLFormElement) => void;
  onSaveFinanceExpenseYear: (forms: HTMLFormElement[]) => void;
  onSaveFinanceIncomeYear: (forms: HTMLFormElement[]) => void;
  onSaveFinanceExpenseMonth: (month: number, form: HTMLFormElement) => void;
  onSaveFinanceIncomeMonth: (month: number, form: HTMLFormElement) => void;
  onToggleTodoPanel: () => void;
  onToggleTodoSearchPanel: () => void;
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
        : isFinancePath(options.currentPath)
          ? renderFinancePage(options)
        : renderHomePage(options)
      : renderLoginPage(options);

  root.innerHTML = `
    <div class="app-shell ${options.sidebarCollapsed ? "sidebar-collapsed" : ""}">
      <aside class="sidebar" id="anton415-hub-sidebar" aria-label="Основная навигация">
        <div class="sidebar-head">
          <a class="brand" href="/" data-route="/">
            <span class="brand-mark" aria-hidden="true">A</span>
            <span>
              <strong>anton415 Hub</strong>
              <span>модульный монолит</span>
            </span>
          </a>
          <button
            class="icon-button small sidebar-collapse"
            type="button"
            data-toggle-sidebar
            aria-controls="anton415-hub-sidebar"
            aria-expanded="true"
            aria-label="Скрыть панель anton415 Hub"
            title="Скрыть панель anton415 Hub"
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
  if (options.authState.kind === "authenticated" && isFinancePath(options.currentPath)) {
    bindFinanceEvents(root, options);
  }
}

function renderHomePage(options: RenderOptions): string {
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Шаг 3 Todo v1</p>
        <h1>Платформенная оболочка</h1>
      </div>
      <div class="topbar-actions">
        ${renderSidebarToggle(options)}
        ${renderAuthBadge(options.authState)}
        ${renderHealthBadge(options.healthState)}
      </div>
    </header>

    <section class="status-panel" aria-live="polite">
      <div>
        <p class="section-label">Связь с backend</p>
        ${renderHealthDetails(options.healthState, options.apiBaseUrl)}
      </div>
      <button class="icon-button" type="button" id="refresh-health" aria-label="Обновить статус backend" title="Обновить статус backend">
        &#8635;
      </button>
    </section>

    <section class="module-grid" aria-label="Продуктовые модули">
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
        <p class="eyebrow">Задачи v1</p>
        <h1>Задачи</h1>
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
          aria-label="${state.todoPanelCollapsed ? "Показать панель задач" : "Скрыть панель задач"}"
          title="${state.todoPanelCollapsed ? "Показать панель задач" : "Скрыть панель задач"}"
        >
          <span aria-hidden="true">&#9776;</span>
          <span>Списки</span>
        </button>
        <span class="auth-chip">${escapeHTML(options.authState.user.email)}</span>
        <button class="icon-button" type="button" id="logout" aria-label="Выйти" title="Выйти">
          &#8617;
        </button>
        ${renderHealthBadge(options.healthState)}
        <button class="icon-button" type="button" id="refresh-todo" aria-label="Обновить задачи" title="Обновить задачи">
          &#8635;
        </button>
      </div>
    </header>

    ${state.error ? `<div class="inline-error" role="alert">${escapeHTML(state.error)}</div>` : ""}

    <section class="todo-layout ${state.todoPanelCollapsed ? "todo-panel-collapsed" : ""}">
      <aside class="todo-panel ${state.todoPanelCollapsed ? "collapsed" : ""}" id="todo-panel">
        <div class="todo-panel-head">
          <h2>Списки</h2>
          <button
            class="icon-button small"
            type="button"
            data-toggle-todo-panel
            aria-controls="todo-panel"
            aria-expanded="true"
            aria-label="Скрыть панель задач"
            title="Скрыть панель задач"
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

function renderFinancePage(options: RenderOptions): string {
  const state = options.financeState;
  if (options.authState.kind !== "authenticated") {
    return renderLoginPage(options);
  }

  const section =
    options.currentPath === "/finance/income"
      ? renderFinanceIncome(state)
      : options.currentPath === "/finance/settings"
        ? renderFinanceSettings(state)
        : renderFinanceExpenses(state);

  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Финансы v1</p>
        <h1>Финансы</h1>
      </div>
      <div class="topbar-actions">
        ${renderSidebarToggle(options)}
        <span class="auth-chip">${escapeHTML(options.authState.user.email)}</span>
        <button class="icon-button" type="button" id="logout" aria-label="Выйти" title="Выйти">
          &#8617;
        </button>
        ${renderHealthBadge(options.healthState)}
        <button class="icon-button" type="button" id="refresh-finance" aria-label="Обновить финансы" title="Обновить финансы">
          &#8635;
        </button>
      </div>
    </header>

    ${state.error ? `<div class="inline-error" role="alert">${escapeHTML(state.error)}</div>` : ""}
    ${state.formError ? `<div class="inline-error" role="alert">${escapeHTML(state.formError)}</div>` : ""}

    <nav class="finance-tabs" aria-label="Разделы финансов">
      <a href="/finance/expenses" data-route="/finance/expenses" class="${options.currentPath === "/finance/expenses" ? "active" : ""}">Расходы</a>
      <a href="/finance/income" data-route="/finance/income" class="${options.currentPath === "/finance/income" ? "active" : ""}">Доходы</a>
      <a href="/finance/settings" data-route="/finance/settings" class="${options.currentPath === "/finance/settings" ? "active" : ""}">Настройки</a>
    </nav>

    ${section}
  `;
}

function renderFinanceYearRow(state: FinanceState, saveLabel?: string): string {
  return `
    <form class="finance-year-row" id="finance-year-form">
      <span class="finance-year-label">Год</span>
      <label class="compact-field">
        <span class="visually-hidden">Год</span>
        <input name="year" type="number" min="1" max="9999" step="1" value="${state.year}" required>
      </label>
      <button class="icon-button" type="submit" aria-label="Загрузить финансовый год" title="Загрузить финансовый год">&#8981;</button>
      ${
        saveLabel
          ? `<button class="finance-year-save" id="save-finance-year" type="button" ${state.saving ? "disabled" : ""} aria-label="${escapeAttr(saveLabel)}" title="${escapeAttr(saveLabel)}">&#10003; ${escapeHTML(saveLabel)}</button>`
          : ""
      }
    </form>
  `;
}

function renderFinanceExpenses(state: FinanceState): string {
  const expenses = state.expenses;
  if (state.loading && !expenses) {
    return `<section class="finance-table-shell finance-expense-shell">${renderFinanceYearRow(state, "Сохранить")}<p class="empty-state">Загружаю расходы...</p></section>`;
  }
  if (!expenses) {
    return `<section class="finance-table-shell finance-expense-shell">${renderFinanceYearRow(state, "Сохранить")}<p class="empty-state">Данные о расходах не загружены.</p></section>`;
  }
  const monthlyIncomeAmount = calculateIncomeAmount(financeSettingsSalaryAmount(state), financeSettingsBonusPercent(state));
  const categoryLimitAmounts = financeExpenseCategoryLimitAmounts(expenses.categories, state, monthlyIncomeAmount);

  return `
    <section class="finance-summary-grid" aria-label="Итоги расходов">
      ${renderFinanceMetric("Итого за год", expenses.annual_total_amount, expenses.currency)}
      ${renderFinanceMetric("Расходы без переводов", expenses.annual_spending_total_amount, expenses.currency)}
      ${renderFinanceMetric("Переводы в инвестиции", expenses.annual_totals_by_category.investments, expenses.currency)}
    </section>

    <section class="finance-table-shell finance-expense-shell" aria-label="Расходы по месяцам">
      ${renderFinanceYearRow(state, "Сохранить")}
      <div class="finance-expense-header">
        <span>Месяц</span>
        ${expenses.categories.map((category) => `<span>${escapeHTML(financeCategoryLabel(category))}</span>`).join("")}
        <span>Расходы</span>
        <span>Итого</span>
      </div>
      ${renderFinanceExpenseLimitRow(expenses.categories, categoryLimitAmounts)}
      ${expenses.months.map((month) => renderFinanceExpenseMonth(month, expenses.categories, categoryLimitAmounts)).join("")}
      ${renderFinanceExpenseAverageRow(expenses)}
      <div class="finance-expense-row finance-total-row">
        <span>Год</span>
        ${expenses.categories
          .map((category) => `<span>${escapeHTML(formatRussianMoneyAmount(expenses.annual_totals_by_category[category.code]))}</span>`)
          .join("")}
        <span>${escapeHTML(formatRussianMoneyAmount(expenses.annual_spending_total_amount))}</span>
        <span>${escapeHTML(formatRussianMoneyAmount(expenses.annual_total_amount))}</span>
      </div>
    </section>
  `;
}

function renderFinanceExpenseLimitRow(
  categories: FinanceExpenseCategory[],
  categoryLimitAmounts: Partial<FinanceExpenseCategoryAmounts>
): string {
  return `
    <div class="finance-expense-row finance-limit-amount-row">
      <span>Лимит</span>
      ${categories
        .map((category) => `<span>${escapeHTML(categoryLimitAmounts[category.code] ? formatRussianMoneyAmount(categoryLimitAmounts[category.code] ?? "0.00") : "")}</span>`)
        .join("")}
      <span></span>
      <span></span>
    </div>
  `;
}

function renderFinanceExpenseMonth(
  month: FinanceExpenseMonth,
  categories: FinanceExpenseCategory[],
  categoryLimitAmounts: Partial<FinanceExpenseCategoryAmounts>
): string {
  return `
    <form class="finance-expense-row" data-finance-expense-month="${month.month}">
      <span class="finance-month-label">${escapeHTML(monthLabel(month.month))}</span>
      ${categories.map((category) => renderFinanceCategoryInput(month, category, categoryLimitAmounts[category.code])).join("")}
      <span class="finance-money-total">${escapeHTML(formatRussianMoneyAmount(month.spending_total_amount))}</span>
      <span class="finance-money-total">${escapeHTML(formatRussianMoneyAmount(month.total_amount))}</span>
    </form>
  `;
}

function renderFinanceCategoryInput(month: FinanceExpenseMonth, category: FinanceExpenseCategory, limitAmount?: string): string {
  const transferClass = category.classification === "transfer" ? " transfer" : "";
  const limitStatus = limitAmount ? financeCategoryLimitStatus(category, month.category_amounts[category.code], limitAmount) : "none";
  const limitClass = limitStatus === "none" ? "" : ` limit-${limitStatus}`;
  const label = financeCategoryLabel(category);
  return `
    <label class="finance-money-field${transferClass}${limitClass}">
      <span class="visually-hidden">${escapeHTML(label)} ${escapeHTML(monthLabel(month.month))}</span>
      <input
        name="${category.code}"
        data-finance-expense-limit="${escapeAttr(limitAmount ?? "0.00")}"
        data-finance-limit-kind="${escapeAttr(category.limit_kind ?? "limit")}"
        inputmode="decimal"
        pattern="[0-9 ]+([,.][0-9]{1,2})?"
        value="${escapeAttr(formatRussianMoneyInput(month.category_amounts[category.code]))}"
        aria-label="${escapeAttr(`${label} ${monthLabel(month.month)}`)}"
      >
    </label>
  `;
}

function financeCategoryLimitStatus(category: FinanceExpenseCategory, amount: string, limitAmount: string) {
  return category.limit_kind === "investment_goal"
    ? targetProgressStatus(amount, limitAmount)
    : expenseLimitStatus(amount, limitAmount);
}

function renderFinanceExpenseAverageRow(expenses: FinanceExpensesYear): string {
  return `
    <div class="finance-expense-row finance-total-row finance-average-row">
      <span>Среднее в месяц</span>
      ${expenses.categories
        .map((category) => `<span>${escapeHTML(formatRussianMoneyAmount(divideDecimalAmount(expenses.annual_totals_by_category[category.code], 12)))}</span>`)
        .join("")}
      <span>${escapeHTML(formatRussianMoneyAmount(divideDecimalAmount(expenses.annual_spending_total_amount, 12)))}</span>
      <span>${escapeHTML(formatRussianMoneyAmount(divideDecimalAmount(expenses.annual_total_amount, 12)))}</span>
    </div>
  `;
}

function financeExpenseCategoryLimitAmounts(
  categories: FinanceExpenseCategory[],
  state: FinanceState,
  monthlyIncomeAmount: string
): Partial<FinanceExpenseCategoryAmounts> {
  const limits: Partial<FinanceExpenseCategoryAmounts> = {};
  for (const category of categories) {
    const percent = state.settings.expense_limit_percents[category.code];
    if (!percent) {
      continue;
    }

    const annualLimitAmount = calculatePercentAmount(financeLimitBaseAmount(category, monthlyIncomeAmount), percent);
    const limitAmount = category.limit_period === "annual" ? divideDecimalAmount(annualLimitAmount, 12) : annualLimitAmount;
    if (expenseLimitStatus("1.00", limitAmount) !== "none") {
      limits[category.code] = limitAmount;
    }
  }

  return limits;
}

function renderFinanceIncome(state: FinanceState): string {
  const income = state.income;
  if (state.loading && !income) {
    return `<section class="finance-table-shell finance-income-shell">${renderFinanceYearRow(state, "Сохранить")}<p class="empty-state">Загружаю доходы...</p></section>`;
  }
  if (!income) {
    return `<section class="finance-table-shell finance-income-shell">${renderFinanceYearRow(state, "Сохранить")}<p class="empty-state">Данные о доходах не загружены.</p></section>`;
  }
  const salaryAmount = financeSettingsSalaryAmount(state);
  const bonusPercent = financeSettingsBonusPercent(state);
  const expectedIncomeAmount = calculateIncomeAmount(salaryAmount, bonusPercent);

  return `
    <section class="finance-summary-grid finance-income-summary" aria-label="Итоги доходов">
      ${renderFinanceMetric("Доход за год", income.annual_total_amount, income.currency)}
      ${renderFinanceMetric("Средний доход в месяц", income.average_monthly_total_amount, income.currency)}
    </section>

    <section class="finance-table-shell finance-income-shell" aria-label="Доходы по месяцам">
      ${renderFinanceYearRow(state, "Сохранить")}
      <div class="finance-income-header">
        <span>Месяц</span>
        <span>Общий доход</span>
      </div>
      ${income.months
        .map(
          (month) => `
            <form class="finance-income-row" data-finance-income-month="${month.month}">
              <span class="finance-month-label">${escapeHTML(monthLabel(month.month))}</span>
              <input type="hidden" name="salary_amount" value="${escapeAttr(salaryAmount)}">
              <input type="hidden" name="bonus_percent" value="${escapeAttr(bonusPercent)}">
              <label class="finance-money-field${financeIncomeLimitClass(month.total_amount, expectedIncomeAmount)}">
                <span class="visually-hidden">Общий доход ${escapeHTML(monthLabel(month.month))}</span>
                <input
                  name="total_amount"
                  data-finance-income-target="${escapeAttr(expectedIncomeAmount)}"
                  inputmode="decimal"
                  pattern="[0-9 ]+([,.][0-9]{1,2})?"
                  value="${escapeAttr(formatRussianMoneyInput(month.total_amount))}"
                  aria-label="Общий доход ${escapeAttr(monthLabel(month.month))}"
                >
              </label>
            </form>
          `
        )
        .join("")}
    </section>
  `;
}

function financeIncomeLimitClass(amount: string, targetAmount: string): string {
  const status = targetProgressStatus(amount, targetAmount);
  return status === "none" ? "" : ` limit-${status}`;
}

function renderFinanceSettings(state: FinanceState): string {
  const expenses = state.expenses;
  const income = state.income;
  if (state.loading && (!expenses || !income)) {
    return `<section class="finance-table-shell finance-settings-shell">${renderFinanceYearRow(state)}<p class="empty-state">Загружаю настройки...</p></section>`;
  }
  if (!expenses || !income) {
    return `<section class="finance-table-shell finance-settings-shell">${renderFinanceYearRow(state)}<p class="empty-state">Данные для настроек не загружены.</p></section>`;
  }

  const salaryAmount = financeSettingsSalaryAmount(state);
  const bonusPercent = financeSettingsBonusPercent(state);
  const calculatedIncomeAmount = calculateIncomeAmount(salaryAmount, bonusPercent);

  return `
    <section class="finance-table-shell finance-settings-shell" aria-label="Настройки финансов">
      ${renderFinanceYearRow(state)}
      <form class="finance-settings-form" id="finance-settings-form">
        ${renderFinanceIncomeSettings(salaryAmount, bonusPercent, calculatedIncomeAmount, state.saving)}
        ${renderFinanceLimitSettings(expenses.categories, state, calculatedIncomeAmount)}
      </form>
    </section>
  `;
}

function renderFinanceIncomeSettings(salaryAmount: string, bonusPercent: string, calculatedIncomeAmount: string, saving: boolean): string {
  return `
    <section class="finance-income-settings" aria-label="Оклад, премия и доход">
      <label class="compact-field">
        <span>Оклад</span>
        <input
          data-finance-income-setting="salary_amount"
          name="salary_amount"
          inputmode="decimal"
          pattern="[0-9 ]+([,.][0-9]{1,2})?"
          value="${escapeAttr(formatRussianMoneyInput(salaryAmount))}"
          aria-label="Оклад"
        >
      </label>
      <label class="compact-field">
        <span>% премии</span>
        <input
          data-finance-income-setting="bonus_percent"
          name="bonus_percent"
          inputmode="decimal"
          pattern="[0-9 ]+([,.][0-9]{1,2})?"
          value="${escapeAttr(formatRussianDecimalInput(bonusPercent))}"
          aria-label="Процент премии"
        >
      </label>
      <label class="compact-field finance-calculated-field">
        <span>Доход</span>
        <input
          data-finance-income-calculated="total_amount"
          value="${escapeAttr(formatRussianMoneyAmount(calculatedIncomeAmount))}"
          aria-label="Доход"
          readonly
        >
      </label>
      <button
        class="finance-year-save"
        type="submit"
        data-finance-settings-save
        data-finance-saving="${saving ? "true" : "false"}"
        ${saving ? "disabled" : ""}
        aria-label="Сохранить настройки"
        title="Сохранить настройки"
      >
        &#10003; Сохранить
      </button>
    </section>
  `;
}

function renderFinanceLimitSettings(
  categories: FinanceExpenseCategory[],
  state: FinanceState,
  calculatedIncomeAmount: string
): string {
  const allocationPercent = limitAllocationPercent(Object.values(state.settings.expense_limit_percents));
  const allocationValid = isLimitAllocationValid(allocationPercent);
  return `
    <section class="finance-limit-settings" aria-label="Лимиты расходов">
      <div class="finance-limit-allocation ${allocationValid ? "allocation-ok" : "allocation-error"}" data-finance-limit-allocation>
        Распределено ${escapeHTML(formatRussianDecimalInput(allocationPercent) || "0")} из 100%
      </div>
      ${renderFinanceLimitGroup("Лимиты в месяц", categories.filter((category) => category.limit_period === "monthly"), state, calculatedIncomeAmount)}
      ${renderFinanceLimitGroup(
        "Лимиты в год",
        categories.filter((category) => category.limit_period === "annual" && category.limit_kind !== "investment_goal"),
        state,
        calculatedIncomeAmount
      )}
      ${renderFinanceLimitGroup(
        "Цель инвестиций",
        categories.filter((category) => category.limit_kind === "investment_goal"),
        state,
        calculatedIncomeAmount
      )}
    </section>
  `;
}

function renderFinanceLimitGroup(
  title: string,
  categories: FinanceExpenseCategory[],
  state: FinanceState,
  calculatedIncomeAmount: string
): string {
  if (categories.length === 0) {
    return "";
  }
  return `
    <div class="finance-limit-group" data-finance-limit-group>
      <div class="finance-limit-group-title">${escapeHTML(title)}</div>
      <div class="finance-limit-header">
        <span>Категория</span>
        <span>% дохода</span>
        <span>Сумма</span>
      </div>
      ${categories.map((category) => renderFinanceLimitRow(category, state, calculatedIncomeAmount)).join("")}
    </div>
  `;
}

function renderFinanceLimitRow(category: FinanceExpenseCategory, state: FinanceState, calculatedIncomeAmount: string): string {
  const percent = state.settings.expense_limit_percents[category.code] ?? "";
  const limitAmount = percent ? calculatePercentAmount(financeLimitBaseAmount(category, calculatedIncomeAmount), percent) : "";
  const label = financeLimitValueLabel(category);
  return `
    <label class="finance-limit-row">
      <span class="finance-month-label">${escapeHTML(financeCategoryLabel(category))}</span>
      <input
        data-finance-limit-percent="${category.code}"
        data-finance-limit-period="${escapeAttr(category.limit_period ?? "monthly")}"
        data-finance-limit-kind="${escapeAttr(category.limit_kind ?? "limit")}"
        name="limit_percent_${category.code}"
        inputmode="decimal"
        pattern="[0-9 ]+([,.][0-9]{1,2})?"
        value="${escapeAttr(formatRussianDecimalInput(percent))}"
        aria-label="${escapeAttr(label)} ${escapeAttr(financeCategoryLabel(category))}, процент дохода"
      >
      <output data-finance-limit-amount="${category.code}">${escapeHTML(limitAmount ? formatRussianMoneyAmount(limitAmount) : "")}</output>
    </label>
  `;
}

function financeSettingsSalaryAmount(state: FinanceState): string {
  return state.settings.salary_amount ?? (state.income ? financeIncomeSettingValue(state.income.months, "salary_amount") : "0.00");
}

function financeSettingsBonusPercent(state: FinanceState): string {
  return state.settings.bonus_percent ?? (state.income ? financeIncomeSettingValue(state.income.months, "bonus_percent") : "0.00");
}

function financeLimitBaseAmount(category: FinanceExpenseCategory, monthlyIncomeAmount: string): string {
  return category.limit_period === "annual" ? multiplyDecimalAmount(monthlyIncomeAmount, 12) : monthlyIncomeAmount;
}

function financeLimitValueLabel(category: FinanceExpenseCategory): string {
  return category.code === "investments" ? "Цель" : "Лимит";
}

function financeIncomeSettingValue(months: FinanceIncomeMonth[], key: "salary_amount" | "bonus_percent"): string {
  const nonZeroMonth = months.find((month) => month[key] !== "0.00");
  return nonZeroMonth?.[key] ?? months[0]?.[key] ?? "0.00";
}

function renderFinanceMetric(label: string, value: string, currency: string): string {
  return `
    <article class="finance-metric">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(formatRussianMoneyAmount(value))}${currency ? ` ${escapeHTML(currencyLabel(currency))}` : ""}</strong>
    </article>
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
        <p class="eyebrow">Личный anton415 Hub</p>
        <h1>Вход</h1>
      </div>
      <div class="topbar-actions">
        ${renderSidebarToggle(options)}
        ${renderHealthBadge(options.healthState)}
      </div>
    </header>

    <section class="login-panel" aria-label="Вход">
      ${
        state.kind === "loading"
          ? `<p class="empty-state">Проверяю сессию...</p>`
          : `
            ${message ? `<div class="inline-error" role="alert">${escapeHTML(message)}</div>` : ""}
            ${
              emailSent
                ? `<p class="success-state">Ссылка для входа отправлена.</p>`
                : ""
            }
            ${
              emailEnabled
                ? `
                  <form class="login-form" id="email-login-form">
                    <label>
                      <span>Эл. почта</span>
                      <input name="email" type="email" autocomplete="email" required>
                    </label>
                    <button type="submit">Отправить ссылку</button>
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
      aria-controls="anton415-hub-sidebar"
      aria-expanded="${options.sidebarCollapsed ? "false" : "true"}"
      aria-label="${options.sidebarCollapsed ? "Показать панель anton415 Hub" : "Скрыть панель anton415 Hub"}"
      title="${options.sidebarCollapsed ? "Показать панель anton415 Hub" : "Скрыть панель anton415 Hub"}"
    >
      <span aria-hidden="true">&#9776;</span>
      <span>anton415 Hub</span>
    </button>
  `;
}

function renderModuleNav(currentPath: AppPath): string {
  return productModules
    .map(
      (module) => `
        <a href="${module.path}" data-route="${module.path}" class="${isModuleActive(currentPath, module.path) ? "active" : ""}">
          <span class="nav-swatch ${moduleAccentClass(module.path)}"></span>
          ${escapeHTML(module.name)}
        </a>
      `
    )
    .join("");
}

function isModuleActive(currentPath: AppPath, modulePath: string): boolean {
  if (modulePath === "/finance") {
    return isFinancePath(currentPath);
  }
  return currentPath === modulePath;
}

function isFinancePath(path: AppPath): boolean {
  return path === "/finance/expenses" || path === "/finance/income" || path === "/finance/settings";
}

function renderModuleCards(): string {
  return productModules
    .map(
      (module) => `
        <article class="module-card">
          <div class="module-card-header">
            <span class="module-swatch ${moduleAccentClass(module.path)}"></span>
            <h2>${escapeHTML(module.name)}</h2>
          </div>
          <p>${escapeHTML(module.summary)}</p>
          <span class="module-state">${escapeHTML(module.state ?? "не реализовано")}</span>
        </article>
      `
    )
    .join("");
}

const smartLists: SmartList[] = [
  { view: "inbox", label: "Входящие" },
  { view: "today", label: "Сегодня" },
  { view: "overdue", label: "Просрочено" },
  { view: "upcoming", label: "Скоро" },
  { view: "scheduled", label: "Запланировано" },
  { view: "flagged", label: "С флагом" },
  { view: "all", label: "Все" },
  { view: "completed", label: "Готово" }
];

function renderSmartLists(state: TodoState): string {
  return `
    <section class="smart-list-panel" aria-label="Умные списки">
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
      <span class="smart-list-icon smart-list-icon-${list.view}" aria-hidden="true"></span>
      <span>${escapeHTML(list.label)}</span>
    </button>
  `;
}

function moduleAccentClass(modulePath: string): string {
  if (modulePath === "/todo") {
    return "module-accent-todo";
  }
  if (modulePath === "/finance") {
    return "module-accent-finance";
  }
  if (modulePath === "/investments") {
    return "module-accent-investments";
  }
  if (modulePath === "/fire") {
    return "module-accent-fire";
  }
  return "module-accent-default";
}

function renderProjectForm(state: TodoState): string {
  return `
    <form class="project-row project-form" id="project-form">
      <label class="project-name-field">
        <span class="visually-hidden">Название</span>
        <input name="name" type="text" value="" placeholder="Новый проект" autocomplete="off" required>
      </label>
      <span class="project-form-actions">
        <button class="icon-button small project-save-button" type="submit" ${state.saving ? "disabled" : ""} aria-label="Создать проект" title="Создать проект">
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
            <button class="icon-button small" type="button" data-edit-project-id="${project.id}" aria-label="Настройки проекта ${escapeAttr(project.name)}" title="Настройки проекта">&#9881;</button>
            <button class="icon-button small danger" type="button" data-delete-project-id="${project.id}" aria-label="Удалить ${escapeAttr(project.name)}" title="Удалить проект">&#8722;</button>
          </span>
        </li>
      `;
    })
    .join("");

  return `
    <section class="project-list" aria-label="Проекты">
      <div class="panel-header">
        <h2>Проекты</h2>
      </div>
      ${
        state.projects.length === 0
          ? `<p class="empty-state">Проектов пока нет.</p>`
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
          <p class="section-label">Проект</p>
          <h2 id="project-settings-title">Настройки</h2>
        </div>
        <button class="icon-button small" type="button" id="cancel-project-edit" aria-label="Закрыть настройки проекта" title="Закрыть настройки проекта">&#215;</button>
      </div>
      <form class="project-settings-form" id="project-settings-form">
        <input type="hidden" name="project_id" value="${project.id}">
        <label>
          <span>Название</span>
          <input name="name" type="text" value="${escapeAttr(project.name)}" autocomplete="off" required>
        </label>
        <div class="settings-form-grid">
          <label>
            <span>Начало</span>
            <input name="start_date" type="date" value="${escapeAttr(project.start_date ?? "")}">
          </label>
          <label>
            <span>Конец</span>
            <input name="end_date" type="date" value="${escapeAttr(project.end_date ?? "")}">
          </label>
        </div>
        ${state.projectFormError ? `<p class="form-error">${escapeHTML(state.projectFormError)}</p>` : ""}
        <div class="settings-form-actions">
          <button class="secondary-button" type="button" id="cancel-project-edit-secondary">Отмена</button>
          <button class="primary-button" type="submit" ${state.saving ? "disabled" : ""}>Сохранить</button>
        </div>
      </form>
    </aside>
  `;
}

function projectPeriod(project: TodoProject): string {
  if (!project.start_date && !project.end_date) {
    return "";
  }
  const start = project.start_date ?? "Любая";
  const end = project.end_date ?? "Открыто";
  return `<small>${escapeHTML(start)} - ${escapeHTML(end)}</small>`;
}

function renderTodoToolbar(state: TodoState): string {
  const searchPanelCollapsed = state.searchPanelCollapsed ?? true;
  const searchSummary =
    searchPanelCollapsed && state.search.trim() !== ""
      ? `<span class="todo-search-summary">Поиск: ${escapeHTML(state.search.trim())}</span>`
      : "";

  return `
    <section class="todo-query-panel ${searchPanelCollapsed ? "collapsed" : ""}" aria-label="Поиск задач">
      <div class="todo-query-panel-head">
        <button
          class="secondary-button todo-search-toggle"
          type="button"
          data-toggle-todo-search-panel
          aria-controls="todo-query-form"
          aria-expanded="${searchPanelCollapsed ? "false" : "true"}"
        >
          ${searchPanelCollapsed ? "Поиск" : "Скрыть поиск"}
        </button>
        ${searchSummary}
      </div>
      <form class="todo-toolbar" id="todo-query-form" role="search" ${searchPanelCollapsed ? "hidden" : ""}>
        <label class="compact-field todo-search-field">
          <span class="visually-hidden">Поиск задач</span>
          <input name="q" type="search" value="${escapeAttr(state.search)}" placeholder="Поиск">
        </label>
        <div class="todo-sort-controls">
          <label class="compact-field">
            <span class="visually-hidden">Сортировка задач</span>
            <select name="sort">
              ${renderSortOption("smart", "Умная", state.sort)}
              ${renderSortOption("due", "Срок", state.sort)}
              ${renderSortOption("created", "Создано", state.sort)}
              ${renderSortOption("title", "Название", state.sort)}
              ${renderSortOption("priority", "Приоритет", state.sort)}
            </select>
          </label>
          <label class="compact-field">
            <span class="visually-hidden">Направление сортировки</span>
            <select name="direction">
              ${renderDirectionOption("asc", "По возрастанию", state.direction)}
              ${renderDirectionOption("desc", "По убыванию", state.direction)}
            </select>
          </label>
          <button class="icon-button" type="submit" aria-label="Применить фильтры задач" title="Применить фильтры задач">&#8981;</button>
        </div>
      </form>
    </section>
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
            <span class="visually-hidden">Название</span>
            <input name="title" type="text" value="" placeholder="Новая задача" autocomplete="off" required>
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
                aria-label="Настройки задачи"
                title="Настройки задачи"
              >
                &#9881;
              </button>
            `
            : ""
        }
        <button class="icon-button small task-form-submit" type="submit" aria-label="Создать задачу" title="Создать задачу" ${state.saving ? "disabled" : ""}>
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
            url: "",
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
  url: string;
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
          <p class="section-label">Задача</p>
          <h2 id="task-settings-title">Настройки</h2>
        </div>
        <button class="icon-button small" type="button" data-close-task-settings aria-label="Закрыть настройки задачи" title="Закрыть настройки задачи">&#215;</button>
      </div>
      <div class="project-settings-form task-settings-form">
        <label>
          <span>Заметки</span>
          <textarea form="task-form" name="notes" rows="3" placeholder="Заметки">${escapeHTML(values.notes)}</textarea>
        </label>
        <label>
          <span>URL</span>
          <input form="task-form" name="url" type="text" inputmode="url" value="${escapeAttr(values.url)}" placeholder="https://example.com">
        </label>
        <div class="settings-form-grid">
          <label>
            <span>Проект</span>
            <select form="task-form" name="project_id">
              <option value="" ${values.selectedProjectID === null ? "selected" : ""}>Входящие</option>
              ${values.projects.map((project) => renderProjectOption(project, values.selectedProjectID)).join("")}
            </select>
          </label>
          <label>
            <span>Дата</span>
            <input form="task-form" name="due_date" type="date" value="${escapeAttr(values.dueDate)}">
          </label>
          <label>
            <span>Время</span>
            <input form="task-form" name="due_time" type="time" value="${escapeAttr(values.dueTime)}">
          </label>
          <label>
            <span>Повтор</span>
            <select form="task-form" name="repeat_frequency">
              ${renderRepeatOption("none", "Не повторять", values.repeatFrequency)}
              ${renderRepeatOption("daily", "Ежедневно", values.repeatFrequency)}
              ${renderRepeatOption("weekly", "Еженедельно", values.repeatFrequency)}
              ${renderRepeatOption("monthly", "Ежемесячно", values.repeatFrequency)}
              ${renderRepeatOption("yearly", "Ежегодно", values.repeatFrequency)}
            </select>
          </label>
          <label>
            <span>Каждые</span>
            <input form="task-form" name="repeat_interval" type="number" min="1" step="1" value="${values.repeatInterval}">
          </label>
          <label>
            <span>До</span>
            <input form="task-form" name="repeat_until" type="date" value="${escapeAttr(values.repeatUntil)}">
          </label>
        </div>
        <label>
          <span>Приоритет</span>
          <select form="task-form" name="priority">
            ${renderPriorityOption("none", "Без приоритета", values.priority)}
            ${renderPriorityOption("low", "Низкий", values.priority)}
            ${renderPriorityOption("medium", "Средний", values.priority)}
            ${renderPriorityOption("high", "Высокий", values.priority)}
          </select>
        </label>
        <label class="task-flag-field">
          <input form="task-form" name="flagged" type="checkbox" ${values.flagged ? "checked" : ""}>
          <span>Флаг</span>
        </label>
        <div class="settings-form-actions">
          <button class="primary-button" type="button" data-close-task-settings>Готово</button>
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
          <p class="section-label">Задача</p>
          <h2 id="task-settings-title">Настройки</h2>
        </div>
        <button class="icon-button small" type="button" data-cancel-task-edit aria-label="Закрыть настройки задачи" title="Закрыть настройки задачи">&#215;</button>
      </div>
      <form class="project-settings-form task-settings-form" id="task-settings-form">
        <input type="hidden" name="task_id" value="${task.id}">
        <label>
          <span>Название</span>
          <input name="title" type="text" value="${escapeAttr(task.title)}" autocomplete="off" required>
        </label>
        <label>
          <span>Заметки</span>
          <textarea name="notes" rows="3" placeholder="Заметки">${escapeHTML(task.notes ?? "")}</textarea>
        </label>
        <label>
          <span>URL</span>
          <input name="url" type="text" inputmode="url" value="${escapeAttr(task.url ?? "")}" placeholder="https://example.com">
        </label>
        <div class="settings-form-grid">
          <label>
            <span>Проект</span>
            <select name="project_id">
              <option value="" ${task.project_id === null ? "selected" : ""}>Входящие</option>
              ${state.projects.map((project) => renderProjectOption(project, task.project_id)).join("")}
            </select>
          </label>
          <label>
            <span>Дата</span>
            <input name="due_date" type="date" value="${escapeAttr(task.due_date ?? "")}">
          </label>
          <label>
            <span>Время</span>
            <input name="due_time" type="time" value="${escapeAttr(task.due_time ?? "")}">
          </label>
          <label>
            <span>Повтор</span>
            <select name="repeat_frequency">
              ${renderRepeatOption("none", "Не повторять", task.repeat_frequency)}
              ${renderRepeatOption("daily", "Ежедневно", task.repeat_frequency)}
              ${renderRepeatOption("weekly", "Еженедельно", task.repeat_frequency)}
              ${renderRepeatOption("monthly", "Ежемесячно", task.repeat_frequency)}
              ${renderRepeatOption("yearly", "Ежегодно", task.repeat_frequency)}
            </select>
          </label>
          <label>
            <span>Каждые</span>
            <input name="repeat_interval" type="number" min="1" step="1" value="${task.repeat_interval}">
          </label>
          <label>
            <span>До</span>
            <input name="repeat_until" type="date" value="${escapeAttr(task.repeat_until ?? "")}">
          </label>
        </div>
        <label>
          <span>Приоритет</span>
          <select name="priority">
            ${renderPriorityOption("none", "Без приоритета", task.priority)}
            ${renderPriorityOption("low", "Низкий", task.priority)}
            ${renderPriorityOption("medium", "Средний", task.priority)}
            ${renderPriorityOption("high", "Высокий", task.priority)}
          </select>
        </label>
        <label class="task-flag-field">
          <input name="flagged" type="checkbox" ${task.flagged ? "checked" : ""}>
          <span>Флаг</span>
        </label>
        ${state.taskFormError ? `<p class="form-error">${escapeHTML(state.taskFormError)}</p>` : ""}
        <div class="settings-form-actions">
          <button class="secondary-button danger" type="button" data-delete-current-task-id="${task.id}">Удалить</button>
          <button class="secondary-button" type="button" data-cancel-task-edit>Отмена</button>
          <button class="primary-button" type="submit" ${state.saving ? "disabled" : ""}>Сохранить</button>
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
      <section class="task-list" aria-label="Задачи">
        ${taskForm}
        ${taskSettingsPanel}
        <p class="empty-state">Загружаю задачи...</p>
      </section>
    `;
  }

  if (state.tasks.length === 0) {
    return `
      <section class="task-list" aria-label="Задачи">
        ${taskForm}
        ${taskSettingsPanel}
        <p class="empty-state">В этом списке нет задач.</p>
      </section>
    `;
  }

  return `
    <section class="task-list" aria-label="Задачи">
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
    project ? `<div><dt>Проект</dt><dd>${escapeHTML(project.name)}</dd></div>` : "",
    task.url ? `<div><dt>URL</dt><dd>${renderTaskURL(task.url)}</dd></div>` : "",
    task.due_date ? `<div><dt>Срок</dt><dd>${escapeHTML(taskDueLabel(task))}</dd></div>` : "",
    task.repeat_frequency !== "none" ? `<div><dt>Повтор</dt><dd>${escapeHTML(repeatLabel(task))}</dd></div>` : "",
    task.priority !== "none" ? `<div><dt>Приоритет</dt><dd>${escapeHTML(priorityLabel(task.priority))}</dd></div>` : ""
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
        aria-label="${done ? `Вернуть ${escapeAttr(task.title)}` : `Завершить ${escapeAttr(task.title)}`}"
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
        <button class="icon-button small" type="button" data-edit-task-id="${task.id}" aria-label="Настройки задачи ${escapeAttr(task.title)}" title="Настройки задачи">&#9881;</button>
      </div>
    </article>
  `;
}

function taskMarkers(task: TodoTask): string {
  const markers = [];
  if (task.flagged) {
    markers.push(`<span class="task-marker flagged" aria-label="С флагом" title="С флагом">&#9873;</span>`);
  }
  if (task.priority !== "none") {
    markers.push(`<span class="task-marker priority-${task.priority}" aria-label="${priorityLabel(task.priority)} приоритет" title="${priorityLabel(task.priority)} приоритет">${prioritySymbol(task.priority)}</span>`);
  }
  return markers.join("");
}

function taskDueLabel(task: TodoTask): string {
  if (!task.due_date) {
    return "Без даты";
  }
  return task.due_time ? `${task.due_date} ${task.due_time}` : task.due_date;
}

function renderTaskURL(taskURL: string): string {
  const safeURL = safeTaskURL(taskURL);
  if (!safeURL) {
    return `<span class="task-url-text">${escapeHTML(taskURL)}</span>`;
  }
  return `<a class="task-url-link" href="${escapeAttr(safeURL)}" target="_blank" rel="noopener noreferrer">${escapeHTML(taskURL)}</a>`;
}

function safeTaskURL(taskURL: string): string | null {
  try {
    const parsed = new URL(taskURL);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function repeatLabel(task: TodoTask): string {
  const base = repeatName(task.repeat_frequency);
  const interval = task.repeat_interval > 1 ? ` каждые ${task.repeat_interval}` : "";
  const until = task.repeat_until ? ` до ${task.repeat_until}` : "";
  return `${base}${interval}${until}`;
}

function repeatName(frequency: TodoRepeatFrequency): string {
  switch (frequency) {
    case "daily":
      return "Ежедневно";
    case "weekly":
      return "Еженедельно";
    case "monthly":
      return "Ежемесячно";
    case "yearly":
      return "Ежегодно";
    default:
      return "Не повторять";
  }
}

function priorityLabel(priority: TodoTaskPriority): string {
  switch (priority) {
    case "low":
      return "Низкий";
    case "medium":
      return "Средний";
    case "high":
      return "Высокий";
    default:
      return "Без";
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
    return `<span class="health-badge health-badge-ok">API онлайн</span>`;
  }
  if (state.kind === "offline") {
    return `<span class="health-badge health-badge-down">API недоступен</span>`;
  }
  return `<span class="health-badge">Проверяю API</span>`;
}

function renderAuthBadge(state: AuthState): string {
  if (state.kind === "authenticated") {
    return `<span class="health-badge health-badge-ok">Вход выполнен</span>`;
  }
  if (state.kind === "unauthenticated") {
    return `<span class="health-badge health-badge-down">Вход не выполнен</span>`;
  }
  return `<span class="health-badge">Проверяю сессию</span>`;
}

function renderHealthDetails(state: HealthState, apiBaseUrl: string): string {
  if (state.kind === "loading") {
    return `<h2>Проверяю статус...</h2><p>Запрос к ${escapeHTML(apiBaseUrl)}/health.</p>`;
  }

  if (state.kind === "offline") {
    return `<h2>Backend недоступен</h2><p>${escapeHTML(state.message)}</p>`;
  }

  const database = state.payload.checks.database;
  return `
    <h2>${escapeHTML(state.payload.service)}: ${escapeHTML(state.payload.status)}</h2>
    <dl class="health-list">
      <div><dt>Версия</dt><dd>${escapeHTML(state.payload.version)}</dd></div>
      <div><dt>База данных</dt><dd>${escapeHTML(database?.status ?? "неизвестно")}</dd></div>
      <div><dt>Задержка</dt><dd>${escapeHTML(database?.latency ?? "н/д")}</dd></div>
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
  root.querySelector("[data-toggle-todo-search-panel]")?.addEventListener("click", options.onToggleTodoSearchPanel);
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

function bindFinanceEvents(root: HTMLElement, options: RenderOptions) {
  root.querySelector("#refresh-finance")?.addEventListener("click", options.onRefreshFinance);
  bindFinanceSettings(root, options);
  root.querySelector<HTMLFormElement>("#finance-year-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const year = numberFromDataset(String(new FormData(form).get("year") ?? ""));
    if (year) {
      options.onChangeFinanceYear(year);
    }
  });
  root.querySelector<HTMLButtonElement>("#save-finance-year")?.addEventListener("click", () => {
    const expenseForms = Array.from(root.querySelectorAll<HTMLFormElement>("[data-finance-expense-month]"));
    const incomeForms = Array.from(root.querySelectorAll<HTMLFormElement>("[data-finance-income-month]"));
    if (expenseForms.length > 0) {
      options.onSaveFinanceExpenseYear(expenseForms);
    }
    if (incomeForms.length > 0) {
      incomeForms.forEach((form) => syncFinanceIncomeSettings(root, form));
      options.onSaveFinanceIncomeYear(incomeForms);
    }
  });

  root.querySelectorAll<HTMLFormElement>("[data-finance-expense-month]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const month = numberFromDataset(form.dataset.financeExpenseMonth);
      if (month) {
        options.onSaveFinanceExpenseMonth(month, form);
      }
    });
  });

  root.querySelectorAll<HTMLInputElement>("[data-finance-expense-limit]").forEach((input) => {
    updateFinanceExpenseLimitCell(input);
    input.addEventListener("input", () => updateFinanceExpenseLimitCell(input));
  });

  root.querySelectorAll<HTMLFormElement>("[data-finance-income-month]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const month = numberFromDataset(form.dataset.financeIncomeMonth);
      if (month) {
        syncFinanceIncomeSettings(root, form);
        options.onSaveFinanceIncomeMonth(month, form);
      }
    });
  });

  root.querySelectorAll<HTMLInputElement>("[data-finance-income-target]").forEach((input) => {
    updateFinanceIncomeTargetCell(input);
    input.addEventListener("input", () => updateFinanceIncomeTargetCell(input));
  });
}

function updateFinanceExpenseLimitCell(input: HTMLInputElement) {
  const field = input.closest(".finance-money-field");
  if (!field) {
    return;
  }

  field.classList.remove("limit-safe", "limit-near", "limit-over");
  const status =
    input.dataset.financeLimitKind === "investment_goal"
      ? targetProgressStatus(input.value, input.dataset.financeExpenseLimit ?? "0.00")
      : expenseLimitStatus(input.value, input.dataset.financeExpenseLimit ?? "0.00");
  if (status !== "none") {
    field.classList.add(`limit-${status}`);
  }
}

function updateFinanceIncomeTargetCell(input: HTMLInputElement) {
  const field = input.closest(".finance-money-field");
  if (!field) {
    return;
  }

  field.classList.remove("limit-safe", "limit-near", "limit-over");
  const status = targetProgressStatus(input.value, input.dataset.financeIncomeTarget ?? "0.00");
  if (status !== "none") {
    field.classList.add(`limit-${status}`);
  }
}

function bindFinanceSettings(root: HTMLElement, options: RenderOptions) {
  const settingsForm = root.querySelector<HTMLFormElement>("#finance-settings-form");
  if (settingsForm) {
    const updateSettings = () => {
      updateFinanceSettingsCalculations(root);
      options.onChangeFinanceSettings(settingsForm);
    };

    settingsForm.addEventListener("input", updateSettings);
    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      updateSettings();
      options.onSaveFinanceSettings(settingsForm);
    });
  }

  updateFinanceSettingsCalculations(root);
}

function updateFinanceSettingsCalculations(root: HTMLElement) {
  const salaryInput = root.querySelector<HTMLInputElement>('[data-finance-income-setting="salary_amount"]');
  const bonusInput = root.querySelector<HTMLInputElement>('[data-finance-income-setting="bonus_percent"]');
  const incomeInput = root.querySelector<HTMLInputElement>('[data-finance-income-calculated="total_amount"]');
  if (!salaryInput || !bonusInput || !incomeInput) {
    return;
  }

  const incomeAmount = calculateIncomeAmount(salaryInput.value, bonusInput.value);
  incomeInput.value = formatRussianMoneyAmount(incomeAmount);
  root.querySelectorAll<HTMLInputElement>("[data-finance-limit-percent]").forEach((input) => {
    const code = input.dataset.financeLimitPercent;
    if (!code) {
      return;
    }
    const output = root.querySelector<HTMLOutputElement>(`[data-finance-limit-amount="${code}"]`);
    if (output) {
      const baseAmount = input.dataset.financeLimitPeriod === "annual" ? multiplyDecimalAmount(incomeAmount, 12) : incomeAmount;
      output.value = input.value.trim() === "" ? "" : formatRussianMoneyAmount(calculatePercentAmount(baseAmount, input.value));
    }
  });
  updateFinanceLimitAllocation(root);
}

function updateFinanceLimitAllocation(root: HTMLElement) {
  const percentValues = Array.from(root.querySelectorAll<HTMLInputElement>("[data-finance-limit-percent]")).map((input) => input.value);
  const allocationPercent = limitAllocationPercent(percentValues);
  const allocationValid = isLimitAllocationValid(allocationPercent);
  const allocation = root.querySelector<HTMLElement>("[data-finance-limit-allocation]");
  if (allocation) {
    allocation.textContent = `Распределено ${formatRussianDecimalInput(allocationPercent) || "0"} из 100%`;
    allocation.classList.toggle("allocation-ok", allocationValid);
    allocation.classList.toggle("allocation-error", !allocationValid);
  }
  const saveButton = root.querySelector<HTMLButtonElement>("[data-finance-settings-save]");
  if (saveButton) {
    saveButton.toggleAttribute("disabled", saveButton.dataset.financeSaving === "true" || !allocationValid);
  }
}

function syncFinanceIncomeSettings(root: HTMLElement, form: HTMLFormElement) {
  const salaryAmount = root.querySelector<HTMLInputElement>('[data-finance-income-setting="salary_amount"]')?.value;
  const bonusPercent = root.querySelector<HTMLInputElement>('[data-finance-income-setting="bonus_percent"]')?.value;

  if (salaryAmount !== undefined) {
    setHiddenInputValue(form, "salary_amount", normalizeDecimalInputOrRaw(salaryAmount));
  }
  if (bonusPercent !== undefined) {
    setHiddenInputValue(form, "bonus_percent", normalizeDecimalInputOrRaw(bonusPercent));
  }
}

function setHiddenInputValue(form: HTMLFormElement, name: string, value: string) {
  let input = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    form.append(input);
  }
  input.value = value;
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

function monthLabel(month: number): string {
  const labels = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return labels[month - 1] ?? String(month);
}

function financeCategoryLabel(category: FinanceExpenseCategory): string {
  switch (category.code) {
    case "restaurants":
      return "Рестораны";
    case "groceries":
      return "Продукты";
    case "personal":
      return "Личное";
    case "utilities":
      return "Коммунальные";
    case "transport":
      return "Транспорт";
    case "gifts":
      return "Подарки";
    case "investments":
      return "Инвестиции";
    case "entertainment":
      return "Развлечения";
    case "education":
      return "Образование";
    default:
      return category.label;
  }
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
