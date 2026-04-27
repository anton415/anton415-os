# Changelog

All notable changes to `anton415-os` are summarized here. Releases follow the shape of the product rather than a public API compatibility contract.

## v0.1.0 - 2026-04-27

### Production

- Launched the private Todo app at `https://todo.anton415.ru`.
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
