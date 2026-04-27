# anton415-os

[![CI](https://github.com/anton415/anton415-os/actions/workflows/ci.yml/badge.svg)](https://github.com/anton415/anton415-os/actions/workflows/ci.yml)
[![Deploy Production](https://github.com/anton415/anton415-os/actions/workflows/deploy.yml/badge.svg)](https://github.com/anton415/anton415-os/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/anton415/anton415-os?display_name=tag&sort=semver)](https://github.com/anton415/anton415-os/releases)
[![Go 1.25](https://img.shields.io/badge/Go-1.25-00ADD8)](https://go.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)](https://www.typescriptlang.org/)

`anton415-os` is a personal operating-system monorepo: a modular Go and TypeScript application for private productivity, finance, investments, and FIRE planning.

The first production slice is live: a private Todo app at [todo.anton415.ru](https://todo.anton415.ru), protected by Yandex ID and a single-email allowlist.

## Production Status

| Area | Status |
| --- | --- |
| Runtime | Go API and Vite frontend in one Docker image |
| Hosting | Yandex Cloud VM, Caddy HTTPS, Cloud DNS |
| Database | PostgreSQL 16 in Docker on the VM |
| Auth | Yandex ID, server-side sessions, `HttpOnly` secure cookies |
| Data model | Single-user Todo data, no `user_id` split yet |
| Backups | Budget-first monthly `pg_dump` path to Object Storage |
| Email login | Planned later; Postbox is intentionally deferred |

## Product Modules

| Module | Current scope |
| --- | --- |
| `todo` | Production Todo projects/tasks with browser UI and authenticated REST API |
| `finance` | Planned personal finance boundary |
| `investments` | Planned investment tracking and analysis boundary |
| `fire` | Planned FIRE progress and long-term planning boundary |

The repository is intentionally a modular monolith. Separate services or repositories are introduced only when an operational boundary becomes real.

## Architecture

```text
Browser
  |
  | HTTPS
  v
Caddy
  |
  v
Go API + static web bundle
  |
  v
PostgreSQL 16 in Docker
```

Core paths:

```text
apps/api/              Go API entrypoint
apps/web/              Vite TypeScript frontend
internal/auth/         OAuth, email token, allowlist, session logic
internal/todo/         Todo domain, use cases, HTTP and PostgreSQL adapters
internal/platform/     Config, database, router, logging
migrations/            SQL migrations
infra/terraform/       Yandex Cloud production infrastructure
deploy/                VM compose, Caddy, backup, and Lockbox helpers
docs/                  Architecture, production, roadmap, and operations notes
```

## Local Development

Prerequisites:

- Docker Compose
- Go 1.25, or Docker fallback through `Makefile`
- Node.js 22 for frontend work

```sh
cp .env.example .env
make dev
```

Local URLs:

| Surface | URL |
| --- | --- |
| Web app | `http://localhost:5173` |
| Todo UI | `http://localhost:5173/todo` |
| API health | `http://localhost:8080/health` |
| Session check | `http://localhost:8080/api/v1/me` |
| PostgreSQL | `localhost:15432` |

Useful commands:

```sh
make dev          # start Postgres, migrations, API, and web shell
make api          # start Postgres and API
make web          # start the Vite web shell
make stop         # stop local Docker services
make lint         # Go format/vet and frontend typecheck
make test         # Go and frontend unit tests
make build        # backend and frontend production build
make docker-build # local production container build
```

Real local API + PostgreSQL smoke:

```sh
scripts/todo-integration-smoke.sh
```

## CI/CD

Pull requests and `main` run:

- Go formatting, vet, tests, and build
- Frontend typecheck, unit tests, build, and Playwright smoke
- Production Docker image build for `linux/amd64`

Production deploys run through [Deploy Production](https://github.com/anton415/anton415-os/actions/workflows/deploy.yml), either manually or from a published GitHub Release. The workflow builds and pushes a `linux/amd64` image to Yandex Container Registry, runs migrations on the VM, recreates the app/Caddy containers, and checks `/health`.

Deployment requires GitHub environment approval and repository secrets. Details live in [docs/github-actions.md](docs/github-actions.md).

## Production Operations

The production runbook is [docs/production.md](docs/production.md). The short version:

```sh
curl -fsS https://todo.anton415.ru/health
```

Important operating rules:

- Do not commit `.env`, `*.tfvars`, service-account keys, SSH private keys, or Lockbox payload files.
- Review Terraform plans before applying anything that creates or changes paid Yandex resources.
- Keep Postbox disabled until email magic-link login is worth the extra setup and cost.
- Treat the VM disk as the first recovery line and Object Storage dumps as the independent fallback.

## Documentation

- [Architecture](docs/architecture.md)
- [Development setup](docs/dev-setup.md)
- [GitHub Actions](docs/github-actions.md)
- [Dependency updates](docs/dependency-updates.md)
- [Production runbook](docs/production.md)
- [Roadmap](docs/roadmap.md)
- [Yandex cost estimate](docs/yandex-cost-estimate.md)
- [Changelog](CHANGELOG.md)

## Release

Current release target: `v0.1.1`, a maintenance patch for the production Todo release.

Release notes are tracked in [CHANGELOG.md](CHANGELOG.md), and GitHub Releases trigger the production deployment workflow after environment approval.
