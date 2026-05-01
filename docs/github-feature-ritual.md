# GitHub Feature Ritual

This project uses GitHub as the source of truth for product work. The goal is to keep AI-assisted development pointed at the right feature, not just at fast code generation.

## Flow

```text
Issue -> Discovery -> Spec -> Ready -> Draft PR -> Implementation -> Review Gate -> Release -> Monitoring -> Done
```

## GitHub mapping

- Issue: product intent, mini-spec, affected areas, risks, acceptance criteria, test plan, and post-release checks.
- Project: current stage of each feature.
- Draft PR: implementation journal and early visibility.
- Review Gate: self-review plus Codex automatic review on the open PR.
- Release: changelog/release notes and production deploy.
- Monitoring: production verification after release.

The issue forms automatically add new feature and bug issues to the `anton415-os - Feature Ritual` GitHub Project.

## Issue rules

Create a `Business feature` issue for meaningful product work: Todo, Finance, Investments, FIRE, auth, database, deploy, or production-sensitive changes.

The issue must explain:

- why the feature matters
- the real user scenario
- what success looks like
- what is in scope
- what is out of scope
- affected modules and operational areas
- risks
- proposed solution / mini-spec
- acceptance criteria
- test plan
- post-release check

Move the issue to `Ready` only when the scope, risks, and acceptance criteria are clear enough to implement.

## PR rules

Open a Draft PR early and link it to the issue with:

```md
Closes #123
```

Before marking the PR ready for review:

- complete the self-review checklist
- verify acceptance criteria
- keep scope aligned with the issue
- update docs, roadmap, or changelog when product reality changes
- run the relevant local checks or confirm CI coverage

## Review Gate

Codex automatic review is treated as a quality gate for open PRs.

Codex findings should be classified as:

- `must-fix`: blocks merge
- `should-fix`: fix before merge unless there is a clear reason to defer
- `follow-up`: create or link a follow-up issue
- `won't-fix`: explain why it is intentionally not being changed
- `false-positive`: explain why the finding does not apply

A PR can move from `Review Gate` to `Release` only when:

- CI is green
- all `must-fix` findings are resolved
- `should-fix` findings are resolved or tracked
- sensitive areas have been manually reviewed
- the post-release check is written down

Sensitive areas always require extra manual attention:

- database migrations
- auth/security
- finance/money calculations
- production deploy and infrastructure
- backups and restore
- boundaries between finance, investments, and FIRE

## Release and monitoring

After merge, release the feature through the existing GitHub Release and production deploy flow.

Keep the issue in `Monitoring` until the production checks are complete:

- `/health` returns ok
- the primary UI workflow works in production
- data persists correctly
- no obvious runtime errors appear

Close the issue only after the post-release result is recorded as an issue comment or PR note.
