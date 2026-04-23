# Architecture

## Direction

`anton415-os` should start as a Go modular monolith.

This keeps the system easy to run, reason about, test, and change while the product shape is still being discovered. The project can still be designed with strong internal module boundaries, but it should not pay the operational cost of microservices before there is a concrete reason.

## Why modular monolith first

- The product is for one user.
- The early risk is unclear product shape, not service scale.
- A single process and repository make refactoring cheaper.
- Strong package boundaries can preserve future extraction options.
- Deployment should stay simple until there is useful product behavior to deploy.

## Planned module boundaries

- `todo`: owns tasks, task workflow state, and personal execution workflows.
- `finance`: owns personal financial records, categories, balances, and finance-specific rules.
- `investments`: owns investment accounts, positions, performance tracking, and investment-specific rules.
- `fire`: owns FIRE assumptions, projections, progress calculations, and long-term planning views.

The exact package layout is intentionally postponed until implementation begins. Step 1 defines the intended boundaries, not the final directory tree.

## Dependency rules

- Modules should communicate through explicit interfaces or application-level orchestration, not by reaching into each other's internals.
- Shared code must stay small and boring: primitives, common errors, time/money helpers, and cross-cutting utilities only when they are proven necessary.
- Domain rules belong to the module that owns the domain.
- The `fire` module may depend on explicit outputs from `finance` and `investments`, but it should not own their source data.
- Do not introduce service boundaries, queues, RPC, or distributed deployment patterns until extraction is justified.

## Source-of-truth rules

- Active implementation decisions live in `anton415-os`.
- Roadmap and architecture changes should update documentation in this repository.
- Legacy repositories may inform decisions, but they do not define current behavior.
- The portfolio site may describe progress publicly, but it does not replace repository documentation.

## Microservice-ready seams

Microservice-ready seams mean clear internal ownership, explicit interfaces, and limited coupling inside the monolith.

They do not mean creating services, network APIs, deployment units, event buses, or distributed data ownership in advance. A module should only become a service later if there is a concrete reason such as independent scaling, deployment, reliability, or ownership pressure.

## Postponed until later

- Backend implementation
- Frontend implementation
- Database schema design
- Yandex Cloud deployment scripts
- CI/CD setup
- Microservices
- Legacy code migration
- Detailed package layout
