# Roadmap

## v1 goal

The v1 goal is a maintainable single-user Go modular monolith that supports four practical areas:

- todo management
- personal finance tracking
- investment tracking
- FIRE progress tracking

The first version should prioritize clear workflows, reliable data ownership, and understandable module boundaries over broad feature coverage.

## Constraints

- `anton415-os` is the active source of truth for roadmap and implementation.
- The initial architecture is a Go modular monolith.
- Product modules live inside this monorepo by default.
- Separate repositories are only considered during controlled extraction with strong justification.
- The future deployment target is Yandex Cloud.
- Existing repositories are references only.
- The product is designed for one real user first.

## Repository strategy

Monorepo remains the default while:

- modules share one deployment unit
- modules share one development lifecycle
- cross-module changes are common
- one-user operation favors simplicity over distribution
- no strong operational boundaries exist yet

Splitting into separate repositories may be justified only during controlled extraction, and only for strong reasons such as an independent deploy lifecycle, different operational or SLA needs, stable API boundary, clearly different change cadence, real monorepo coordination bottleneck, or meaningful product or portfolio value.

## Implementation sequence

### Step 1: Repository foundation

Status: complete.

Purpose: establish repository identity, source-of-truth rules, roadmap direction, architecture boundaries, and migration policy.

Done means:

- the repository clearly identifies itself as the active flagship project
- old repositories have documented roles as references
- architecture direction is documented without implementation leakage
- future work can start without repo identity confusion

### Step 2: Platform foundation

Status: complete.

Purpose: establish the boring engineering base for the future modular monolith without implementing product behavior.

Done means:

- Go backend skeleton exists
- frontend shell exists
- local PostgreSQL and migrations exist
- health check proves API and database connectivity
- config, logging, graceful shutdown, and local dev commands are in place
- CI runs basic backend and frontend checks
- module boundaries are visible in the directory structure
- docs explain local setup, structure, non-goals, and repository strategy

### Step 3: First domain vertical slice

Status: next.

Likely module: `todo`.

Purpose: build the first useful single-user workflow and validate the platform skeleton with real product behavior.

Done means:

- Todo behavior is useful for one real user
- persistence and API shape are based on actual workflow needs
- module boundaries remain clear
- frontend gains real Todo screens without turning other placeholders into fake products
- patterns introduced here are simple enough for Finance, Investments, and FIRE to reuse later

### Finance v1

Purpose: add personal finance tracking after the base application shape is proven by the Todo module.

Done means:

- finance workflows are useful without depending on legacy repository structure
- shared code remains small and justified
- finance logic has a clear boundary from todo logic
- migration from old finance work is selective and documented

### Investments + FIRE v1

Purpose: add investment tracking and FIRE progress tracking after finance concepts are stable enough to support them.

Done means:

- investment data and FIRE calculations have clear ownership
- FIRE depends on explicit inputs from finance and investments rather than bypassing module boundaries
- the product supports an end-to-end personal planning workflow
- future extraction candidates, if any, are based on real boundaries and usage

## Current non-goals

- No real Todo application logic in Step 2.
- No real financial domain logic in Step 2.
- No investment import or sync in Step 2.
- No FIRE calculations in Step 2.
- No complex auth in Step 2.
- No Yandex Cloud deployment scripts in Step 2.
- No message broker, Kubernetes, microservices, or separate repositories in Step 2.

## High-level definition of done

The first complete product version is done when a single user can manage todos, personal finances, investments, and FIRE tracking in one coherent system, with code organized as a modular Go monolith and this repository remaining the source of truth.
