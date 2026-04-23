# anton415-os

`anton415-os` is the active flagship engineering repository and source of truth for the `anton415` personal software platform.

Current status: Step 2 platform foundation. The repository now contains a small modular monolith skeleton with a Go API, a lightweight web shell, local PostgreSQL, migrations, Docker Compose runtime, Make targets, CI, and documentation.

No real Todo, Finance, Investments, or FIRE business logic exists yet.

## Repository strategy

`anton415-os` is the main engineering monorepo and source of truth.
By default, all product modules live inside this repository.
Separate repositories are not introduced during the modular monolith stage.

### When monorepo remains the default

Monorepo remains the default while:

- modules share one deployment unit
- modules share one development lifecycle
- cross-module changes are common
- one-user operation favors simplicity over distribution
- no strong operational boundaries exist yet

### When separate repositories may be justified

Splitting into separate repositories is considered only during controlled extraction, and only if one or more strong reasons exist, such as:

- an independently deployable module
- different operational requirements or SLA
- a stable API boundary
- clearly different change cadence
- monorepo coordination becoming a real bottleneck
- meaningful product or portfolio value from extraction

Separation should never happen only for cosmetic microservices practice.

## Planned modules

- `todo`: task and personal workflow management
- `finance`: personal finance tracking
- `investments`: investment tracking and analysis
- `fire`: FIRE progress tracking and long-term planning

These are bounded contexts inside one modular monolith. They are not separate deployable services at this stage.

## Local development

Prerequisite: Docker Compose. Local Go is optional; Make uses local Go when available and otherwise falls back to the Go Docker image.

```sh
cp .env.example .env
make migrate-up
make dev
```

Local URLs:

- Web shell: `http://localhost:5173`
- API health: `http://localhost:8080/health`
- API user stub: `http://localhost:8080/api/v1/me`
- PostgreSQL: `localhost:15432`

Useful commands:

```sh
make dev          # start Postgres, API, and web shell
make api          # start Postgres and API
make web          # start the web shell locally with npm
make stop         # stop local Docker services
make test         # run Go tests
make lint         # run Go format/vet checks and frontend typecheck
make build        # build API and frontend
make migrate-up   # apply database migrations
make migrate-down # roll back one database migration
make docker-config
```

More setup detail lives in [docs/dev-setup.md](docs/dev-setup.md).

## Simple development cycle

Простой цикл обновления приложения во время разработки:

```sh
# 1. Написал или изменил код.

# 2. Проверил, что проект собирается и тесты проходят.
make lint
make test
make build

# 3. Если менялись миграции, применил их.
make migrate-up

# 4. Запустил приложение локально.
make dev

# 5. Остановил приложение.
# Если make dev запущен в текущем терминале, сначала нажми Ctrl+C.
make stop
```

Если нужно быстро проверить только backend:

```sh
make api
```

Если нужно быстро проверить только frontend shell:

```sh
make web
```

## Current structure

```text
apps/
  api/                 Go API entrypoint
  web/                 Vite TypeScript web shell
internal/
  platform/
    config/            Environment-based configuration
    db/                PostgreSQL pool bootstrap
    http/              Router, health endpoint, middleware
    logging/           Structured logging setup
  todo/                Todo bounded-context placeholder
  finance/             Finance bounded-context placeholder
  investments/         Investments bounded-context placeholder
  fire/                FIRE bounded-context placeholder
migrations/            Database migrations
docs/                  Architecture, roadmap, setup, migration policy
.github/workflows/    CI foundation
docker-compose.yml     Local runtime
Makefile               Developer commands
```

## What Step 2 established

- Go backend skeleton with `chi`, `pgx`, `slog`, graceful shutdown, config via env, CORS, request logging, `/health`, and `/api/v1/me`
- PostgreSQL local runtime and initial platform-only migration
- Frontend shell with module placeholders and backend health indicator
- Docker Compose and Make targets for day-to-day development
- CI foundation for backend and frontend checks
- Explicit modular monolith structure and repository strategy documentation

## What still does not exist

- Todo application behavior
- Finance domain behavior
- Investment import, sync, or analysis
- FIRE calculations
- Authentication or authorization
- Cloud deployment
- Message broker
- Microservices

## Roadmap pointer

The staged roadmap lives in [docs/roadmap.md](docs/roadmap.md). Step 3 should be the first real domain vertical slice, most likely the Todo module.
