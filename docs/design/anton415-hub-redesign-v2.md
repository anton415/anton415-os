# anton415 Hub Redesign v2

## Direction

Redesign v2 resets the UI around a Daily Center model. The app should feel like a compact native desktop utility: a left launcher rail, a command/action bar, focused work panels, dense lists, spreadsheet-like finance surfaces, and inspector drawers for secondary details.

Figma file: https://www.figma.com/design/1kkxPGqaJzY4sNbWoWb9cO/anton415-Hub-Redesign-v1

V2 pages:

- `v2 / 00 Product Map`
- `v2 / 01 Tokens`
- `v2 / 02 Components`
- `v2 / 03 Desktop`
- `v2 / 04 Mobile`
- `v2 / 05 QA Notes`

## Implementation Contract

- No backend, schema, or route changes.
- Home reads existing Todo and Finance endpoints and renders today's focus, overdue tasks, flagged tasks, and a finance snapshot.
- Todo preserves smart lists, project hierarchy, archive controls, search/sort, task hierarchy, URL, repeat, priority, and inspector drawers.
- Finance preserves expenses, income, and settings flows while moving the visual model to a spreadsheet workspace.
- Test anchors stay stable: `#task-form`, `#task-settings-panel`, `#finance-year-form`, `data-todo-*`, and `data-finance-*`.

## QA Notes

- Desktop checked: login/home/todo/finance expenses/income/settings.
- Mobile checked at 390px: home/todo/finance expenses.
- Finance tables scroll inside their panel instead of expanding the document.
- Investments and FIRE remain polished placeholders.
