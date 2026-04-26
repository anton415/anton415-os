# Production Runbook

Target: `https://todo.anton415.ru`.

## Runtime

Production runs as one Docker image:

- Go API on `:8080`
- Vite static bundle served by the Go API from `STATIC_DIR`
- Caddy terminates HTTPS and proxies to the app container
- Managed PostgreSQL owns Todo and auth data

Todo API routes require a valid `anton415_session` cookie. `/health`, `/api/v1/me`, and auth routes stay public.

## Required Secrets

Store secrets in Yandex Lockbox and GitHub production secrets, not in the public repo:

- `DATABASE_URL`
- `AUTH_ALLOWED_EMAILS`
- `YANDEX_OAUTH_CLIENT_ID`
- `YANDEX_OAUTH_CLIENT_SECRET`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `VK_OAUTH_CLIENT_ID`
- `VK_OAUTH_CLIENT_SECRET`
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- Object Storage credentials for independent dumps

First production cutover enables Yandex ID and email magic links only. Leave GitHub and VK OAuth values empty until those providers are registered and tested.

Production auth defaults:

```sh
APP_ENV=production
WEB_ORIGIN=https://todo.anton415.ru
AUTH_CALLBACK_BASE_URL=https://todo.anton415.ru
AUTH_SUCCESS_REDIRECT=https://todo.anton415.ru/todo
AUTH_FAILURE_REDIRECT=https://todo.anton415.ru/
AUTH_COOKIE_SECURE=true
```

Upload runtime secrets after Terraform creates Lockbox:

```sh
YC_BIN="$HOME/yandex-cloud/bin/yc" \
  deploy/lockbox-sync.sh deploy/lockbox/.env.production <lockbox_secret_id>
```

The VM stores base non-secret runtime configuration in `/opt/anton415-os/app.env`, fetches Lockbox entries into `/opt/anton415-os/secrets.env`, and uses both files as Docker Compose `env_file` inputs.

## OAuth Callbacks

Register these callback URLs:

- `https://todo.anton415.ru/api/v1/auth/yandex/callback`
- `http://localhost:8080/api/v1/auth/yandex/callback`

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

Create Postbox sender `todo@anton415.ru` for domain `anton415.ru` with selector `postbox`, add the generated DKIM TXT record to Cloud DNS, and put the API key ID/secret into Lockbox as `SMTP_USERNAME` and `SMTP_PASSWORD`.

## Deployment

1. Merge to `main`.
2. GitHub Actions builds and pushes `cr.yandex/<registry>/anton415-os:<sha>`.
3. Approve the `production` environment deployment.
4. The VM pulls the image and restarts the `app` service.
5. Check:

```sh
curl -fsS https://todo.anton415.ru/health
```

## Backups and Restore Drill

Managed PostgreSQL PITR is enabled by the managed service. Independent dumps are uploaded to Object Storage by:

```sh
deploy/backup/pg_dump_to_object_storage.sh
```

Budget retention target:

- 7 days of Managed PostgreSQL automatic backups/PITR
- monthly logical dumps retained for 90 days, usually about 3 copies

This is intentionally conservative on cost for v1. If Todo data becomes important enough to justify stronger recovery guarantees, increase `postgres_backup_retain_period_days` and `backup_monthly_retention_days`, or add daily logical dumps back in Terraform.

Restore drill:

1. Restore Managed PostgreSQL PITR into a staging cluster.
2. Restore the latest logical dump into a disposable staging database:

```sh
gunzip -c latest.sql.gz | psql "$STAGING_DATABASE_URL"
```

3. Insert a temporary auth session and call `/api/v1/todo/tasks`.
4. Confirm recent Todo data exists.
5. Delete the staging resources.

## Local Integration Smoke

For a real API + PostgreSQL check:

```sh
AUTH_EMAIL=anton@example.com scripts/todo-integration-smoke.sh
```

The script creates a temporary auth session directly in local Postgres, creates a Todo task through the API, verifies it can be listed, and deletes it.
