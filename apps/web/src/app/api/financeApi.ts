import type {
  FinanceExpenseCategoryAmounts,
  FinanceExpenseCategoryPercents,
  FinanceExpenseMonth,
  FinanceExpensesYear,
  FinanceIncomeMonth,
  FinanceIncomeYear,
  FinanceSettings
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

export type FinanceExpensePayload = {
  category_amounts: Partial<FinanceExpenseCategoryAmounts>;
};

export type FinanceIncomePayload = {
  salary_amount: string;
  bonus_percent: string;
  total_amount: string;
};

export type FinanceSettingsPayload = {
  salary_amount: string;
  bonus_percent: string;
  expense_limit_percents: Partial<FinanceExpenseCategoryPercents>;
};

export class FinanceApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FinanceApiError";
    this.code = code;
  }
}

export class FinanceApi {
  private readonly baseUrl: string;

  constructor(apiBaseUrl: string) {
    this.baseUrl = apiBaseUrl.replace(/\/$/, "");
  }

  listExpenses(year: number): Promise<FinanceExpensesYear> {
    return this.request<FinanceExpensesYear>(`/api/v1/finance/expenses?year=${encodeURIComponent(String(year))}`);
  }

  saveExpenseMonth(year: number, month: number, payload: FinanceExpensePayload): Promise<FinanceExpenseMonth> {
    return this.request<FinanceExpenseMonth>(`/api/v1/finance/expenses/${year}/${month}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  listIncome(year: number): Promise<FinanceIncomeYear> {
    return this.request<FinanceIncomeYear>(`/api/v1/finance/income?year=${encodeURIComponent(String(year))}`);
  }

  saveIncomeMonth(year: number, month: number, payload: FinanceIncomePayload): Promise<FinanceIncomeMonth> {
    return this.request<FinanceIncomeMonth>(`/api/v1/finance/income/${year}/${month}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  getSettings(): Promise<FinanceSettings> {
    return this.request<FinanceSettings>("/api/v1/finance/settings");
  }

  saveSettings(payload: FinanceSettingsPayload): Promise<FinanceSettings> {
    return this.request<FinanceSettings>("/api/v1/finance/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
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

    const payload = (await response.json()) as DataEnvelope<T> & ErrorEnvelope;
    if (!response.ok) {
      throw new FinanceApiError(
        payload.error?.code ?? "request_failed",
        payload.error?.message ?? `Запрос завершился с ошибкой ${response.status}`
      );
    }

    return payload.data;
  }
}
