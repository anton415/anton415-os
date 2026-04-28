# Production Runbook

Target: `https://todo.anton415.ru`.

## Runtime

Production runs as one Docker image:

- Go API on `:8080`
- Vite static bundle served by the Go API from `STATIC_DIR`
- PostgreSQL 16 runs in Docker on the same VM with a persistent Docker volume
- Caddy terminates HTTPS and proxies to the app container
- Todo and auth data are on the VM disk for this budget-first v1

The app shell and product APIs use the shared `anton415_session` cookie for anton415 OS access. `/health`, `/api/v1/me`, and auth routes stay public so the browser can check the session and start login.

## Required Secrets

Store secret values in Yandex Lockbox and GitHub production secrets, not in the public repo:

- `YANDEX_OAUTH_CLIENT_ID`
- `YANDEX_OAUTH_CLIENT_SECRET`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `VK_OAUTH_CLIENT_ID`
- `VK_OAUTH_CLIENT_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

`DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_ALLOWED_EMAILS`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, and `BACKUP_BUCKET` are generated into `/opt/anton415-os/app.env` from Terraform. Do not duplicate `DATABASE_URL` in Lockbox, or it will override the VM-local database URL.

First production cutover enables Yandex ID only. Email magic links are supported by the code but Postbox is intentionally deferred to minimize the initial monthly cost. Leave SMTP, GitHub OAuth, and VK OAuth values empty until those providers are registered and tested.

Production auth defaults:

```sh
APP_ENV=production
WEB_ORIGIN=https://todo.anton415.ru
AUTH_CALLBACK_BASE_URL=https://todo.anton415.ru
AUTH_SUCCESS_REDIRECT=https://todo.anton415.ru/todo
AUTH_FAILURE_REDIRECT=https://todo.anton415.ru/
AUTH_COOKIE_SECURE=true
```

Opening `https://todo.anton415.ru/` redirects to `/todo`, so the Todo workspace is the first production screen.

Upload runtime secrets after Terraform creates Lockbox:

```sh
YC_BIN="$HOME/yandex-cloud/bin/yc" \
  deploy/lockbox-sync.sh deploy/lockbox/.env.production <lockbox_secret_id>
```

The VM stores base non-secret runtime configuration in `/opt/anton415-os/app.env`, fetches Lockbox entries into `/opt/anton415-os/secrets.env`, and uses both files as Docker Compose `env_file` inputs.

## OAuth Callbacks

Register this callback URL:

- `https://todo.anton415.ru/api/v1/auth/yandex/callback`

Scopes: `login:email` and `login:info`. The allowed login email is `anton415460@yandex.ru`.

GitHub and VK callbacks can be added later:

- `https://todo.anton415.ru/api/v1/auth/github/callback`
- `https://todo.anton415.ru/api/v1/auth/vk/callback`

VK ID is treated as unverified unless it returns a reliable verified email signal; use email magic-link verification if VK returns `email_verification_required`.

## Yandex Setup Checklist

Create or activate billing first, then create cloud `anton415-os`, folder `production`, and use zone `ru-central1-a`.

Delegate `anton415.ru` to Yandex Cloud DNS at the registrar:

```text
ns1.yandexcloud.net.
ns2.yandexcloud.net.
```

Postbox can be added later. When it is worth enabling email magic links, create sender `todo@anton415.ru` for domain `anton415.ru` with selector `postbox`, add the generated DKIM TXT record to Cloud DNS, and put the API key ID/secret into Lockbox as `SMTP_USERNAME` and `SMTP_PASSWORD`.

## Deployment

1. Merge to `main`.
2. Publish a GitHub Release or run the `Deploy Production` workflow manually.
3. Approve the `production` environment deployment.
4. GitHub Actions builds and pushes `cr.yandex/<registry>/anton415-os:<tag>` for `linux/amd64`.
5. The VM pulls the image, extracts migrations from it, runs them against the local PostgreSQL container, restarts the app/Caddy services, and checks `/health`.
6. Check:

```sh
curl -fsS https://todo.anton415.ru/health
```

## Backups and Restore Drill

There is no Managed PostgreSQL PITR in this budget-first v1. The first recovery line is the VM Docker volume; the independent fallback is a monthly logical dump uploaded to Object Storage by:

```sh
deploy/backup/pg_dump_to_object_storage.sh
```

When running it on the VM, export both `/opt/anton415-os/app.env` and `/opt/anton415-os/secrets.env` first so the script can read `DATABASE_URL`, `BACKUP_BUCKET`, and Object Storage credentials.

Budget retention target:

- monthly logical dumps retained for 90 days, usually about 3 copies

This is intentionally conservative on cost for v1. If Todo data becomes important enough to justify stronger recovery guarantees, move PostgreSQL back to a managed service, increase `backup_monthly_retention_days`, or add daily logical dumps back in Terraform.

Restore drill:

1. Restore the latest logical dump into a disposable staging database:

```sh
gunzip -c latest.sql.gz | psql "$STAGING_DATABASE_URL"
```

2. Insert a temporary auth session and call `/api/v1/todo/tasks`.
3. Confirm recent Todo data exists.
4. Delete the staging resources.

## Local Integration Smoke

For a real API + PostgreSQL check:

```sh
AUTH_EMAIL=anton@example.com scripts/todo-integration-smoke.sh
```

The script creates a temporary auth session directly in local Postgres, creates a Todo task through the API, verifies it can be listed, and deletes it.
