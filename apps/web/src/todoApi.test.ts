import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TodoApi, TodoApiError } from "./todoApi";

describe("TodoApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes trailing slashes and sends JSON headers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const api = new TodoApi("http://api.test/");
    await api.listProjects();

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/v1/todo/projects", {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  });

  it("builds task query parameters in API order", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const api = new TodoApi("http://api.test");
    await api.listTasks({ view: "today", status: "todo", project_id: 7 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/v1/todo/tasks?view=today&status=todo&project_id=7",
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        }
      }
    );
  });

  it("does not append a query string for all tasks", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const api = new TodoApi("http://api.test");
    await api.listTasks({});

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/v1/todo/tasks", {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  });

  it("resolves 204 responses without parsing JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const api = new TodoApi("http://api.test");
    await expect(api.deleteTask(9)).resolves.toBeUndefined();
  });

  it("throws API errors from error envelopes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: "validation_error", message: "task title is required" } },
        { status: 400 }
      )
    );

    const api = new TodoApi("http://api.test");

    const promise = api.createTask({ project_id: null, title: "", notes: null, due_date: null });

    await expect(promise).rejects.toBeInstanceOf(TodoApiError);
    await expect(promise).rejects.toMatchObject({
      name: "TodoApiError",
      code: "validation_error",
      message: "task title is required"
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
