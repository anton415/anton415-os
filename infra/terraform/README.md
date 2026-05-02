# Production Infrastructure

This Terraform stack is the production baseline for `https://anton415.ru` and `https://anton415.ru/todo`.

It creates:

- Yandex VPC, subnet, and security group
- service account for the app VM
- service account for GitHub Actions image pushes
- Yandex Container Registry
- Lockbox secret metadata for runtime secrets
- Object Storage bucket for independent `pg_dump` archives
- Container Optimized VM running PostgreSQL, the app, and Caddy HTTPS
- public Cloud DNS zone for `anton415.ru`
- static public IP and `A` record for `anton415.ru`

Default sizing is intentionally modest for a private Todo app:

- VM: `standard-v3`, 2 vCPU, 2 GB RAM, 20% core fraction, 30 GB network HDD boot disk
- PostgreSQL: Docker `postgres:16-alpine` on the same VM, stored in a persistent Docker volume on the VM disk
- Budget backup profile: about 3 monthly logical dumps in Object Storage

## Apply

Create a local `terraform.tfvars` file outside Git history:

```hcl
cloud_id           = "..."
folder_id          = "..."
ssh_public_key     = "ssh-ed25519 ..."
backup_bucket_name = "anton415-hub-postgres-backups"

production_ssh_allowed_cidrs = [
  "203.0.113.10/32",
]
```

Then:

```sh
terraform init
export YC_TOKEN="$($HOME/yandex-cloud/bin/yc iam create-token)"
terraform plan
terraform apply
```

`terraform plan` only calculates changes. `terraform apply` creates paid Yandex resources and must be run only after explicitly reviewing the plan and approving the spend.

For the anton415 Hub rename, review the plan especially carefully: resource names, the VM app directory, registry image name, database name, database user, and backup bucket examples now use `anton415-hub` / `anton415_hub`. Keep pre-rename production backups until the post-release data check is complete.

## SSH Access

Public SSH is closed by default. `production_ssh_allowed_cidrs` is the only Terraform-controlled SSH allowlist for the production VM, and every entry must be a valid IPv4 CIDR with prefix length `/24` or narrower. Prefer `/32` entries for individual admin addresses or a small fixed VPN/bastion egress range.

Use this permanent admin path:

```hcl
production_ssh_allowed_cidrs = [
  "203.0.113.10/32",
]
```

If the admin source address is dynamic, use a temporary break-glass window instead of leaving SSH open:

```sh
ADMIN_IP="$(curl -fsS https://api.ipify.org)"
terraform plan -var="production_ssh_allowed_cidrs=[\"${ADMIN_IP}/32\"]"
terraform apply -var="production_ssh_allowed_cidrs=[\"${ADMIN_IP}/32\"]"
```

After the admin task or deployment is complete, remove the temporary `/32` entry and apply Terraform again. Do not use `0.0.0.0/0`; the variable validation rejects it.

After apply, add a Lockbox secret version with runtime secrets. It must include at least:

- `POSTGRES_PASSWORD`
- `AUTH_ALLOWED_EMAILS` with exactly one owner email
- `YANDEX_OAUTH_CLIENT_ID`
- `YANDEX_OAUTH_CLIENT_SECRET`

```sh
YC_BIN="$HOME/yandex-cloud/bin/yc" \
  ../../deploy/lockbox-sync.sh ../../deploy/lockbox/.env.production "$(terraform output -raw lockbox_secret_id)"
```

The VM reads Lockbox into `/opt/anton415-hub/secrets.env` with `/opt/anton415-hub/sync-lockbox-env.sh` and writes a narrowed `/opt/anton415-hub/postgres.env` containing only `POSTGRES_PASSWORD` for the Postgres container. Terraform user-data only writes non-secret runtime defaults to `/opt/anton415-hub/app.env`; production DB credentials and the auth allowlist must not be passed through Terraform variables. Production is intentionally single-owner, so `AUTH_ALLOWED_EMAILS` must stay one email until Todo and Finance gain per-user isolation. To rotate secrets later, add a new Lockbox version, run that script on the VM, and restart Compose.

Create a JSON key for the deploy service account outside Terraform and store it as the GitHub Actions secret `YC_SA_JSON_KEY`. The service account can push production images and manage the production security group so the deploy workflow can open and close a temporary GitHub runner `/32` SSH rule around the SSH step. The service account ID is available from:

```sh
terraform output -raw deploy_service_account_id
```

Do not commit the JSON key or store it in Terraform state.

Store the app security group ID as the GitHub repository variable `YC_APP_SECURITY_GROUP_ID`:

```sh
gh variable set YC_APP_SECURITY_GROUP_ID --body "$(terraform output -raw app_security_group_id)"
```

Delegate `anton415.ru` at the registrar to the nameservers from `terraform output domain_nameservers`:

```text
ns1.yandexcloud.net.
ns2.yandexcloud.net.
```

## Backup Drill

VM-local PostgreSQL is the first recovery line. Monthly logical dumps are the independent fallback:

```sh
deploy/backup/pg_dump_to_object_storage.sh
```

The baseline keeps backup storage deliberately small: Object Storage keeps monthly dumps for 90 days. Move back to Managed PostgreSQL, increase `backup_monthly_retention_days`, or add daily logical dumps later if the data becomes more important.

Before calling production safe, restore the latest dump into a staging database and verify `/api/v1/todo/tasks` returns expected data with an inserted test session.
