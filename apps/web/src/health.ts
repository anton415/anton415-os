import type { HealthPayload, HealthState } from "./types";

// Health indicator показывает, видит ли frontend живой API и подключенную БД.
export async function fetchHealth(apiBaseUrl: string): Promise<HealthState> {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as HealthPayload;

    if (!response.ok || payload.status !== "ok") {
      return {
        kind: "offline",
        message: `${payload.service ?? "API"} вернул ${payload.status ?? response.statusText}.`
      };
    }

    return { kind: "online", payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка подключения";
    return { kind: "offline", message };
  }
}
