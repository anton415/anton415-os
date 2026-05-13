# Roadmap

Это компактный документ направления. Кодовая база и открытые issues остаются
источником истины для точного scope.

## Current State

- Репозиторий — production-oriented Go modular monolith с Vite TypeScript
  frontend.
- Production deployment уже существует для Yandex Cloud VM, Caddy, Docker
  Compose, PostgreSQL, GitHub Actions и Terraform.
- Auth уже есть: OAuth providers, sessions, cookies, allowlist rules и local dev
  bypass.
- Todo — самый полный модуль. В нем есть проекты, задачи, иерархия,
  archive/restore behavior, даты, ссылки, recurrence, priority, flags, REST API,
  UI, migrations и tests.
- Finance содержит monthly income and expense facts, categories, category
  settings, REST API, UI, migrations и tests.
- Investments и FIRE видны как границы модулей, но полезных product slices там
  пока нет.
- Документация уже есть, но audit показывает устаревшие и пересекающиеся docs.

## Near-Term Roadmap

- Обновить старый roadmap и release references, чтобы они совпадали с кодовой
  базой.
- Держать Todo стабильным и исправлять только реальные workflow gaps из
  ежедневного использования.
- Завершить Finance polish вокруг понятности, persistence и monthly review flow.
- Усилить production confidence:
  - держать migrations простыми и reviewed;
  - проверить backup and restore steps;
  - держать smoke checks близко к реальным owner workflows.
- Использовать GitHub issues как small specs перед implementation.
- Держать Codex review сфокусированным на risky areas: auth, migrations, money
  logic, production deploy, backups и module boundaries.

## Later Roadmap

- Investments v1:
  - определить accounts и positions;
  - сначала записывать portfolio facts вручную;
  - не добавлять imports и sync, пока manual model не станет полезной.
- FIRE v1:
  - использовать явные outputs из Finance и Investments;
  - держать calculations читаемыми;
  - избегать скрытых assumptions.
- Per-user isolation:
  - добавить `user_id` ownership перед разрешением нескольких production users.
- Developer automation:
  - улучшить issue-to-spec-to-PR flow;
  - автоматизировать повторяемые checks там, где это снижает ошибки;
  - держать automation видимой и простой для ручного override.
- Internal engineering platform ideas:
  - standard feature checklist;
  - migration safety checks;
  - release и post-release verification templates;
  - маленькие scripts, которые помогают одному maintainer двигаться быстрее без
    скрытия risk.

## AI Software Engineer Learning Direction

- System analysis: описывать текущую систему перед изменениями.
- Spec-driven development: превращать каждую значимую feature в маленькую issue
  spec со scope, non-goals, risks, acceptance criteria и tests.
- Go backend development: практиковать domain logic, HTTP handlers, PostgreSQL
  adapters, migrations и tests внутри modular monolith.
- AI-assisted development: использовать AI для discovery, implementation
  support, review, test ideas и documentation cleanup.
- Coding agents: давать agents узкие задачи с clear file ownership и проверять
  их результат по code и tests.
- Developer automation: автоматизировать только повторяемую работу с понятным
  failure mode.
- Internal platform thinking: сначала выращивать reusable project habits, а уже
  потом извлекать reusable tools.

## Documentation Cleanup Plan

- Держать constitution маленькой: только mission, tech stack и roadmap.
- Оставлять operational docs только если они нужны для запуска или восстановления
  production.
- Лучше обновлять или удалять stale docs, чем добавлять новые docs.
- Ничего не удалять автоматически. Удалять docs только после проверки текущей
  кодовой базы и production workflow.

## Cleanup Candidates

На основе `docs/doc-inventory.md`, эти документы позже можно удалить,
объединить или переписать:

- `docs/roadmap.md`: помечен как outdated. Текущая release sequence конфликтует
  с уже реализованной работой по Todo, Finance и deployment.
- `docs/yandex-cost-estimate.md`: помечен как outdated. Нужны текущие цены или
  явная пометка, что это historical estimate.
- `docs/design/anton415-hub-redesign-v1.md`: частично устарел. Его стоит
  держать только как historical reference, если v2 остается active design
  direction.
- `docs/architecture.md`: частично устарел. Его можно сократить, если
  constitution и кодовая база покрывают то же high-level direction.
- `docs/dev-setup.md`: частично устарел. Оставить, если он поддерживается как
  practical local setup guide; иначе перенести только текущие команды в README.
- `docs/production.md`: частично устарел. Оставить как runbook, но проверить
  Finance, backups, restore и post-release checks.
- `README.md`: частично устарел. Оставить как entry point, но убрать
  duplicated roadmap detail, когда constitution станет planning source.

## Non-Goals

- Не создавать большую documentation hierarchy.
- Не вводить enterprise process для one-person app.
- Не извлекать сервисы без реальной operational boundary.
- Не добавлять AI product feature до появления clear owner workflow.
