# Deployment Assets

- `docker-compose.production.yml` runs PostgreSQL, migrations, the app image, and Caddy on the VM.
- `caddy/Caddyfile` terminates HTTPS for `todo.anton415.ru`.
- `backup/pg_dump_to_object_storage.sh` uploads logical PostgreSQL dumps to Yandex Object Storage.

The default backup policy is budget-first: Terraform keeps independent monthly dumps for 90 days. The script writes archive names with a timestamp plus a unique temporary-directory suffix, so Object Storage versioning is intentionally not enabled.

The production app image serves both API and frontend, so browser traffic uses one origin:

```text
https://todo.anton415.ru -> Caddy -> app:8080
```

Deployments extract `/app/migrations` from the app image and run `migrate/migrate` on the VM before restarting the app.

GitHub Actions deploys are manual or release-triggered. They build a `linux/amd64` image, push it to Yandex Container Registry, update `/opt/anton415-os/docker-compose.yml` on the VM, extract migrations from the image, run migrations, and recreate the app/Caddy containers.

When using `docker-compose.production.yml` manually outside Terraform, provide `YC_REGISTRY_ID`, `IMAGE_TAG`, and `POSTGRES_PASSWORD` in the shell or a local `.env` file before running Compose.
