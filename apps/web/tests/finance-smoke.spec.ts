import { expect, test, type Page } from "@playwright/test";

const categories = [
  { code: "restaurants", label: "Restaurants", classification: "expense" },
  { code: "groceries", label: "Groceries", classification: "expense" },
  { code: "personal", label: "Personal", classification: "expense" },
  { code: "utilities", label: "Utilities", classification: "expense" },
  { code: "transport", label: "Transport", classification: "expense" },
  { code: "gifts", label: "Gifts", classification: "expense" },
  { code: "investments", label: "Investments", classification: "transfer" },
  { code: "entertainment", label: "Entertainment", classification: "expense" },
  { code: "education", label: "Education", classification: "expense" }
] as const;

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

test("finance renders settings, expense limits, and income pages with mocked API", async ({ page }) => {
  await mockFinanceApi(page);

  await page.goto("/finance/settings");
  await expect(page.getByRole("link", { name: "Настройки" })).toBeVisible();
  await expect(page.locator('[data-finance-income-setting="salary_amount"]')).toHaveValue("0,00");

  await page.locator('[data-finance-income-setting="salary_amount"]').fill("100 000,00");
  await page.locator('[data-finance-income-setting="bonus_percent"]').fill("0,00");
  await page.locator('[data-finance-limit-percent="restaurants"]').fill("1,00");
  await expect(page.locator('[data-finance-income-calculated="total_amount"]')).toHaveValue("100 000,00");
  await expect(page.locator('[data-finance-limit-amount="restaurants"]')).toContainText("1 000,00");

  await page.getByRole("link", { name: "Расходы" }).click();
  await expect(page.getByRole("button", { name: "Сохранить расходы" })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".finance-average-row")).toContainText("Среднее в месяц");

  const restaurantInput = page.locator('form[data-finance-expense-month="1"] input[name="restaurants"]');
  const restaurantField = page.locator('form[data-finance-expense-month="1"] label.finance-money-field:has(input[name="restaurants"])');
  await restaurantInput.fill("500,00");
  await expect(restaurantField).toHaveClass(/limit-safe/);
  await restaurantInput.fill("900,00");
  await expect(restaurantField).toHaveClass(/limit-near/);
  await restaurantInput.fill("1 200,00");
  await expect(restaurantField).toHaveClass(/limit-over/);
  await restaurantInput.fill("0,00");
  await expect(restaurantField).not.toHaveClass(/limit-/);

  await page.getByRole("link", { name: "Доходы" }).click();
  await expect(page.locator('form[data-finance-income-month="1"] input[name="total_amount"]')).toBeVisible();
  await expect(page.getByText("Заполнено месяцев")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/finance/expenses");
  await expect(page.locator(".finance-table-shell")).toBeVisible();
  const tableShellFitsViewport = await page.locator(".finance-table-shell").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= document.documentElement.clientWidth;
  });
  expect(tableShellFitsViewport).toBe(true);
});

async function mockFinanceApi(page: Page) {
  await page.route("http://localhost:8080/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        service: "anton415-hub-api",
        status: "ok",
        version: "test",
        checks: { database: { status: "ok", latency: "1ms" } }
      })
    });
  });

  await page.route("http://localhost:8080/api/v1/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          authenticated: true,
          user: { email: "anton@example.com", provider: "email" }
        }
      })
    });
  });

  await page.route("http://localhost:8080/api/v1/auth/providers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: "email", name: "Email link", kind: "email" }] })
    });
  });

  await page.route("http://localhost:8080/api/v1/finance/expenses**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: expenseYear() })
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          month: 1,
          category_amounts: zeroAmounts,
          total_amount: "0.00",
          spending_total_amount: "0.00"
        }
      })
    });
  });

  await page.route("http://localhost:8080/api/v1/finance/income**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: incomeYear() })
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          month: 1,
          salary_amount: "0.00",
          bonus_percent: "0.00",
          total_amount: "0.00"
        }
      })
    });
  });
}

function expenseYear() {
  return {
    year: 2026,
    currency: "RUB",
    categories,
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      category_amounts: { ...zeroAmounts },
      total_amount: "0.00",
      spending_total_amount: "0.00"
    })),
    annual_totals_by_category: { ...zeroAmounts },
    annual_total_amount: "0.00",
    annual_spending_total_amount: "0.00"
  };
}

function incomeYear() {
  return {
    year: 2026,
    currency: "RUB",
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      salary_amount: "0.00",
      bonus_percent: "0.00",
      total_amount: "0.00"
    })),
    annual_total_amount: "0.00",
    average_monthly_total_amount: "0.00"
  };
}
