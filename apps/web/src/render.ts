import { productModules } from "./modules";
import type { HealthState } from "./types";

type RenderOptions = {
  apiBaseUrl: string;
  healthState: HealthState;
  onRefreshHealth: () => void;
};

export function renderApp(root: HTMLElement, options: RenderOptions) {
  // Shell небольшой, поэтому на Step 2 проще перерисовывать его целиком.
  // Когда появится реальная доменная UI-логика, это место можно заменить framework-слоем.
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">A</span>
          <div>
            <strong>anton415 OS</strong>
            <span>modular monolith</span>
          </div>
        </div>
        <nav class="module-nav">
          ${renderModuleNav()}
        </nav>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">Step 2 foundation</p>
            <h1>Platform shell</h1>
          </div>
          ${renderHealthBadge(options.healthState)}
        </header>

        <section class="status-panel" aria-live="polite">
          <div>
            <p class="section-label">Backend connectivity</p>
            ${renderHealthDetails(options.healthState, options.apiBaseUrl)}
          </div>
          <button class="icon-button" type="button" id="refresh-health" aria-label="Refresh backend health" title="Refresh backend health">
            &#8635;
          </button>
        </section>

        <section class="module-grid" aria-label="Product module placeholders">
          ${renderModuleCards()}
        </section>
      </main>
    </div>
  `;

  root.querySelector("#refresh-health")?.addEventListener("click", options.onRefreshHealth);
}

function renderModuleNav(): string {
  return productModules
    .map(
      (module) => `
        <a href="${module.path}" data-route="${module.path}">
          <span class="nav-swatch" style="background: ${module.accent}"></span>
          ${module.name}
        </a>
      `
    )
    .join("");
}

function renderModuleCards(): string {
  return productModules
    .map(
      (module) => `
        <article class="module-card">
          <div class="module-card-header">
            <span class="module-swatch" style="background: ${module.accent}"></span>
            <h2>${module.name}</h2>
          </div>
          <p>${module.summary}</p>
          <span class="module-state">not implemented</span>
        </article>
      `
    )
    .join("");
}

function renderHealthBadge(state: HealthState): string {
  if (state.kind === "online") {
    return `<span class="health-badge health-badge-ok">API online</span>`;
  }
  if (state.kind === "offline") {
    return `<span class="health-badge health-badge-down">API offline</span>`;
  }
  return `<span class="health-badge">Checking API</span>`;
}

function renderHealthDetails(state: HealthState, apiBaseUrl: string): string {
  if (state.kind === "loading") {
    return `<h2>Checking health...</h2><p>Calling ${apiBaseUrl}/health.</p>`;
  }

  if (state.kind === "offline") {
    return `<h2>Backend unavailable</h2><p>${state.message}</p>`;
  }

  const database = state.payload.checks.database;
  return `
    <h2>${state.payload.service} is ${state.payload.status}</h2>
    <dl class="health-list">
      <div><dt>Version</dt><dd>${state.payload.version}</dd></div>
      <div><dt>Database</dt><dd>${database?.status ?? "unknown"}</dd></div>
      <div><dt>Latency</dt><dd>${database?.latency ?? "n/a"}</dd></div>
    </dl>
  `;
}
