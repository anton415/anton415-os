import { expect, test, type Page } from "@playwright/test";

type Project = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

type Task = {
  id: number;
  project_id: number | null;
  title: string;
  notes: string | null;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  due_time: string | null;
  repeat_frequency: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeat_interval: number;
  repeat_until: string | null;
  flagged: boolean;
  priority: "none" | "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

test("todo supports smart lists and completion flow with mocked API", async ({ page }) => {
  await mockTodoApi(page);
  await page.goto("/todo");

  await expect(page.getByRole("button", { name: "Входящие", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сегодня", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Просрочено", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Скоро", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Запланировано", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "С флагом", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Все", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Готово", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Статус" })).toHaveCount(0);
  await expectSmartListsOneColumn(page);

  await page.getByRole("button", { name: "Настройки задачи Existing task" }).click();
  await page.locator('#task-settings-form input[name="title"]').fill("Existing task updated");
  await page.locator('#task-settings-form textarea[name="notes"]').fill("from panel");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("heading", { name: "Existing task updated" })).toBeVisible();
  await expect(page.getByText("from panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Existing task updated" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Existing task updated" })).toHaveCount(0);

  await page.locator('form#task-form input[name="title"]').fill("Buy milk");
  await expect(page.locator('form#task-form textarea[name="notes"]')).toHaveCount(0);
  await expect(page.locator('form#task-form select[name="project_id"]')).toHaveCount(0);
  await expect(page.locator('form#task-form input[name="due_date"]')).toHaveCount(0);
  await page.locator('form#task-form [data-open-task-settings]').click();
  await page.locator('#task-settings-panel textarea[name="notes"]').fill("2%");
  await page.locator('#task-settings-panel input[name="due_date"]').fill(localDateInputValue(new Date()));
  await page.locator('#task-settings-panel input[name="due_time"]').fill("09:30");
  await page.locator('#task-settings-panel select[name="priority"]').selectOption("high");
  await page.locator('#task-settings-panel input[name="flagged"]').check();
  await page.locator("#task-settings-panel .settings-form-actions .primary-button").click();
  await page.getByRole("button", { name: "Создать задачу" }).click();

  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await expect(page.getByText("2%")).toBeVisible();
  await expect(page.locator(".task-meta dd", { hasText: /^Высокий$/ })).toBeVisible();

  await page.locator('form#task-form input[name="title"]').fill("Pay rent");
  await page.locator('form#task-form [data-open-task-settings]').click();
  await page.locator('#task-settings-panel input[name="due_date"]').fill(localDateInputValue(new Date()));
  await page.locator('#task-settings-panel select[name="repeat_frequency"]').selectOption("weekly");
  await page.locator("#task-settings-panel .settings-form-actions .primary-button").click();
  await page.getByRole("button", { name: "Создать задачу" }).click();
  await expect(page.locator(".task-meta dd", { hasText: /^Еженедельно$/ })).toBeVisible();

  await page.locator('input[name="q"]').fill("milk");
  await page.getByRole("button", { name: "Применить фильтры задач" }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pay rent" })).toHaveCount(0);
  await page.locator('input[name="q"]').fill("");
  await page.locator('select[name="sort"]').selectOption("priority");
  await page.locator('select[name="direction"]').selectOption("desc");

  await page.getByRole("button", { name: "С флагом", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();

  await page.getByRole("button", { name: "Просрочено", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overdue task" })).toBeVisible();

  await page.getByRole("button", { name: "Входящие", exact: true }).click();
  await page.getByRole("button", { name: "Завершить Buy milk" }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toHaveCount(0);

  await page.getByRole("button", { name: "Все", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  const allTitles = await page.locator(".task-item h2").evaluateAll((headings) =>
    headings.map((heading) => (heading.textContent ?? "").replace(/[⚑!]/g, "").trim())
  );
  expect(allTitles.at(-1)).toBe("Buy milk");

  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать задачу" })).toHaveCount(0);
  await page.getByRole("button", { name: "Вернуть Buy milk" }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toHaveCount(0);

  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  await expect(page.locator('#task-settings-panel input[name="due_date"]')).toHaveValue(localDateInputValue(new Date()));

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/todo");
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator("#todo-panel")).toHaveClass(/collapsed/);
  await page.getByRole("button", { name: "Показать панель anton415 Hub" }).click();
  await page.getByRole("button", { name: "Показать панель задач" }).click();
  await expect(page.locator(".todo-layout")).toBeVisible();
  await expectSmartListsOneColumn(page);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});

async function expectSmartListsOneColumn(page: Page) {
  await page.locator('[data-todo-view="scheduled"] span').last().evaluate((span) => {
    span.textContent = "Запланировано с очень длинным названием списка на несколько строк";
  });

  const layout = await page.locator(".smart-list-button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        scrollWidth: button.scrollWidth,
        clientWidth: button.clientWidth
      };
    })
  );

  expect(new Set(layout.map((item) => item.left)).size).toBe(1);
  expect(layout.every((item) => item.scrollWidth <= item.clientWidth)).toBe(true);
}

async function mockTodoApi(page: Page) {
  const now = "2026-04-23T10:00:00Z";
  const today = localDateInputValue(new Date());
  const yesterday = localDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const projects: Project[] = [{ id: 1, name: "Home", start_date: today, end_date: null, created_at: now, updated_at: now }];
  const tasks: Task[] = [
    {
      id: 1,
      project_id: null,
      title: "Existing task",
      notes: null,
      status: "todo",
      due_date: null,
      due_time: null,
      repeat_frequency: "none",
      repeat_interval: 1,
      repeat_until: null,
      flagged: false,
      priority: "none",
      created_at: now,
      updated_at: now,
      completed_at: null
    },
    {
      id: 2,
      project_id: null,
      title: "Overdue task",
      notes: null,
      status: "todo",
      due_date: yesterday,
      due_time: null,
      repeat_frequency: "none",
      repeat_interval: 1,
      repeat_until: null,
      flagged: false,
      priority: "none",
      created_at: now,
      updated_at: now,
      completed_at: null
    }
  ];
  let nextTaskID = 3;

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

  await page.route("http://localhost:8080/api/v1/todo/projects", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: projects }) });
  });

  await page.route("http://localhost:8080/api/v1/todo/tasks**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: filterTasks(tasks, url.searchParams) })
      });
      return;
    }

    if (request.method() === "POST") {
      const payload = (await request.postDataJSON()) as Partial<Task>;
      expect(payload.status).toBeUndefined();
      if (payload.title === "Buy milk") {
        expect(payload.notes).toBe("2%");
        expect(payload.due_time).toBe("09:30");
        expect(payload.flagged).toBe(true);
        expect(payload.priority).toBe("high");
      }
      const created: Task = {
        id: nextTaskID,
        project_id: payload.project_id ?? null,
        title: String(payload.title ?? ""),
        notes: payload.notes ?? null,
        status: payload.status ?? "todo",
        due_date: payload.due_date ?? null,
        due_time: payload.due_time ?? null,
        repeat_frequency: payload.repeat_frequency ?? "none",
        repeat_interval: payload.repeat_interval ?? 1,
        repeat_until: payload.repeat_until ?? null,
        flagged: payload.flagged ?? false,
        priority: payload.priority ?? "none",
        created_at: now,
        updated_at: now,
        completed_at: payload.status === "done" ? now : null
      };
      nextTaskID += 1;
      tasks.push(created);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: created }) });
      return;
    }

    await route.fallback();
  });

  await page.route("http://localhost:8080/api/v1/todo/tasks/*", async (route) => {
    const request = route.request();
    const id = Number(new URL(request.url()).pathname.split("/").pop());
    const task = tasks.find((item) => item.id === id);

    if (!task) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "not_found", message: "todo resource was not found" } })
      });
      return;
    }

    if (request.method() === "PATCH") {
      const payload = (await request.postDataJSON()) as Partial<Task>;
      Object.assign(task, payload, {
        updated_at: now,
        completed_at: payload.status === "done" ? now : payload.status ? null : task.completed_at
      });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: task }) });
      return;
    }

    if (request.method() === "DELETE") {
      tasks.splice(tasks.indexOf(task), 1);
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({ status: 405 });
  });
}

function filterTasks(tasks: Task[], params: URLSearchParams): Task[] {
  const today = localDateInputValue(new Date());
  const view = params.get("view");
  const status = params.get("status");
  const projectID = params.get("project_id");
  const query = params.get("q")?.trim().toLowerCase() ?? "";
  const sort = params.get("sort") ?? "smart";
  const direction = params.get("direction") ?? "asc";

  return tasks.filter((task) => {
    if (view === "inbox" && (task.project_id !== null || task.status === "done")) {
      return false;
    }
    if (view === "today" && (!task.due_date || task.due_date > today || task.status === "done")) {
      return false;
    }
    if (view === "overdue" && (!task.due_date || task.due_date >= today || task.status === "done")) {
      return false;
    }
    if (view === "upcoming" && (!task.due_date || task.due_date <= today || task.status === "done")) {
      return false;
    }
    if (view === "scheduled" && (!task.due_date || task.status === "done")) {
      return false;
    }
    if (view === "flagged" && (!task.flagged || task.status === "done")) {
      return false;
    }
    if (status && task.status !== status) {
      return false;
    }
    if (projectID && task.project_id !== Number(projectID)) {
      return false;
    }
    if (query && !`${task.title} ${task.notes ?? ""}`.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  }).sort((left, right) => compareTasks(left, right, sort, direction));
}

function compareTasks(left: Task, right: Task, sort: string, direction: string): number {
  const doneRank = (task: Task) => (task.status === "done" ? 1 : 0);
  const doneCompare = doneRank(left) - doneRank(right);
  if (doneCompare !== 0) {
    return doneCompare;
  }
  const multiplier = direction === "desc" && sort !== "smart" ? -1 : 1;
  const priorityRank = (task: Task) => ({ none: 0, low: 1, medium: 2, high: 3 })[task.priority];
  if (sort === "priority") {
    return multiplier * (priorityRank(left) - priorityRank(right));
  }
  if (sort === "title") {
    return multiplier * left.title.localeCompare(right.title);
  }
  const dueCompare = (left.due_date ?? "9999-12-31").localeCompare(right.due_date ?? "9999-12-31");
  if (dueCompare !== 0) {
    return multiplier * dueCompare;
  }
  return left.id - right.id;
}

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
