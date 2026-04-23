export type HealthPayload = {
  service: string;
  status: "ok" | "degraded" | string;
  version: string;
  checks: Record<string, { status: string; latency?: string; error?: string }>;
};

export type HealthState =
  | { kind: "loading" }
  | { kind: "online"; payload: HealthPayload }
  | { kind: "offline"; message: string };

export type ProductModule = {
  name: string;
  path: string;
  accent: string;
  summary: string;
};
