# Deployment Assets

- `docker-compose.production.yml` runs PostgreSQL, migrations, the app image, and Caddy on the VM.
- `caddy/Caddyfile` terminates HTTPS for `anton415.ru`.
- `backup/pg_dump_to_object_storage.sh` uploads logical PostgreSQL dumps to Yandex Object Storage.

The default backup policy is budget-first: Terraform keeps independent monthly dumps for 90 days. The script writes archive names with a timestamp plus a unique temporary-directory suffix, so Object Storage versioning is intentionally not enabled.

The production app image serves both API and frontend. The canonical product URLs use the root domain:

```text
https://anton415.ru      -> Caddy -> app:8080
https://anton415.ru/todo -> Caddy -> app:8080
```

Todo lives at the canonical `https://anton415.ru/todo` path.

Deployments extract `/app/migrations` from the app image and run `migrate/migrate` on the VM before restarting the app.

GitHub Actions deploys are manual or release-triggered. They build a `linux/amd64` image, push it to Yandex Container Registry, create or update `/opt/anton415-hub/docker-compose.yml` on the VM, extract migrations from the image, run migrations, and recreate the app/Caddy containers.

The first anton415 Hub deploy can migrate data from the legacy `/opt/anton415-os` deployment. The workflow guards that one-time dump/restore with `/opt/anton415-hub/.anton415-hub-db-migrated`, keeps the legacy directory and Docker volumes for rollback, and switches the live app/Caddy containers to the new `/opt/anton415-hub` Compose project.

When using `docker-compose.production.yml` manually outside Terraform, provide `YC_REGISTRY_ID` and `IMAGE_TAG` in the shell or a local `.env` file, keep non-secret `POSTGRES_*` settings in `/opt/anton415-hub/app.env`, keep Lockbox-synced secrets in `/opt/anton415-hub/secrets.env`, and keep a narrowed `/opt/anton415-hub/postgres.env` containing only `POSTGRES_PASSWORD`; both secret files should be mode `0600`. Run `deploy/migrate-production.sh` for migrations; it uses a passwordless database URL plus `PGPASSWORD` at runtime instead of storing credentials in the Compose file.
