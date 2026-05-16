import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Wallet,
  TrendingUp,
  Target,
  Calendar as CalendarIcon,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { financeApi, FinanceApiError } from "../api";
import {
  financeExpenseCategoryCodes,
  type FinanceExpenseCategoryCode,
  type FinanceExpensesYear,
  type FinanceIncomeYear,
  type FinanceSettings
} from "../api/types";
import {
  formatRussianDecimal,
  normalizeDecimalInputOrRaw
} from "../api/financeFormat";
import { useAuthGate, logoutAndRedirect } from "../hooks/useAuthGate";

const categoryShort: Record<FinanceExpenseCategoryCode, string> = {
  restaurants: "Рест.",
  groceries: "Прод.",
  personal: "Личн.",
  utilities: "Комм.",
  transport: "Тр.",
  gifts: "Под.",
  investments: "Инв.",
  entertainment: "Разв.",
  education: "Обр."
};

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const modules = [
  { id: "tasks", name: "Задачи", icon: CheckSquare, path: "/tasks" },
  { id: "finances", name: "Финансы", icon: Wallet, path: "/finances" },
  { id: "investments", name: "Инвестиции", icon: TrendingUp, path: "/investments" },
  { id: "fire", name: "FIRE", icon: Target, path: "/fire" },
  { id: "calendar", name: "Календарь", icon: CalendarIcon, path: "/calendar" }
];

type ExpenseGrid = Record<number, Partial<Record<FinanceExpenseCategoryCode, string>>>;
type IncomeGrid = Record<number, { salary_amount: string; bonus_percent: string }>;
type LimitPercents = Partial<Record<FinanceExpenseCategoryCode, string>>;

function describeError(error: unknown): string {
  if (error instanceof FinanceApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить запрос";
}

function buildExpenseGrid(expenses: FinanceExpensesYear | undefined): ExpenseGrid {
  const grid: ExpenseGrid = {};
  for (let m = 1; m <= 12; m++) grid[m] = {};
  expenses?.months.forEach((row) => {
    const cell: Partial<Record<FinanceExpenseCategoryCode, string>> = {};
    financeExpenseCategoryCodes.forEach((code) => {
      const amount = row.category_amounts[code];
      if (amount && amount !== "0" && amount !== "0.00") cell[code] = amount;
    });
    grid[row.month] = cell;
  });
  return grid;
}

function buildIncomeGrid(income: FinanceIncomeYear | undefined): IncomeGrid {
  const grid: IncomeGrid = {};
  for (let m = 1; m <= 12; m++) grid[m] = { salary_amount: "", bonus_percent: "" };
  income?.months.forEach((row) => {
    grid[row.month] = {
      salary_amount: row.salary_amount && row.salary_amount !== "0.00" ? row.salary_amount : "",
      bonus_percent: row.bonus_percent && row.bonus_percent !== "0.00" ? row.bonus_percent : ""
    };
  });
  return grid;
}

function formatAmount(value: string | undefined): string {
  if (!value) return "—";
  return formatRussianDecimal(value);
}

export function FinancesPage() {
  const { status } = useAuthGate();
  const navigate = useNavigate();

  const [year, setYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("expenses");
  const [expenses, setExpenses] = useState<FinanceExpensesYear | undefined>();
  const [income, setIncome] = useState<FinanceIncomeYear | undefined>();
  const [settings, setSettings] = useState<FinanceSettings>({ expense_limit_percents: {} });
  const [expenseGrid, setExpenseGrid] = useState<ExpenseGrid>({});
  const [incomeGrid, setIncomeGrid] = useState<IncomeGrid>({});
  const [salaryDraft, setSalaryDraft] = useState("");
  const [bonusDraft, setBonusDraft] = useState("");
  const [limitDraft, setLimitDraft] = useState<LimitPercents>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [exp, inc, s] = await Promise.all([
        financeApi.listExpenses(year),
        financeApi.listIncome(year),
        financeApi.getSettings()
      ]);
      setExpenses(exp);
      setIncome(inc);
      setSettings(s);
      setExpenseGrid(buildExpenseGrid(exp));
      setIncomeGrid(buildIncomeGrid(inc));
      setSalaryDraft(s.salary_amount && s.salary_amount !== "0.00" ? s.salary_amount : "");
      setBonusDraft(s.bonus_percent && s.bonus_percent !== "0.00" ? s.bonus_percent : "");
      setLimitDraft({ ...s.expense_limit_percents });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void refresh();
  }, [status, refresh]);

  const categories = useMemo(() => expenses?.categories ?? [], [expenses]);

  const handleExpenseChange = (month: number, code: FinanceExpenseCategoryCode, value: string) => {
    setExpenseGrid((prev) => ({ ...prev, [month]: { ...prev[month], [code]: value } }));
  };

  const handleSaveExpenses = async () => {
    setSaving(true);
    setError(undefined);
    setInfo(undefined);
    try {
      for (let month = 1; month <= 12; month++) {
        const row = expenseGrid[month] ?? {};
        const original = expenses?.months.find((m) => m.month === month);
        const payload: Partial<Record<FinanceExpenseCategoryCode, string>> = {};
        let changed = false;
        financeExpenseCategoryCodes.forEach((code) => {
          const next = normalizeDecimalInputOrRaw(row[code] ?? "");
          const prev = original?.category_amounts[code] ?? "0.00";
          if (next !== prev) {
            payload[code] = next || "0";
            changed = true;
          }
        });
        if (changed) {
          await financeApi.saveExpenseMonth(year, month, { category_amounts: payload });
        }
      }
      await refresh();
      setInfo("Расходы сохранены");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleIncomeChange = (
    month: number,
    field: "salary_amount" | "bonus_percent",
    value: string
  ) => {
    setIncomeGrid((prev) => ({ ...prev, [month]: { ...prev[month], [field]: value } }));
  };

  const handleSaveIncome = async () => {
    setSaving(true);
    setError(undefined);
    setInfo(undefined);
    try {
      for (let month = 1; month <= 12; month++) {
        const row = incomeGrid[month];
        const original = income?.months.find((m) => m.month === month);
        const salary = normalizeDecimalInputOrRaw(row.salary_amount);
        const bonus = normalizeDecimalInputOrRaw(row.bonus_percent);
        const prevSalary = original?.salary_amount ?? "0.00";
        const prevBonus = original?.bonus_percent ?? "0.00";
        if (salary !== prevSalary || bonus !== prevBonus) {
          await financeApi.saveIncomeMonth(year, month, {
            salary_amount: salary || "0",
            bonus_percent: bonus || "0",
            total_amount: original?.total_amount ?? "0"
          });
        }
      }
      await refresh();
      setInfo("Доходы сохранены");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(undefined);
    setInfo(undefined);
    try {
      const limit_percents: LimitPercents = {};
      financeExpenseCategoryCodes.forEach((code) => {
        const raw = limitDraft[code];
        if (raw && raw.trim() !== "") {
          limit_percents[code] = normalizeDecimalInputOrRaw(raw) || "0";
        }
      });
      await financeApi.saveSettings({
        salary_amount: normalizeDecimalInputOrRaw(salaryDraft) || "0",
        bonus_percent: normalizeDecimalInputOrRaw(bonusDraft) || "0",
        expense_limit_percents: limit_percents
      });
      await refresh();
      setInfo("Настройки сохранены");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const activeCategoryCodes = useMemo(() => {
    if (categories.length === 0) return [...financeExpenseCategoryCodes];
    return categories.map((c) => c.code);
  }, [categories]);

  if (status === "loading") {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b bg-card">
        <div className="px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 md:gap-3">
              <div className="bg-primary text-primary-foreground p-1.5 md:p-2 rounded-lg">
                <LayoutDashboard className="size-5 md:size-6" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-xl">anton-hub</h1>
                <p className="text-xs md:text-sm text-muted-foreground">Личный центр управления</p>
              </div>
            </Link>

            <div className="flex gap-1 md:gap-2 overflow-x-auto flex-1 justify-center">
              {modules.map((module) => {
                const Icon = module.icon;
                const isActive = module.id === "finances";
                return (
                  <Link key={module.id} to={module.path}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap h-8 md:h-9"
                    >
                      <Icon className="size-3 md:size-4" />
                      <span className="hidden xs:inline">{module.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="md:h-9"
              onClick={() => logoutAndRedirect(navigate)}
            >
              <span className="hidden sm:inline">Выход</span>
              <X className="size-4 sm:hidden" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
        <div className="px-1 sm:px-2 md:px-4">
          <div className="mb-4 sm:mb-6 w-full">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
              <h2 className="text-lg sm:text-xl">Финансы</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setYear((y) => y - 1)}
                >
                  <ChevronLeft className="size-3" />
                </Button>
                <span className="min-w-[40px] text-center text-sm font-medium">{year}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setYear((y) => y + 1)}
                >
                  <ChevronRight className="size-3" />
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-danger mb-2">{error}</p>}
            {info && <p className="text-sm text-success mb-2">{info}</p>}
            {loading && <p className="text-sm text-muted-foreground mb-2">Загрузка…</p>}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
                <TabsTrigger value="expenses" className="text-xs sm:text-sm">Расходы</TabsTrigger>
                <TabsTrigger value="income" className="text-xs sm:text-sm">Доходы</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs sm:text-sm">Настройки</TabsTrigger>
              </TabsList>

              {/* Expenses */}
              <TabsContent value="expenses">
                <Card>
                  <CardHeader>
                    <div className="flex justify-end">
                      <Button size="sm" disabled={saving} onClick={() => void handleSaveExpenses()}>
                        {saving ? "Сохраняем…" : "Сохранить"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm" style={{ minWidth: "900px" }}>
                        <thead className="sticky top-0 bg-card border-b z-10">
                          <tr>
                            <th className="text-left py-2 px-2 w-[80px] border-r">Месяц</th>
                            {activeCategoryCodes.map((code) => (
                              <th key={code} className="text-center py-2 px-2 min-w-[80px]">
                                {categoryShort[code]}
                              </th>
                            ))}
                            <th className="text-center py-2 px-2 bg-muted/50 min-w-[100px]">Итого</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthNames.map((monthLabel, idx) => {
                            const month = idx + 1;
                            const row = expenseGrid[month] ?? {};
                            const total = activeCategoryCodes.reduce((sum, code) => {
                              const v = Number(row[code] ?? 0);
                              return sum + (Number.isFinite(v) ? v : 0);
                            }, 0);
                            return (
                              <tr key={month} className="border-b">
                                <td className="py-1 px-2 font-medium text-left border-r">{monthLabel}</td>
                                {activeCategoryCodes.map((code) => (
                                  <td key={code} className="py-1 px-1">
                                    <Input
                                      type="number"
                                      value={row[code] ?? ""}
                                      onChange={(e) => handleExpenseChange(month, code, e.target.value)}
                                      className="h-9 text-center text-xs sm:text-sm border-0 focus:border focus:border-primary px-1"
                                    />
                                  </td>
                                ))}
                                <td className="py-1 px-2 text-center font-medium bg-muted/50">
                                  {total > 0 ? total.toLocaleString("ru-RU") : "—"}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="border-t-2 font-medium bg-muted/50">
                            <td className="py-2 px-2 text-left border-r">Итого</td>
                            {activeCategoryCodes.map((code) => (
                              <td key={code} className="text-center py-2 px-2">
                                {formatAmount(expenses?.annual_totals_by_category[code])}
                              </td>
                            ))}
                            <td className="text-center py-2 px-2 bg-muted/70">
                              {formatAmount(expenses?.annual_total_amount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Income */}
              <TabsContent value="income">
                <Card>
                  <CardHeader>
                    <div className="flex justify-end">
                      <Button size="sm" disabled={saving} onClick={() => void handleSaveIncome()}>
                        {saving ? "Сохраняем…" : "Сохранить"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="sticky top-0 bg-card border-b z-10">
                          <tr>
                            <th className="text-left py-2 px-2 sm:px-4 w-[80px] sm:w-[120px]">Месяц</th>
                            <th className="text-center py-2 px-2 sm:px-4 min-w-[140px]">Оклад</th>
                            <th className="text-center py-2 px-2 sm:px-4 min-w-[120px]">% премии</th>
                            <th className="text-center py-2 px-2 sm:px-4 min-w-[140px]">Итого</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthNames.map((monthLabel, idx) => {
                            const month = idx + 1;
                            const row = incomeGrid[month] ?? { salary_amount: "", bonus_percent: "" };
                            const total = income?.months.find((m) => m.month === month)?.total_amount;
                            return (
                              <tr key={month} className="border-b">
                                <td className="py-1 px-2 sm:px-4 font-medium text-left">{monthLabel}</td>
                                <td className="py-1 px-2 sm:px-4">
                                  <Input
                                    type="number"
                                    value={row.salary_amount}
                                    onChange={(e) =>
                                      handleIncomeChange(month, "salary_amount", e.target.value)
                                    }
                                    className="h-9 text-center text-sm border-0 focus:border focus:border-primary"
                                  />
                                </td>
                                <td className="py-1 px-2 sm:px-4">
                                  <Input
                                    type="number"
                                    value={row.bonus_percent}
                                    onChange={(e) =>
                                      handleIncomeChange(month, "bonus_percent", e.target.value)
                                    }
                                    className="h-9 text-center text-sm border-0 focus:border focus:border-primary"
                                  />
                                </td>
                                <td className="py-1 px-2 sm:px-4 text-center text-muted-foreground">
                                  {formatAmount(total)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="border-t-2 font-medium bg-muted/50">
                            <td className="py-2 px-2 sm:px-4 text-left">Итого</td>
                            <td className="py-2 px-2 sm:px-4 text-center" />
                            <td className="py-2 px-2 sm:px-4 text-center" />
                            <td className="py-2 px-2 sm:px-4 text-center">
                              {formatAmount(income?.annual_total_amount)}
                            </td>
                          </tr>
                          <tr className="border-t font-medium bg-muted/50">
                            <td className="py-2 px-2 sm:px-4 text-left">Среднее</td>
                            <td className="py-2 px-2 sm:px-4 text-center" />
                            <td className="py-2 px-2 sm:px-4 text-center" />
                            <td className="py-2 px-2 sm:px-4 text-center">
                              {formatAmount(income?.average_monthly_total_amount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings */}
              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <div className="flex justify-end">
                      <Button size="sm" disabled={saving} onClick={() => void handleSaveSettings()}>
                        {saving ? "Сохраняем…" : "Сохранить"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="sticky top-0 bg-card border-b z-10">
                          <tr>
                            <th className="text-left py-2 px-2 sm:px-4 w-[160px]">Параметр</th>
                            <th className="text-center py-2 px-2 sm:px-4 min-w-[160px]">Значение</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-success-light border-b">
                            <td className="py-1 px-2 sm:px-4 font-medium text-left">Оклад</td>
                            <td className="py-1 px-2 sm:px-4">
                              <Input
                                type="number"
                                value={salaryDraft}
                                onChange={(e) => setSalaryDraft(e.target.value)}
                                className="h-9 text-center text-sm border-0 focus:border focus:border-primary"
                              />
                            </td>
                          </tr>
                          <tr className="bg-success-light border-b">
                            <td className="py-1 px-2 sm:px-4 font-medium text-left">% премии</td>
                            <td className="py-1 px-2 sm:px-4">
                              <Input
                                type="number"
                                value={bonusDraft}
                                onChange={(e) => setBonusDraft(e.target.value)}
                                className="h-9 text-center text-sm border-0 focus:border focus:border-primary"
                              />
                            </td>
                          </tr>

                          <tr className="bg-muted/30">
                            <td colSpan={2} className="py-2 px-2 sm:px-4 font-medium text-left">
                              Лимиты по категориям (% от оклада)
                            </td>
                          </tr>
                          {financeExpenseCategoryCodes.map((code) => (
                            <tr key={code} className="border-b">
                              <td className="py-1 px-2 sm:px-4 text-left">{categoryShort[code]}</td>
                              <td className="py-1 px-2 sm:px-4">
                                <Input
                                  type="number"
                                  value={limitDraft[code] ?? ""}
                                  onChange={(e) =>
                                    setLimitDraft((prev) => ({ ...prev, [code]: e.target.value }))
                                  }
                                  className="h-9 text-center text-sm border-0 focus:border focus:border-primary"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
