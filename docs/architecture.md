# Architecture

## Direction

`anton415-os` starts as a Go modular monolith.

The product is for one user, so the early engineering priority is low-stress development, clear boundaries, and easy local operation. The repository should preserve future extraction options through package ownership and explicit interfaces, not by adding distributed-system machinery before it is needed.

## Current platform shape

Step 2 establishes the platform skeleton:

```text
apps/
  api/                 Go HTTP API process
  web/                 Lightweight web shell
internal/
  platform/            Cross-cutting platform code
  todo/                Todo boundary marker
  finance/             Finance boundary marker
  investments/         Investments boundary marker
  fire/                FIRE boundary marker
migrations/            Database migrations
```

The API is one process. Product modules are packages inside the same Go module. The frontend is one shell that exposes navigation placeholders and backend connectivity, not product workflows.

## Platform responsibilities

- `internal/platform/config`: environment-based configuration
- `internal/platform/db`: PostgreSQL connection pool bootstrap
- `internal/platform/http`: router, middleware, health check, and minimal platform endpoints
- `internal/platform/logging`: structured logging setup

Platform code should stay boring and cross-cutting. It must not accumulate domain rules for Todo, Finance, Investments, or FIRE.

## Planned module boundaries

- `todo`: owns tasks, task workflow state, and personal execution workflows.
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

`anton415-os` is the main engineering monorepo and source of truth. Modules live inside this repository by default.

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

## Microservice-ready seams

Microservice-ready seams mean clear internal ownership, explicit interfaces, and limited coupling inside the monolith.

They do not mean creating services, network APIs, deployment units, event buses, or distributed data ownership in advance. A module should only become a service later if controlled extraction is justified by real deployment, reliability, scaling, cadence, or portfolio needs.

## Postponed until later

- Real Todo business logic
- Real Finance business logic
- Real Investments business logic
- Real FIRE business logic
- Complex auth
- Yandex Cloud deployment
- Message broker
- Kubernetes
- Microservices
