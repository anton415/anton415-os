# Changelog

All notable changes to anton415 Hub are summarized here. Releases follow the shape of the product rather than a public API compatibility contract.

## Unreleased

### Todo

- Added an optional URL field for tasks across the API, persistence layer, and Todo UI.
- Added safe external task links and kept long URLs constrained in task rows.

### Finance

- Finished the personal finance workflow polish from issue #32: separated limit categories by monthly, annual, and investment-goal usage.
- Removed noisy `0.00` prefill from empty finance inputs while keeping exact kopeck storage and API payload normalization.
- Rounded finance summary amounts to whole rubles by default and kept fractional values visible in editable fields when they exist.
- Added 100% limit allocation validation, limit amount rows, income/expense highlighting, and investment-goal progress coloring.

### Platform

- Renamed the product and repository identity from the previous OS-oriented name to anton415 Hub.
- Updated UI copy, package/module metadata, container image names, deploy paths, and production rename runbooks.
- Restricted production SSH ingress to explicit admin CIDRs and documented the break-glass deploy path.
- Added configurable rate limiting for public auth start and callback endpoints.
- Automated temporary GitHub Actions runner SSH ingress for production deploys.

## v0.2.0 - 2026-04-29

### Finance

- Added the first production Finance slice for monthly RUB income and expense tracking.
- Added authenticated Finance API routes for annual expense and income snapshots and month updates.
- Added PostgreSQL migrations for monthly expense and income actuals, with money stored in integer kopecks.
- Added Russian-language Finance UI routes for expenses, income, and settings.
- Added legacy expense categories, yearly totals, monthly averages, and category spending totals excluding transfer categories.
- Added salary, bonus percent, calculated income, and category limit settings for expense control.
- Added expense-cell status coloring against configured limits: empty, below limit, near limit, and over limit.

### Platform

- Localized the browser shell and Todo UI to Russian.
- Added frontend Finance API, formatting, render, and browser-smoke coverage.

## v0.1.1 - 2026-04-27

### Maintenance

- Raised the backend Go toolchain target from 1.24 to 1.25.
- Updated `github.com/jackc/pgx/v5` from 5.7.6 to 5.9.2 for the Dependabot security advisory covering placeholder parsing in simple-protocol queries.
- Updated `github.com/go-chi/chi/v5` from 5.2.3 to 5.2.5 as a narrow router maintenance refresh.

## v0.1.0 - 2026-04-27

### Production

- Launched the private Todo app at `https://anton415.ru/todo`.
- Added Yandex ID login with a single-email allowlist.
- Served the Go API and Vite frontend from one production Docker image.
- Deployed to Yandex Cloud with Caddy HTTPS, VM-local PostgreSQL, Lockbox-backed runtime secrets, Container Registry, Cloud DNS, and Object Storage backup scaffolding.
- Kept the first production baseline budget-first: one VM, PostgreSQL in Docker, and monthly logical backup support.

### Todo

- Added Todo projects and tasks with create, read, update, complete, and delete workflows.
- Added authenticated Todo API routes under `/api/v1/todo`.
- Added a responsive browser UI with Inbox, Today, Upcoming, Completed, and project-filtered views.

### Quality

- Added Go tests, vet and formatting checks, frontend typecheck, unit tests, production build, browser smoke, and container build checks in CI.
- Added local API + PostgreSQL Todo integration smoke coverage.
