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
- The future deployment target is Yandex Cloud.
- Existing repositories are references only.
- The product is designed for one real user first.

## Non-goals

- No backend implementation in Step 1.
- No frontend implementation in Step 1.
- No database schema design in Step 1.
- No Yandex Cloud deployment scripts in Step 1.
- No CI/CD setup in Step 1.
- No microservice setup in Step 1.
- No mechanical migration from legacy repositories.

## Implementation sequence

### Foundation

Purpose: establish repository identity, source-of-truth rules, roadmap direction, architecture boundaries, and migration policy.

Done means:

- the repository clearly identifies itself as the active flagship project
- old repositories have documented roles as references
- architecture direction is documented without implementation leakage
- future work can start without repo identity confusion

### Todo v1

Purpose: build the first useful module and validate the repository structure, Go application shape, and development workflow with the smallest product surface.

Done means:

- todo workflows are useful for a single user
- module boundaries are visible in code
- persistence and interfaces are chosen based on actual product needs
- the implementation establishes patterns that later modules can reuse

### Finance v1

Purpose: add personal finance tracking after the base application shape is proven by the todo module.

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

## High-level definition of done

The first complete product version is done when a single user can manage todos, personal finances, investments, and FIRE tracking in one coherent system, with code organized as a modular Go monolith and this repository remaining the source of truth.
