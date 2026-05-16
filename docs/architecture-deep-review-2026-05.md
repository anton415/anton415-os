# Architecture Deep Review — May 2026

> Подробный архитектурный разбор `anton415-hub` на 2026-05-16 (HEAD `ea6639b`)
> по семи измерениям: SOLID/DRY/KISS, separation of concerns, связность,
> качество абстракций, паттерны проектирования, граф зависимостей,
> масштабируемость.
>
> Парный документ — [`architecture-snapshot-2026-05.md`](architecture-snapshot-2026-05.md)
> (краткий снимок состояния, стека и операционных рисков).

## 1. SOLID / DRY / KISS

### SOLID — соблюдается зрело

| Принцип | Оценка | Где видно |
|---|---|---|
| **SRP** | сильно | Каждый пакет имеет одну роль: [`internal/todo/domain/task.go`](../internal/todo/domain/task.go) — только бизнес-правила, [`internal/todo/application/service.go`](../internal/todo/application/service.go) — оркестрация, [`internal/todo/adapters/postgres/repository.go`](../internal/todo/adapters/postgres/repository.go) — SQL. Никакой утечки между слоями. |
| **OCP** | соблюдается | Новый OAuth-провайдер добавляется через `OAuthProviderConfig` без изменения core-логики. Новый тип повтора задач — новая константа + ветка в `NextRepeatDate()`. |
| **LSP** | соблюдается | Repository-интерфейсы маленькие, реализации (postgres / in-memory mock в тестах) взаимозаменяемы. |
| **ISP** | соблюдается | Интерфейсы узкие: `ProjectRepository` и `TaskRepository` разделены, хотя обе реализованы одним struct. HTTP `Service interface` объявлен **на стороне адаптера** — идиоматичные consumer-defined interfaces. |
| **DIP** | соблюдается | Application **не импортирует** adapters: она объявляет порты, postgres зависит от application. Композиция всех зависимостей — в одном месте: [`internal/platform/http/router.go`](../internal/platform/http/router.go). |

### DRY — без перегиба

- Общая инфраструктура вынесена в `internal/platform/{config,db,http,httpjson,logging}` — `httpjson.DecodeRequest` переиспользуется обоими handler'ами.
- `OptionalInt64/String/Date/Bool/...` повторяются в application-слое, но это **сознательный шаблон** для partial-update PATCH-семантики, а не дубликат. Generic-обёртка читалась бы хуже.
- **Лёгкая опасность дублирования**: `todo` и `finance` имеют почти идентичную структуру `domain/application/adapters/{http,postgres}`. Если появится третий такой модуль (`investments`), стоит вынести `pkg/modulekit` с общими helper'ами — в первую очередь маппинг domain-ошибок → HTTP-статусов.

### KISS — образцово

- Две прямые зависимости: `chi` + `pgx`. Никакого ORM, DI-фреймворка, message bus.
- `pool.MaxConns=5` — честное признание, что приложение single-user.
- Auth собирается ~80 строками в `router.go`, без Wire / Fx.
- Domain работает только на stdlib (`time`, `fmt`, `errors`, `net/url`).

**Где можно проще**: набор `Optional*` структур — потенциальный кандидат на единичный `Optional[T any] struct { Set bool; Value T }`. Не критично — текущий код ясен.

## 2. Separation of Concerns

Жёстко выдержанная hexagonal-схема:

```
┌─ HTTP adapter ─────────┐     ┌─ Postgres adapter ─┐
│ JSON DTO ↔ application │     │ SQL ↔ application  │
└──────────┬─────────────┘     └─────────┬──────────┘
           │ Service interface           │ Repository interface
           ▼                             ▼
        ┌──────── application/service.go ────────┐
        │ use-cases, валидация цепочек, фильтры │
        └─────────────────┬──────────────────────┘
                          │
                          ▼
              ┌── domain (pure Go) ──┐
              │  Task, Project,      │
              │  Money, Percent      │
              └──────────────────────┘
```

**Что хорошо:**
- HTTP DTO **не утекают** в application (отдельные `taskRequest` / `taskResponse` против `CreateTaskInput`).
- Domain-метод `Task.CompleteOrAdvanceRepeat(now)` — бизнес-логика инкапсулирована в агрегате, а не размазана по сервису.
- Auth изолирован в свой модуль с собственными портами (`Repository`, `MagicLinkSender`), не лежит в platform.

**Зона риска:**
- `internal/platform/http/router.go` знает обо **всех** модулях — это и есть Composition Root. При росте до 6–8 модулей файл начнёт пухнуть; стоит заранее договориться о вынесении wiring каждого модуля в `internal/{module}/wiring.go`, чтобы router только включал маршруты.

## 3. Coupling / Cohesion

### Cohesion — высокая

- Внутри `todo/domain/task.go` всё про Task. 492 строки, но каждый метод про один аспект (`SetX`, `ValidateX`, `NextRepeatDate`). Можно разнести на `task.go` + `task_repeat.go` + `task_validation.go`, но не критично.
- `finance/domain/money.go` — образцовый value object: всё, что про Money — здесь.

### Coupling — низкое и направленное

- **Domain никого не импортирует** (кроме stdlib).
- **Application** импортирует только `domain` своего модуля.
- **Adapters** импортируют свой `application` + `domain` + внешний драйвер.
- **Модули между собой не пересекаются** — `todo` ничего не знает про `finance`. Кросс-модульная оркестрация поднимется в композицию, когда понадобится.

Единственная общая «лужа» — `internal/platform/`, но она по дизайну cross-cutting и тонкая (config + db + router skeleton + logging).

## 4. Слой абстракции

### Что хорошо

- **Repository-порты в application-слое** — каноничная инверсия зависимостей.
- **Value Objects** (`Money`, `Percent`, `TaskStatus`, `RepeatFrequency`) — типобезопасность, immutable, бизнес-инварианты в конструкторах. `Money` в копейках через `int64` — никакого float drift.
- **Consumer-defined interfaces** для HTTP-handler'а — Go best practice: интерфейс принадлежит потребителю.
- **Optional pattern** для PATCH корректно отличает `not set` от `set to null`.

### Где абстракция слабее

- **Нет явного transaction boundary** в application. Если `CreateTask` должна затрагивать несколько таблиц атомарно, текущий `TaskRepository` не предоставляет UnitOfWork / `Tx`. Будущая боль — стоит ввести `Transactor interface { WithTx(ctx, fn func(ctx) error) error }` в `platform/`.
- **Error mapping** домен → HTTP реализован в каждом адаптере (`writeError`). Можно вынести в `platform/httpjson` общий маппер с реестром ошибок.
- **Нет логирования внутри application/domain** — `slog` есть только в HTTP middleware. Бизнес-события (создание задачи, archival project) не логируются.

## 5. Паттерны проектирования

### Используемые

| Паттерн | Где |
|---|---|
| **Hexagonal / Ports & Adapters** | весь `internal/{todo,finance,auth}` |
| **Repository** | `application/service.go` — интерфейсы; `adapters/postgres/repository.go` — реализация |
| **Constructor Injection** | `router.go` (~строки 80–95), `NewService`, `NewRepository`, `NewHandler` |
| **Value Object** | `Money`, `Percent`, `TaskStatus`, `Priority` |
| **Aggregate Root + Domain Method** | `Task.CompleteOrAdvanceRepeat`, `Project.Archive` |
| **Dependencies struct** | `application.Dependencies{Projects, Tasks, Now, Location}` — удобнее, чем длинный список параметров |
| **Middleware chain** | chi-pipeline в `router.go` |
| **Functional clock injection** | `Now func() time.Time` — детерминизм в тестах |
| **DTO-разделение** | HTTP `taskRequest` ≠ application `CreateTaskInput` ≠ domain `NewTaskInput` |

### Рекомендуемые к добавлению

1. **Unit of Work / Transactor** — для атомарных мульти-табличных операций (см. п. 4).
2. **Domain Events** — `task.Completed`, `task.Created` как простой in-process channel. Не нужно прямо сейчас, но когда появится напоминалка (миграция `000004_reminders_todo` уже её предсказывает) — пригодится.
3. **Specification / Query Object** — `TaskListFilter` уже почти Specification; можно явно ввести при расширении фильтрации.
4. **Outbox** — если когда-нибудь появится отправка событий наружу (email, push). Сейчас рано.
5. **Result / Either type** — нет, идёт против идиоматичного Go.

## 6. Граф зависимостей

**Циклических импортов нет.** Граф строго направленный:

```
main.go
   └─→ platform/http/router.go  (Composition Root)
         ├─→ platform/{config, db, logging}
         ├─→ auth/*
         ├─→ todo/adapters/{http, postgres} ─→ todo/application ─→ todo/domain
         └─→ finance/adapters/{http, postgres} ─→ finance/application ─→ finance/domain
```

Ключевые свойства:
- `domain` — листья графа (in-degree 0 снаружи stdlib).
- `application` зависит только от своего `domain`.
- `adapters` зависят от своего `application` + внешних драйверов (`chi`, `pgx`).
- `platform/http` зависит от всего — единственная «толстая» точка, и это правильно (Composition Root).
- **Модули `todo` / `finance` / `auth` друг друга не видят** — будущая разрезка на сервисы возможна без перетасовки кода.

## 7. Масштабируемость архитектуры

### Что выдержит без переписывания

- **Новые модули** (investments, fire): шаблон отработан, копируется на 90%.
- **Замена БД или добавление кэша**: новый адаптер за тем же портом, application и domain не трогаются.
- **Извлечение модуля в отдельный сервис**: границы готовы — нужна сериализация портов (gRPC / HTTP) и transactional outbox, домен и application переезжают целиком.
- **Смена web-фронта** на React / Solid: фронт изолирован, бэк отдаёт чистый REST.

### Что упрётся в потолок

| Проблема | Когда станет блокером | Решение |
|---|---|---|
| **Multi-user** | как только понадобится | Добавить `OwnerID` во все агрегаты, фильтр в каждом запросе, middleware кладёт owner в `ctx`. Широкая правка, но архитектура её допускает. |
| **Pool size 5** | сразу при появлении второго пользователя | Параметризовать через config (уже читается из env). |
| **Нет транзакций в application** | при первой multi-table мутации | Ввести Transactor (см. п. 4). |
| **Router знает все модули** | при ~8+ модулях | Каждый модуль регистрирует свои routes (`module.Mount(r chi.Router, deps)`). |
| **Нет background jobs** | напоминания, повторы задач, рассылки | Завести `internal/platform/jobs` (cron + worker pool) или asynq. Миграция `000004_reminders_todo` уже намекает. |
| **Нет API versioning стратегии** | breaking changes для внешних клиентов | Сейчас `/api/v1` хардкод — нормально для single-user. |
| **Нет audit trail / event log** | при требовании compliance / undo | Domain Events + event store. |
| **Auth = single-owner enum проверка** | как только нужен второй пользователь | Документировано в `architecture.md` как осознанный gate. |

### Общий вердикт по масштабируемости

Архитектура **намеренно настроена на single-user**, но границы и паттерны выбраны так, что переход к multi-user / multi-tenant / микросервисам — это **дополнения**, а не переписывание. Правильный trade-off: код не over-engineered под несуществующие требования, но готов к эволюции.

## Итого

**Сильные стороны:** чистые границы модулей, нет циклов, domain pure, паттерны идиоматичны для Go, минимум зависимостей, явный Composition Root.

**Главные риски на горизонте:** отсутствие transaction boundary в application, отсутствие background-jobs runtime (нужен для reminders), и масштабный refactor под multi-user (сознательно отложен и описан в [`docs/architecture.md`](architecture.md)).

**Оценка зрелости архитектуры:** высокая. Для single-user продуктивного хаба — местами даже избыточно строго, что задаёт долговременную дисциплину. Аналогия: это «монолит в стиле Ports & Adapters», который при росте мирно превратится в 3–4 сервиса без революции.
