# Технический стек

Этот документ описывает стек, который виден в репозитории сейчас. Если
репозиторий что-то не подтверждает, это помечено как TODO.

## Frontend

- Путь приложения: `apps/web`.
- Runtime: браузерное приложение на Vite.
- Язык: TypeScript 5.x.
- UI-подход: plain TypeScript rendering плюс CSS. React, Vue, Svelte или другой
  frontend-фреймворк в репозитории не видны.
- Тесты: Vitest, jsdom и Playwright smoke tests.
- Node support: Node.js 22-24 и npm 10+.

## Backend

- Путь приложения: `apps/api`.
- Язык: Go 1.25.
- Форма: модульный монолит.
- HTTP router: `github.com/go-chi/chi/v5`.
- Database driver/pool: `github.com/jackc/pgx/v5`.
- Логирование: Go `slog`.
- API style: REST endpoints под `/api/v1`.
- Текущие модули:
  - `auth`: OAuth, session cookies, email token plumbing, allowlist.
  - `todo`: проекты, задачи, иерархия, lifecycle, даты, ссылки, повторения,
    priority и flags.
  - `finance`: месячные факты доходов и расходов, категории и настройки.
  - `investments`: запланированная граница.
  - `fire`: запланированная граница.
  - `platform`: config, database, HTTP helpers, routing и logging.

## Database and Storage

- Основная база данных: PostgreSQL 16.
- Локальная база запускается через Docker Compose на host port `15432`.
- Миграции лежат в `migrations/`.
- Migration tool image: `migrate/migrate:v4.18.3`.
- Auth sessions, OAuth state, email tokens, Todo data и Finance data хранятся в
  PostgreSQL.
- Production сейчас single-owner. У Todo и Finance rows пока не видно изоляции
  по `user_id`.
- Backups: production docs и deploy assets описывают budget-first `pg_dump`
  path в Object Storage.

## Local Development

- Основные команды лежат в `Makefile`.
- `make dev` запускает Postgres, migrations, API и web.
- `make api` запускает Postgres и Go API.
- `make web` запускает Vite-приложение.
- `make test`, `make lint` и `make build` покрывают Go и frontend checks.
- `scripts/todo-integration-smoke.sh` покрывает реальный Todo smoke flow через
  API и PostgreSQL.

## Deployment

- Production image: один Docker image с Go API и собранным Vite static app.
- Runtime: Alpine-based container, порт `8080`.
- Hosting: Yandex Cloud VM.
- Reverse proxy: Caddy.
- Production database: PostgreSQL 16 в Docker на VM.
- Infrastructure: Terraform в `infra/terraform`.
- Deploy workflow: GitHub Actions собирает Linux amd64 image, пушит его в Yandex
  Container Registry, запускает migrations, перезапускает VM Compose stack и
  проверяет `/health`.
- Secrets: production docs ссылаются на Yandex Lockbox и env files в
  `/opt/anton415-hub`.

## AI-related tooling

- Runtime LLM или AI product integration в коде приложения не видны.
- Репозиторий использует AI-assisted engineering practices:
  - feature issues включают mini-spec и review focus for Codex;
  - pull requests включают Codex review gate;
  - docs описывают GitHub как source of truth для AI-assisted development.
- Планируемое направление обучения: spec-driven development, coding agents,
  developer automation и internal engineering platform ideas.
- TODO: verify, должен ли будущий AI work оставаться developer-facing или стать
  product feature.

## Unknowns

- TODO: verify текущий production release target перед обновлением release docs.
- TODO: verify, являются ли GitHub, VK и email magic-link auth production-ready
  или только частично подключены.
- TODO: verify текущий статус backup restore drill.
- TODO: verify желаемую первую data model для Investments.
- TODO: verify желаемую первую calculation model для FIRE.
