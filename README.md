# anton415-os

## Overview

`anton415-os` is the active flagship engineering repository for the `anton415` personal software system.

The project is intended to become a single-user Go-based modular monolith for managing practical personal workflows: tasks, personal finance, investments, and FIRE tracking. This repository is the source of truth for future implementation decisions, architecture, roadmap, and product work.

Current status: Step 1 foundation stage. The repository is being framed before product code, infrastructure, database design, or deployment setup is added.

## Why this repository exists

Older repositories contain useful history, but they are no longer the active center of development. This repository exists to remove ambiguity:

- one active engineering source of truth
- one roadmap for future implementation
- one architecture direction
- one place to decide what should be reused from older work

The portfolio site remains the public surface for writing, project updates, and devlog-style communication. It is not the engineering source of truth.

## Planned modules

The first-class future modules are:

- `todo`: task and personal workflow management
- `finance`: personal finance tracking
- `investments`: investment tracking and analysis
- `fire`: FIRE progress tracking and long-term planning

These modules should start inside one Go modular monolith. A future service split is only acceptable through controlled extraction after the monolith has clear internal boundaries and real operational pressure.

## Principles

- Build for one real user first.
- Keep the architecture understandable and maintainable.
- Prefer a Go modular monolith before introducing service boundaries.
- Treat module boundaries as real even while code lives in one process.
- Do not migrate old code mechanically.
- Keep public communication separate from engineering source of truth.
- Postpone infrastructure until there is product behavior worth deploying.

## Current status

Step 1 is documentation-only. It establishes project identity, repository roles, migration rules, and initial architecture boundaries.

No backend, frontend, database schema, deployment scripts, CI/CD, or product implementation belong in this step.

## Related repositories

| Repository | Role |
| --- | --- |
| `anton415/anton415-os` | Active flagship engineering repository and source of truth. |
| `anton415/mindful-finance` | Legacy reference for finance-related ideas, requirements, workflow lessons, and historical context. |
| `anton415/todo` | Legacy reference for todo-related ideas, requirements, workflow lessons, and historical context. |
| `anton415/anton415.github.io` | Active public portfolio/blog surface, not the engineering source of truth. |

## Roadmap pointer

The initial staged roadmap lives in [docs/roadmap.md](docs/roadmap.md).
