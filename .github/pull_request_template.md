## Linked issue

Closes #

## What changed

-

## Product intent

-

## Scope and non-goals

-

## Architecture notes

-

## Review Gate

- [ ] Issue is linked with `Closes #...`
- [ ] Acceptance criteria from the issue are covered
- [ ] Self-review completed before marking the PR ready
- [ ] Codex automatic review has run on the open PR
- [ ] All Codex `must-fix` findings are fixed
- [ ] Codex `should-fix` findings are fixed or tracked as follow-up issues
- [ ] `won't-fix` / `false-positive` findings have an explanation in the PR
- [ ] CI is green
- [ ] Post-release check is described

## Codex review resolution

-

## Sensitive areas

- [ ] Database/migrations
- [ ] Auth/security
- [ ] Finance/money
- [ ] Deploy/production
- [ ] Backups/restore
- [ ] Module boundaries

## Verification

- [ ] `make lint`
- [ ] `make test`
- [ ] `make build`
- [ ] `make test-e2e`, if a browser flow changed
- [ ] `make test-integration`, if API + PostgreSQL behavior changed
- [ ] Manual local workflow check

## Release notes

-

## Post-release check

- [ ] `https://anton415.ru/health` returns ok
- [ ] Main production workflow works
- [ ] No obvious runtime errors
- [ ] Data created by the feature persists correctly
