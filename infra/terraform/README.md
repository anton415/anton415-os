# Production Infrastructure

This Terraform stack is the production baseline for `https://todo.anton415.ru`.

It creates:

- Yandex VPC, subnet, and security group
- service account for the app VM
- Yandex Container Registry
- Managed PostgreSQL
- Lockbox secret metadata for runtime secrets
- Object Storage bucket for independent `pg_dump` archives
- Container Optimized VM running the app behind Caddy HTTPS
- public Cloud DNS zone for `anton415.ru`
- static public IP and `A` record for `todo.anton415.ru`

Default sizing is intentionally modest for a private Todo app:

- VM: `standard-v3`, 2 vCPU, 2 GB RAM, 20% core fraction, 20 GB network HDD boot disk
- PostgreSQL: `c3-c2-m4`, 2 vCPU, 4 GB RAM, 10 GB network SSD

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

Delegate `anton415.ru` at the registrar to the nameservers from `terraform output domain_nameservers`:

```text
ns1.yandexcloud.net.
ns2.yandexcloud.net.
```

## Backup Drill

Managed PostgreSQL PITR is the first recovery line. Nightly logical dumps are the independent fallback:

```sh
deploy/backup/pg_dump_to_object_storage.sh
```

Before calling production safe, restore the latest dump into a staging database and verify `/api/v1/todo/tasks` returns expected data with an inserted test session.
