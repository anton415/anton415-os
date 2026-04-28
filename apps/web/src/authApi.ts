import type { AuthProvider, AuthUser } from "./types";

type DataEnvelope<T> = {
  data: T;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

type MePayload =
  | { authenticated: true; user: AuthUser }
  | { authenticated: false; user: null };

export class AuthApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
  }
}

export class AuthApi {
  private readonly baseUrl: string;

  constructor(apiBaseUrl: string) {
    this.baseUrl = apiBaseUrl.replace(/\/$/, "");
  }

  me(): Promise<MePayload> {
    return this.request<MePayload>("/api/v1/me");
  }

  providers(): Promise<AuthProvider[]> {
    return this.request<AuthProvider[]>("/api/v1/auth/providers");
  }

  oauthStartUrl(providerId: string, redirectPath = "/todo"): string {
    const params = new URLSearchParams({ redirect: redirectPath });
    return `${this.baseUrl}/api/v1/auth/${encodeURIComponent(providerId)}/start?${params.toString()}`;
  }

  async startEmail(email: string): Promise<void> {
    await this.request<{ accepted: boolean }>("/api/v1/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  async logout(): Promise<void> {
    await this.request<void>("/api/v1/auth/logout", { method: "POST" });
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

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json()) as DataEnvelope<T> & ErrorEnvelope;
    if (!response.ok) {
      throw new AuthApiError(
        payload.error?.code ?? "request_failed",
        payload.error?.message ?? `Request failed with status ${response.status}`
      );
    }

    return payload.data;
  }
}
