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
db_password        = "..."
allowed_emails     = "anton@example.com"
backup_bucket_name = "anton415-os-postgres-backups"
```

Then:

```sh
terraform init
export YC_TOKEN="$($HOME/yandex-cloud/bin/yc iam create-token)"
terraform plan
terraform apply
```

`terraform plan` only calculates changes. `terraform apply` creates paid Yandex resources and must be run only after explicitly reviewing the plan and approving the spend.

After apply, add a Lockbox secret version with runtime secrets:

```sh
YC_BIN="$HOME/yandex-cloud/bin/yc" \
  ../../deploy/lockbox-sync.sh ../../deploy/lockbox/.env.production "$(terraform output -raw lockbox_secret_id)"
```

The VM reads Lockbox into `/opt/anton415-os/secrets.env` with `/opt/anton415-os/sync-lockbox-env.sh`. To rotate secrets later, add a new Lockbox version and run that script on the VM before restarting Compose.

Create a JSON key for the deploy service account outside Terraform and store it as the GitHub Actions secret `YC_SA_JSON_KEY`. The service account ID is available from:

```sh
terraform output -raw deploy_service_account_id
```

Do not commit the JSON key or store it in Terraform state.

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
