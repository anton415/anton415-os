import { expect, test, type Page } from "@playwright/test";

type Project = {
  id: number;
  name: string;
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
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

test("todo supports smart lists and completion flow with mocked API", async ({ page }) => {
  await mockTodoApi(page);
  await page.goto("/todo");

  await expect(page.getByRole("button", { name: "Inbox" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upcoming" })).toBeVisible();
  await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveCount(0);

  await page.getByLabel("Title").fill("Buy milk");
  await page.getByLabel("Notes").fill("2%");
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await page.getByRole("button", { name: "Complete Buy milk" }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toHaveCount(0);

  await page.getByRole("button", { name: "Completed" }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await page.getByRole("button", { name: "Reopen Buy milk" }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toHaveCount(0);

  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.locator('input[name="due_date"]')).toHaveValue(localDateInputValue(new Date()));

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator(".todo-layout")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});

async function mockTodoApi(page: Page) {
  const now = "2026-04-23T10:00:00Z";
  const projects: Project[] = [{ id: 1, name: "Home", created_at: now, updated_at: now }];
  const tasks: Task[] = [
    {
      id: 1,
      project_id: null,
      title: "Existing task",
      notes: null,
      status: "todo",
      due_date: null,
      created_at: now,
      updated_at: now,
      completed_at: null
    }
  ];
  let nextTaskID = 2;

  await page.route("http://localhost:8080/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        service: "anton415-os-api",
        status: "ok",
        version: "test",
        checks: { database: { status: "ok", latency: "1ms" } }
      })
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
      const created: Task = {
        id: nextTaskID,
        project_id: payload.project_id ?? null,
        title: String(payload.title ?? ""),
        notes: payload.notes ?? null,
        status: payload.status ?? "todo",
        due_date: payload.due_date ?? null,
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

  return tasks.filter((task) => {
    if (view === "inbox" && (task.project_id !== null || task.status === "done")) {
      return false;
    }
    if (view === "today" && (task.due_date !== today || task.status === "done")) {
      return false;
    }
    if (view === "upcoming" && (!task.due_date || task.due_date <= today || task.status === "done")) {
      return false;
    }
    if (status && task.status !== status) {
      return false;
    }
    if (projectID && task.project_id !== Number(projectID)) {
      return false;
    }
    return true;
  });
}

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
