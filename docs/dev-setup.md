# Development Setup

## Prerequisites

- Docker Compose
- Node.js and npm if running the web shell outside Docker
- Go is optional locally because backend Make targets use local Go when available and otherwise fall back to the `golang:1.24-alpine` Docker image

## First run

```sh
cp .env.example .env
make migrate-up
make dev
```

Open:

- Web shell: `http://localhost:5173`
- API health: `http://localhost:8080/health`
- API user stub: `http://localhost:8080/api/v1/me`

`make migrate-up` starts PostgreSQL if needed and applies migrations from `migrations/`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | Runtime environment label. |
| `APP_VERSION` | `dev` | Version string returned by `/health`. |
| `HTTP_ADDR` | `:8080` | API listen address. |
| `DATABASE_URL` | local Postgres URL | API database connection string when running outside Compose. |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed browser origin for the API. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error`. |
| `SHUTDOWN_TIMEOUT` | `10s` | Graceful shutdown timeout. |
| `VITE_API_BASE_URL` | `http://localhost:8080` | API base URL used by the web shell. |

Docker Compose sets the API database host to `postgres` internally. Local processes should use `localhost:15432`.

## Common commands

```sh
make dev          # Postgres, API, and web shell
make api          # Postgres and API only
make web          # web shell through local npm
make db           # Postgres only
make stop         # stop local Docker services
make migrate-up   # apply migrations
make migrate-down # roll back one migration
make test         # Go tests
make lint         # Go formatting, go vet, frontend typecheck
make build        # API and frontend build checks
make docker-config
```

## Database

Local PostgreSQL runs in Docker Compose:

- database: `anton415_os`
- user: `anton415`
- password: `anton415`
- host port: `15432`
- container port: `5432`

The first migration creates only `platform_metadata`. Domain tables are intentionally deferred until a real vertical slice needs them.

## Troubleshooting

- If the web shell reports the API is offline, check `docker compose ps` and `docker compose logs api`.
- If migrations cannot connect, run `make db` and wait for the Postgres health check to pass.
- If port `15432`, `8080`, or `5173` is already in use, stop the conflicting process or adjust the Compose ports before starting the stack.
- If frontend dependencies behave oddly after switching between local npm and Docker, remove `apps/web/node_modules` and reinstall locally with `npm install`.
