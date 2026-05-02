# Dependency Updates

Dependency updates are release work, not background noise.

Routine Dependabot version-update pull requests are disabled by setting `open-pull-requests-limit: 0` in `.github/dependabot.yml`. GitHub Dependabot security updates are enabled in repository settings and should still be handled promptly when a vulnerability is reported.

## Planned Release Refresh

Before a planned release:

1. Review outdated dependencies:

```sh
go list -m -u all
cd apps/web && npm outdated
```

2. Update intentionally, keeping major upgrades separate from patch/minor maintenance.

3. Run the full local verification set:

```sh
go test ./...
cd apps/web && npm run test:run && npm run build
docker buildx build --platform linux/amd64 --load -t anton415-hub:release-check .
```

4. Open one release-prep PR with the dependency changes and changelog note.

5. Merge only after CI is green and the production risk is understood.

## Emergency Security Updates

If GitHub opens a Dependabot security PR, treat it as substantial by default:

- read the advisory
- check whether the vulnerable package is used in production code, build tooling, or tests only
- merge quickly if CI is green and the update is narrow
- create a patch release if production code or deployment tooling is affected
