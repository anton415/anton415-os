import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FinanceApi, FinanceApiError } from "./financeApi";

describe("FinanceApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes trailing slashes and lists expenses by year", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { year: 2026 } }));

    const api = new FinanceApi("http://api.test/");
    await api.listExpenses(2026);

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/v1/finance/expenses?year=2026", {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  });

  it("saves expense, income, and settings with JSON payloads", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: {} }))
      .mockResolvedValueOnce(jsonResponse({ data: {} }))
      .mockResolvedValueOnce(jsonResponse({ data: {} }));

    const api = new FinanceApi("http://api.test");
    await api.saveExpenseMonth(2026, 4, { category_amounts: { restaurants: "1500.00" } });
    await api.saveIncomeMonth(2026, 4, {
      salary_amount: "200000.00",
      bonus_percent: "25.00",
      total_amount: "250000.00"
    });
    await api.saveSettings({
      salary_amount: "200000.00",
      bonus_percent: "25.00",
      expense_limit_percents: { restaurants: "10.00" }
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://api.test/api/v1/finance/expenses/2026/4", {
      method: "PUT",
      body: JSON.stringify({ category_amounts: { restaurants: "1500.00" } }),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.test/api/v1/finance/income/2026/4", {
      method: "PUT",
      body: JSON.stringify({
        salary_amount: "200000.00",
        bonus_percent: "25.00",
        total_amount: "250000.00"
      }),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://api.test/api/v1/finance/settings", {
      method: "PUT",
      body: JSON.stringify({
        salary_amount: "200000.00",
        bonus_percent: "25.00",
        expense_limit_percents: { restaurants: "10.00" }
      }),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  });

  it("throws API errors from error envelopes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: "validation_error", message: "money amount is invalid" } },
        { status: 400 }
      )
    );

    const api = new FinanceApi("http://api.test");
    const promise = api.saveIncomeMonth(2026, 4, {
      salary_amount: "0.00",
      bonus_percent: "0.00",
      total_amount: "-1.00"
    });

    await expect(promise).rejects.toBeInstanceOf(FinanceApiError);
    await expect(promise).rejects.toMatchObject({
      name: "FinanceApiError",
      code: "validation_error",
      message: "money amount is invalid"
    });
  });
});

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}
