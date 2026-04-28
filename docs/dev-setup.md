# Development Setup

## Prerequisites

- Docker Compose
- Node.js 24 and npm 11 if running the web shell outside Docker
- Go is optional locally because backend Make targets use local Go when available and otherwise fall back to the `golang:1.25-alpine` Docker image

## First run

```sh
cp .env.example .env
make dev
```

Open:

- Web app: `http://localhost:5173`
- Todo UI: `http://localhost:5173/todo`
- API health: `http://localhost:8080/health`
- API user stub: `http://localhost:8080/api/v1/me`
- Todo API: `http://localhost:8080/api/v1/todo`

`make dev` starts PostgreSQL, applies migrations from `migrations/`, and then starts the API and web shell.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | Runtime environment label. |
| `APP_VERSION` | `dev` | Version string returned by `/health`. |
| `HTTP_ADDR` | `:8080` | API listen address. |
| `DATABASE_URL` | local Postgres URL | API database connection string when running outside Compose. |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed browser origin for the API. |
| `STATIC_DIR` | empty | Optional built frontend directory served by the API in production. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error`. |
| `SHUTDOWN_TIMEOUT` | `10s` | Graceful shutdown timeout. |
| `VITE_API_BASE_URL` | `http://localhost:8080` | API base URL used by the web shell. |
| `AUTH_ALLOWED_EMAILS` | empty | Comma-separated emails allowed to sign in. |
| `AUTH_CALLBACK_BASE_URL` | `http://localhost:8080` | Public API base used for OAuth and email callbacks. |
| `AUTH_SUCCESS_REDIRECT` | `WEB_ORIGIN/todo` | Redirect after successful login. |
| `AUTH_FAILURE_REDIRECT` | `WEB_ORIGIN/` | Redirect after failed login. |
| `AUTH_COOKIE_DOMAIN` | empty | Optional cookie domain for sharing production auth across `anton415.ru` subdomains. |
| `AUTH_COOKIE_SECURE` | production only | Whether auth cookies require HTTPS. |
| `AUTH_DEV_BYPASS` | `false` | Local-only auth bypass; ignored when `APP_ENV=production`. |
| `AUTH_DEV_EMAIL` | `dev@localhost` | Email shown by `/api/v1/me` when the dev bypass is enabled. |
| `EMAIL_FROM`, `SMTP_*` | empty | SMTP/Postbox settings for email magic links. |
| `YANDEX_OAUTH_*`, `GITHUB_OAUTH_*`, `VK_OAUTH_*` | empty | OAuth client credentials. |

Docker Compose sets the API database host to `postgres` internally. Local processes should use `localhost:15432`.

For local browser testing without configuring OAuth or magic-link email, set `AUTH_DEV_BYPASS=true` in `.env` and restart the API. The bypass is disabled automatically in production.

## Common commands

```sh
make dev          # Postgres, migrations, API, and web shell
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

Migrations create `platform_metadata` plus Todo v1 tables:

- `todo_projects`
- `todo_tasks`

Todo v1 stores task status as text with a database check constraint. Deleting a project with tasks is blocked; move or delete the tasks first. The Todo `today` and `upcoming` views use the API server's local timezone.

Auth sessions, OAuth state, and email magic-link tokens are also stored in PostgreSQL. Todo tables remain single-user and do not include `user_id`.

## Integration smoke

To test the real local API + PostgreSQL path without configuring an OAuth provider:

```sh
AUTH_EMAIL=anton@example.com scripts/todo-integration-smoke.sh
```

The script starts local Postgres/API services, applies migrations, inserts a temporary session, creates a Todo task through HTTP, verifies it can be listed, and deletes it.

## Troubleshooting

- If the web shell reports the API is offline, check `docker compose ps` and `docker compose logs api`.
- If migrations cannot connect, run `make db` and wait for the Postgres health check to pass.
- If port `15432`, `8080`, or `5173` is already in use, stop the conflicting process or adjust the Compose ports before starting the stack.
- If frontend dependencies behave oddly after switching between local npm and Docker, remove `apps/web/node_modules` and reinstall locally with `npm install`.
