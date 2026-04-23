import "./styles.css";

import { fetchHealth } from "./health";
import { renderApp } from "./render";
import type { HealthState } from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found");
}

const root = app;
let healthState: HealthState = { kind: "loading" };

function render() {
  renderApp(root, {
    apiBaseUrl,
    healthState,
    onRefreshHealth: () => {
      void refreshHealth();
    }
  });
}

async function refreshHealth() {
  healthState = { kind: "loading" };
  render();
  healthState = await fetchHealth(apiBaseUrl);
  render();
}

render();
void refreshHealth();
