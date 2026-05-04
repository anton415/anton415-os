# anton415 Hub Redesign v1

## Direction

The v1 visual direction is a calm, dense working interface for daily task execution and monthly finance review. It should feel like an internal operating tool: quiet, readable, fast to scan, and consistent across modules.

Canva concept direction:

- Mood: focused workspace, personal command center, calm operational dashboard.
- Palette: quiet neutral surfaces, ink text, restrained blue primary, emerald success, amber warning, rose danger, violet future-module accent.
- Typography: system sans-serif with compact headings, numeric tables aligned for scanning, no hero-scale type inside work surfaces.
- Density: compact rows, clear section rhythm, low decoration, strong focus states.
- Visual references to collect in Canva: productivity sidebars, finance tables, compact admin dashboards.

## Figma Handoff Contract

Figma file: `anton415 Hub Redesign v1`

Pages:

- `Foundations + Components`: color, typography, spacing, radius, shadow and focus tokens plus component previews.
- `Screens / Capture`: browser-captured desktop/mobile Home, Todo, Finance Expenses, Finance Income and Finance Settings screens.
- `Handoff`: implementation notes, responsive rules and CSS variable contract.

CSS token contract:

- `--color-*` for surfaces, text, borders, accents and status colors.
- `--space-*` for layout rhythm and component padding.
- `--radius-*` for card, control and pill radii.
- `--shadow-*` for panels and drawers.
- `--font-*` for body and numeric table text.

## Screen Requirements

Home:

- Stable product shell with module cards.
- Real modules marked as active/implemented.
- Investments and FIRE shown as future boundaries, not full screens.

Todo:

- Compact smart-list and project sidebar.
- Project nesting must remain readable with long names.
- Archive section must not force row actions to overflow.
- Task creation stays inline, advanced task details stay in a drawer.
- Search/filter panel stays collapsible.

Finance:

- Expenses, income and settings use the same tab and year-control language.
- Metric cards summarize the table before the dense rows.
- Monthly rows are dense and readable with numeric fields.
- Limit states are visible but not noisy.

## States

Every component needs these states in Figma and CSS where applicable:

- default
- hover
- focus-visible
- disabled
- loading
- empty
- error

## Responsive Rules

- Desktop shell uses left module navigation plus a constrained workspace.
- Todo desktop uses a fixed-width local panel plus flexible main list.
- Finance desktop keeps tables scrollable within the content surface instead of expanding the page.
- Mobile collapses app navigation and Todo panel, stacks controls, and must not create horizontal document overflow.
