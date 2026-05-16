# Documentation Audit — May 2026

Аудит состояния проектной документации anton415 Hub на 2026-05-16. Дополняет [docs/architecture-snapshot-2026-05.md](architecture-snapshot-2026-05.md) и [docs/architecture-deep-review-2026-05.md](architecture-deep-review-2026-05.md): архитектурные документы фиксируют *как устроен код*, этот — *как устроена документация вокруг кода*.

Отдельный документ [docs/doc-inventory.md](doc-inventory.md) уже даёт пофайловый mapping «документ → актуальность → что делать»; настоящий аудит выше уровнем и группирует находки по шести категориям: README, API, inline-комментарии, бизнес-логика, changelog/версионирование, онбординг.

## 1. README

### Есть
- Статус production, бейджи CI/Deploy/Release/Go/TS.
- Таблицы Production Status и Product Modules.
- ASCII-схема архитектуры и дерево ключевых путей.
- Локальный запуск, таблица URL, основные Make-команды.
- CI/CD, ops-правила, ссылки на docs.

### Не хватает
- Раздела **Contributing** или хотя бы ссылки из README на [docs/github-feature-ritual.md](github-feature-ritual.md) и [.github/pull_request_template.md](../.github/pull_request_template.md).
- Команд `make test-e2e` и `make test-integration` в блоке Useful commands — их требует PR-шаблон ([.github/pull_request_template.md:51-52](../.github/pull_request_template.md)).
- Полного описания auth: README говорит «protected by Yandex ID», но фактически зарегистрированы провайдеры yandex/github/vk и email magic-link ([internal/platform/http/router.go:132-160](../internal/platform/http/router.go)).

### Устарело
- [README.md:151](../README.md) — «Current release target: `v0.2.1`», но `v0.2.1` уже выпущен 2026-05-04 (`gh release list`). Цель должна указывать на следующую неотправленную версию.

## 2. API documentation

### Есть
- Перечень публичных URL в README (web + API health/me).
- Контракт восстанавливается по коду:
  - Todo: [internal/todo/adapters/http/handler.go:42-52](../internal/todo/adapters/http/handler.go)
  - Finance: [internal/finance/adapters/http/handler.go:35-40](../internal/finance/adapters/http/handler.go)
  - Auth: [internal/auth/adapters/http/handler.go:50-55](../internal/auth/adapters/http/handler.go)
- Типы фронтенда в `apps/web/src/types.ts` и `apps/web/src/*Api.ts` фактически описывают контракт.

### Не хватает
- OpenAPI/Swagger или сводного `docs/api.md` со списком endpoint → method → параметры → ответы → коды ошибок.
- Примеров `curl`/payload’ов (есть только `/health` и `/api/v1/me` в README).
- Описания общего формата ошибок (`internal/platform/httpjson`), правил фильтров (`internal/todo/application/filter.go`), формата сумм Finance (кошельковые копейки vs рубли).
- Документации rate-limit правил: env-переменные перечислены в [docs/dev-setup.md:47-49](dev-setup.md), но *что* ограничено (`/auth/{provider}/start`, `/email/start`, `/email/verify`) и какой ответ получает клиент — нет.

### Устарело
- Прямых устаревших данных нет, но отсутствие единого API-документа делает любое расхождение между фронтом и бэком невидимым до runtime.

## 3. Inline-комментарии

### Есть
- Однострочные package-doc для двух пакетов: [internal/todo/doc.go](../internal/todo/doc.go), [internal/finance/doc.go](../internal/finance/doc.go).
- Точечные комментарии в [internal/platform/http/router.go:55-56](../internal/platform/http/router.go) и `apps/api/main.go`.

### Не хватает
- Package-level doc-комментариев для `internal/auth`, `internal/platform/{config,db,http,logging}`, для подпакетов `domain`, `application`, `adapters/{http,postgres}`.
- Doc-comments на экспортируемые типы и функции — go-style требует, а сейчас их фактически нет (например, [internal/finance/domain/monthly.go](../internal/finance/domain/monthly.go), [internal/todo/application/service.go](../internal/todo/application/service.go), `internal/todo/adapters/http/handler.go`, оба `*Api.ts` во фронтенде).
- TODO/FIXME-маркеров в коде ноль — это означает не только отсутствие забытых заметок, но и отсутствие навигационных пометок к спорным местам.

### Устарело
- Существующие комментарии корректны; устаревших не найдено.

## 4. Бизнес-логика и domain-правила

### Есть
- Прозрачное разделение `domain / application / adapters` в `internal/todo` и `internal/finance`.
- Текстовые границы модулей в [docs/architecture.md](architecture.md), разделы «Todo v1 boundary», «Finance v1 boundary», «Auth boundary».
- Валидация инвариантов выражена кодом (`ValidateYear`, `ValidateMonth`, `ExpenseCategory.Valid`, статусы задач).

### Не хватает
- Доменного документа с инвариантами: деньги в копейках (внутреннее представление и API-сериализация), правила recurrence, hierarchy, archive/restore для Todo, правила лимитов и «100% allocation» для Finance.
- Описания ролей категорий (`transfer`, `legacy`) и как они исключаются из сумм.
- Описания того, как `today`/`upcoming` зависят от server-локального таймзоны (упомянуто в architecture.md, но без указания операционных последствий).

### Устарело
- [docs/architecture.md:106](architecture.md) — «Finance v1 intentionally excludes … limits», но миграция `000007_finance_settings` и UI уже содержат limits, settings, percentages и валидацию 100% allocation. Прямое противоречие.
- [docs/architecture.md:11](architecture.md) и далее — формулировки про «Step 3/Todo v1» отстают от реального скоупа: уже сделаны archive/restore проектов, delete, URL у задач, hierarchy и recurrence (миграции `000008`–`000010`, CHANGELOG `Unreleased`).

## 5. Changelog и версионирование

### Есть
- [CHANGELOG.md](../CHANGELOG.md) в стиле Keep a Changelog: Unreleased / v0.2.0 / v0.1.1 / v0.1.0, секции Todo / Finance / Platform.
- Релизы тегируются (`v0.1.0` … `v0.2.1`), GitHub Releases триггерит deploy workflow.

### Не хватает
- Явной политики версионирования: текст во вступлении CHANGELOG говорит «not a public API compatibility contract», но не определяет, что заслуживает minor vs patch.
- Связи Issue → Release: в `Unreleased` нет ссылок на issue/PR, по которым можно восстановить контекст.

### Устарело
- Раздел `Unreleased` фактически содержит изменения, **уже выпущенные как v0.2.1** (Todo task URLs, Finance limit polish) — `gh release list` показывает `v0.2.1 — Todo task URLs` от 2026-05-04. Нужен раздел `v0.2.1 — 2026-05-04` и новый «честный» `Unreleased`.
- В CHANGELOG нет записи про project archive/restore/delete (UI + API) и про hierarchy/recurrence (миграция `000010_todo_hierarchy_archive_recurrence`), хотя код есть.

## 6. Онбординг для новых разработчиков

### Есть
- [docs/dev-setup.md](dev-setup.md): env vars, команды, БД, integration smoke, troubleshooting.
- [docs/github-feature-ritual.md](github-feature-ritual.md), [docs/github-actions.md](github-actions.md), [docs/production.md](production.md).
- PR-шаблон с Review Gate, Sensitive areas, Verification и Post-release check.
- Свежий [docs/doc-inventory.md](doc-inventory.md), который сам по себе — навигация по docs/.

### Не хватает
- **CONTRIBUTING.md** (или раздела в README) с правилами стиля, ветвления, обязательными локальными командами до PR.
- **CLAUDE.md / AGENTS.md** для AI-агентов — отсутствуют, хотя проект явно используется в Claude-окружении.
- Гайда «как добавить новый модуль» (важно перед Investments/FIRE): где регистрировать роутер, шаблон доменного пакета, шаблон миграции, как добавить frontend-секцию.
- Визуальной «карты» прохождения запроса/данных — есть только текстовая стрелка в README.

### Устарело
- [docs/dev-setup.md:83-88](dev-setup.md) — раздел «Database» описывает только Todo v1 таблицы; в реальности существуют также `platform_metadata`, `auth_*`, поля Todo URL/lifecycle/hierarchy/recurrence, `finance_monthly_*`, `finance_settings`, `finance_expense_limit_settings` (см. также [docs/doc-inventory.md:11](doc-inventory.md)).
- В блоке «Common commands» нет `docker-build`, `go-mod-tidy`, `test-e2e`, `test-integration`, хотя они есть в Makefile и упоминаются в PR-шаблоне.
- [docs/roadmap.md:103-107](roadmap.md): near-term sequence (`v0.2.1`, `v0.3.0 — project lifecycle`, `v0.4.0 — hierarchy`) уже выполнен. Строка «No Yandex Cloud deployment scripts yet» в [roadmap.md:126](roadmap.md) неверна — есть `infra/terraform/` и deploy workflow.
- [docs/yandex-cost-estimate.md](yandex-cost-estimate.md) — pre-apply оценка от 2026-04-26; нужно либо переоценить, либо явно пометить как исторический документ.
- [docs/design/anton415-hub-redesign-v1.md](design/anton415-hub-redesign-v1.md) не помечен как superseded by v2.

## Сводный список приоритетов

### Высокий приоритет (расхождения с фактом)
1. README release target → актуализировать после `v0.2.1`.
2. CHANGELOG: вынести `Unreleased` → `v0.2.1 — 2026-05-04`; добавить недостающие записи про project lifecycle и hierarchy/recurrence.
3. `docs/architecture.md`: убрать «Finance v1 excludes limits», обновить Todo-секцию под реальный скоуп.
4. `docs/dev-setup.md`: обновить раздел «Database» под актуальные таблицы; дополнить Common commands.
5. `docs/roadmap.md`: переписать near-term sequence и убрать «No Yandex Cloud deployment scripts yet».

### Средний приоритет (полнота)
6. Добавить CONTRIBUTING.md (или раздел в README) + ссылки на feature-ritual и PR-шаблон.
7. Свести API-контракт в `docs/api.md` или сгенерировать OpenAPI.
8. Документировать domain-инварианты (money kopecks, recurrence, hierarchy, limits) отдельным doc’ом.
9. Помечать `docs/design/anton415-hub-redesign-v1.md` как superseded и датировать QA-notes в v2.

### Низкий приоритет (полировка)
10. Package-level doc-комментарии и комментарии на экспортируемые типы.
11. CLAUDE.md / AGENTS.md для AI-агентов.
12. Гайд «как добавить новый модуль» к старту Investments/FIRE.
13. Переоценка Yandex cost либо явная пометка документа как историчного.

## Cross-references

- [docs/architecture-snapshot-2026-05.md](architecture-snapshot-2026-05.md) — операционные риски и форма архитектуры.
- [docs/architecture-deep-review-2026-05.md](architecture-deep-review-2026-05.md) — глубокая оценка кода (SOLID, coupling, scalability).
- [docs/doc-inventory.md](doc-inventory.md) — пофайловая инвентаризация документов с пометкой актуальности.
