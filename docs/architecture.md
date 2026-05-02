# Architecture

## Direction

anton415 Hub starts as a Go modular monolith.

The product is for one user, so the early engineering priority is low-stress development, clear boundaries, and easy local operation. The repository should preserve future extraction options through package ownership and explicit interfaces, not by adding distributed-system machinery before it is needed.

## Current platform shape

Step 3 keeps the same single-process platform shape and adds Todo as the first real product module:

```text
apps/
  api/                 Go HTTP API process
  web/                 Lightweight web shell
internal/
  platform/            Cross-cutting platform code
  auth/                Single-user auth, sessions, OAuth, and email magic links
  todo/                Todo domain, use cases, HTTP, and persistence
  finance/             Finance domain, use cases, HTTP, and persistence
  investments/         Investments boundary marker
  fire/                FIRE boundary marker
migrations/            Database migrations
```

The API is one process. Product modules are packages inside the same Go module. The frontend is one shell with real Todo and Finance workflows and placeholders for Investments and FIRE.

## Platform responsibilities

- `internal/platform/config`: environment-based configuration
- `internal/platform/db`: PostgreSQL connection pool bootstrap
- `internal/platform/http`: router, middleware, health check, and minimal platform endpoints
- `internal/platform/logging`: structured logging setup

## Auth boundary

Step 4 adds `internal/auth` as a platform-adjacent bounded module for single-user access control.

- Auth owns OAuth state, email magic-link tokens, server-side sessions, cookie issuance, and allowlist checks.
- Todo routes are protected by auth middleware, but Todo data remains single-user and does not receive `user_id` in this stage.
- Provider access tokens are used only during callback handling and are not stored.
- VK ID is treated conservatively: if a reliable verified email is not available, the user must use email magic-link verification.

Platform code should stay boring and cross-cutting. It must not accumulate domain rules for Todo, Finance, Investments, or FIRE.

## Planned module boundaries

- `todo`: owns projects, tasks, task workflow state, and personal execution workflows.
- `finance`: owns personal financial records, categories, balances, and finance-specific rules.
- `investments`: owns investment accounts, positions, performance tracking, and investment-specific rules.
- `fire`: owns FIRE assumptions, projections, progress calculations, and long-term planning views.

`fire` may later depend on explicit outputs from `finance` and `investments`, but it should not own their source data.

## Dependency rules

- Domain rules belong to the module that owns the domain.
- Modules should not reach into each other's internals.
- Cross-module collaboration should happen through explicit application-level orchestration or narrow interfaces once real behavior exists.
- Shared code must remain small and justified by repeated need.
- Do not introduce queues, RPC, service discovery, distributed data ownership, or separate deployment units during the modular monolith stage.

## Repository strategy

`anton415/anton415-hub` is the main engineering monorepo and source of truth. Modules live inside this repository by default.

Monorepo remains the default while:

- modules share one deployment unit
- modules share one development lifecycle
- cross-module changes are common
- one-user operation favors simplicity over distribution
- no strong operational boundaries exist yet

Separate repositories may be considered only during controlled extraction, and only when there is real technical or operational justification. Strong trigger conditions include:

- a module has its own deploy lifecycle
- a module has its own operational or SLA needs
- a module changes at a clearly different cadence from the rest of the system
- a module already has a stable API boundary
- cross-cutting changes in the monorepo become a real coordination bottleneck
- extraction provides real product or portfolio value, not architecture theater

Until those conditions exist, splitting repositories would add cost without improving the product.

## Todo v1 boundary

Todo v1 is implemented under `internal/todo` with separate domain, application, and adapter packages.

- Domain rules validate names and titles, own task statuses, and set or clear `completed_at` during status transitions.
- Application use cases own project/task CRUD and list filter semantics.
- HTTP and PostgreSQL adapters translate transport/database details without owning business rules.
- Project deletion is restricted while tasks still reference the project.
- Todo v1 treats the API server's local timezone as the source for `today` and `upcoming` views.

## Finance v1 boundary

Finance v1 is implemented under `internal/finance` with separate domain, application, and adapter packages.

- Domain rules validate RUB money in kopecks, year/month ranges, legacy expense categories, and monthly income/expense facts.
- Application use cases own yearly snapshots, monthly upsert behavior, zero-month deletion, and annual totals.
- HTTP and PostgreSQL adapters translate transport/database details without owning business rules.
- Finance v1 intentionally excludes accounts, bank cards, transfers, balances, limits, forecasts, imports, investments, and FIRE calculations.

## Microservice-ready seams

Microservice-ready seams mean clear internal ownership, explicit interfaces, and limited coupling inside the monolith.

They do not mean creating services, network APIs, deployment units, event buses, or distributed data ownership in advance. A module should only become a service later if controlled extraction is justified by real deployment, reliability, scaling, cadence, or portfolio needs.

## Postponed until later

- Finance accounts, cards, imports, forecasts, and planning logic
- Real Investments business logic
- Real FIRE business logic
- Multi-user account modeling
- Message broker
- Kubernetes
- Microservices
