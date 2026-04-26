import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApi, AuthApiError } from "./authApi";

describe("AuthApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the current session with credentials", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { authenticated: false, user: null } }));

    const api = new AuthApi("http://api.test/");
    await api.me();

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/v1/me", {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  });

  it("builds OAuth start URLs", () => {
    const api = new AuthApi("http://api.test/");

    expect(api.oauthStartUrl("github")).toBe("http://api.test/api/v1/auth/github/start?redirect=/todo");
  });

  it("sends email login requests", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { accepted: true } }, { status: 202 }));

    const api = new AuthApi("http://api.test");
    await api.startEmail("anton@example.com");

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/v1/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "anton@example.com" }),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
  });

  it("throws API errors from auth error envelopes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: "unauthorized", message: "authentication is required" } }, { status: 401 })
    );

    const api = new AuthApi("http://api.test");
    const promise = api.me();

    await expect(promise).rejects.toBeInstanceOf(AuthApiError);
    await expect(promise).rejects.toMatchObject({
      code: "unauthorized",
      message: "authentication is required"
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
