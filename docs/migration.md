# Migration Policy

## Repository roles

| Repository | Current role | Source-of-truth status |
| --- | --- | --- |
| `anton415/anton415-hub` | Active flagship engineering repository for future product work. | Source of truth. |
| `anton415/mindful-finance` | Legacy reference for finance ideas, requirements, workflow lessons, and historical context. | Reference only. |
| `anton415/todo` | Legacy reference for todo ideas, requirements, workflow lessons, and historical context. | Reference only. |
| `anton415/anton415.github.io` | Active public portfolio/blog surface and possible devlog outlet. | Public surface only. |

## Core rule

Active implementation now happens only in `anton415/anton415-hub`.

Older repositories can be read, compared, and mined for lessons, but they should not continue as parallel active product centers. New architecture decisions, roadmap updates, and implementation work belong here.

`anton415/anton415-hub` remains the default monorepo during the modular monolith stage. Legacy repositories should not become active module repositories again unless a future controlled extraction is justified by real deployment, operational, cadence, API-boundary, coordination, or portfolio needs.

## What may be migrated

- Product requirements that still match the new direction.
- Workflow lessons from previous usage.
- Domain language that remains accurate.
- Edge cases discovered in older projects.
- Useful examples of what worked or failed.
- Small code ideas only after review and adaptation to the new architecture.

## What should not be migrated mechanically

- Repository structure from old projects.
- Old architecture decisions as defaults.
- Old code without understanding whether it still fits.
- Old dependencies without a current reason.
- UI or API shapes copied only because they already exist.
- Documentation that conflicts with `anton415/anton415-hub` as the source of truth.

## Migration process

When legacy material is considered for reuse:

1. Identify the source repository and the reason it is being referenced.
2. Extract the requirement, lesson, or idea in plain language.
3. Decide whether it still fits the current roadmap and architecture.
4. Reimplement or document it in `anton415/anton415-hub` using the current project boundaries.
5. Avoid preserving legacy structure unless it independently fits the new design.

## Future notice text for legacy repositories

Suggested notice for `anton415/mindful-finance` and `anton415/todo`:

> This repository is retained as a legacy reference. Active development has moved to `anton415/anton415-hub`, which is now the source of truth for roadmap, architecture, and implementation.

Suggested notice for `anton415/anton415.github.io` if needed:

> This repository is the public portfolio and writing surface for `anton415`. Engineering source-of-truth documentation and implementation for the flagship project live in `anton415/anton415-hub`.
