# Architecture Snapshot — May 2026

> Снимок архитектурного состояния `anton415-hub` на 2026-05-16 (HEAD `ea6639b`).
> Цель — зафиксировать тип архитектуры, слои, стек, точки входа и риски,
> чтобы при следующей итерации (Investments / FIRE) можно было сверяться с базой.
>
> Парный документ — [`architecture-deep-review-2026-05.md`](architecture-deep-review-2026-05.md)
> (оценка по SOLID / связности / паттернам / графу зависимостей / масштабируемости).

## 1. Тип архитектуры

**Модульный монолит** (Go) + отдельный SPA-фронтенд (TypeScript / Vite), которые
деплоятся как один Docker-образ за Caddy на одной VM.

Внутри `internal/` — чёткие DDD-границы: каждый продуктовый модуль (`auth`,
`todo`, `finance`, `fire`, `investments`) живёт по гексагональной схеме
`domain → application → adapters`.

Это осознанное решение, зафиксированное в [`docs/architecture.md`](architecture.md)
и `README.md`: «splits only when operational boundary justifies it».

## 2. Слои и их границы

```
apps/api/main.go            ← composition root (DI вручную)
        │
        ▼
internal/platform/          ← cross-cutting (config, db, http, httpjson, logging)
        │
        ▼
internal/{module}/
   ├── domain/              ← модели + ошибки, без внешних зависимостей
   ├── application/         ← use-cases, оркестрация
   └── adapters/            ← HTTP-handlers + PostgreSQL-repository
```

Зависимости направлены строго **внутрь** (adapters → application → domain).
Между модулями циклов нет — каждый самодостаточен и взаимодействует только
через `platform/`.

## 3. Технологический стек

### Backend
- **Go 1.25.0** (`go.mod`)
- `github.com/go-chi/chi/v5` **v5.2.5** — HTTP-роутер
- `github.com/jackc/pgx/v5` **v5.9.2** — PostgreSQL-драйвер (без ORM, чистый SQL)
- `log/slog` — структурное логирование (stdlib)

### Frontend (`apps/web`)
- **Vite 6.3.3**, **TypeScript 5.8.3**
- Тесты: **Vitest 3.2.4**, **Playwright 1.59.1**
- UI-фреймворк (React/Vue/Svelte) в `package.json` отсутствует — vanilla TS

### Инфраструктура
- **PostgreSQL 16** (Alpine)
- **Caddy** (HTTPS, prod)
- Multi-stage Dockerfile (Node 24 → Go 1.25 → Alpine 3.21)
- **Yandex Cloud** + Terraform (`infra/terraform`)
- Миграции — `golang-migrate`, 10 файлов
  (последняя — `000010_todo_hierarchy_archive_recurrence`)

## 4. Точки входа

Единственная — [`apps/api/main.go`](../apps/api/main.go) (~82 LOC):

- Слушает `$HTTP_ADDR` (default `:8080`)
- Конфиг — только из env (12-factor)
- Postgres pool с 10 s timeout
- Graceful shutdown по SIGTERM / SIGINT
- Внедряет `config + pool + logger` в chi-router

API смонтирован под `/api/v1` ([`internal/platform/http/router.go:64`](../internal/platform/http/router.go));
включены middleware `RequestID`, `RealIP`, `Recoverer`.

Отдельных воркеров, CLI-команд и других бинарей нет — всё через один
HTTP-процесс.

## 5. Риски и точки внимания

> Это не «срочно чинить», а места, где у архитектуры самая большая
> хрупкость относительно её текущей зрелости.

| # | Наблюдение | Почему важно |
|---|---|---|
| 1 | **Frontend без UI-фреймворка** | Vanilla TS ок для текущего объёма, но рост UI приведёт к ручной DOM-логике и дублированию. Стоит зафиксировать порог сложности, после которого вводим фреймворк. |
| 2 | **Placeholder-модули** `fire/`, `investments/` (только `doc.go`) | «Архитектурные обещания» имеют свойство устаревать раньше, чем реализуются. Нужны явные даты или удаление из дерева. |
| 3 | **DI вручную в `main.go`** | На 5 модулях идеально. На 8–10 — composition root начнёт пухнуть. Заранее договориться о пороге для суб-конструкторов. |
| 4 | **Один Postgres, бэкап через `pg_dump`** | Для single-owner допустимо, но **RPO / RTO нигде не зафиксированы** — это место, где «привычка» легко превращается в потерю данных. |
| 5 | **Auth = allowlist по одному email** | По `README.md` это «temporary». Классический временный костыль; нужен явный пункт в roadmap с дедлайном. |
| 6 | **SPOF на уровне процесса** | Auth, todo, finance и будущие fire/investments — один бинарь. `middleware.Recoverer` уже включён ([router.go:60](../internal/platform/http/router.go)), панику он погасит, но любой `os.Exit`, `runtime.Goexit` или OOM кладут весь хаб. Health-check уровня модуля + перезапуск процесса по systemd — следующий шаг. |

## 6. Вердикт

Архитектура **зрелая и осознанная для своей стадии** (single-owner
productivity hub). Это не «монолит, который надо распиливать», а
правильно собранный модульный монолит.

Главные риски — **операционные** (бэкапы, auth-allowlist, версионирование
API, recoverer), а не структурные. Структурно репозиторий готов к
добавлению модулей `investments` и `fire` без рефакторинга платформы.
