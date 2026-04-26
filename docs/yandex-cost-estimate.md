# Yandex Cloud Cost Estimate

Snapshot date: 2026-04-26.

This is a pre-apply estimate for `todo.anton415.ru` in the Russia region, RUB pricing, assuming 720 hours per month and the default Terraform sizing.

## Default Sizing

- VM: `standard-v3`, 2 vCPU, 2 GB RAM, 20% core fraction, 20 GB network HDD boot disk.
- Managed PostgreSQL: `c3-c2-m4`, 2 vCPU, 4 GB RAM, 10 GB network SSD.
- One active static public IP, one Cloud DNS zone, one Lockbox secret version, and roughly 1 GB of Container Registry storage.

## Monthly Baseline

| Resource | Formula | Estimate |
| --- | ---: | ---: |
| VM compute | `720 * (2 * 0.48312 + 2 * 0.30744)` | `1,138.41 RUB` |
| VM boot disk | `720 * 20 * 0.00445299` | `64.12 RUB` |
| Active public IP | `720 * 0.26352` | `189.73 RUB` |
| Managed PostgreSQL compute | `720 * (2 * 1.78974 + 4 * 0.48312)` | `3,968.61 RUB` |
| Managed PostgreSQL storage | `720 * 10 * 0.01984024` | `142.85 RUB` |
| Cloud DNS zone | `720 * 0.0549` | `39.53 RUB` |
| Lockbox secret version | `720 * 0.02745` | `19.76 RUB` |
| Container Registry storage, 1 GB | `720 * 1 * 0.004575` | `3.29 RUB` |
| **Baseline total** |  | **`5,566.31 RUB/month`** |

## Variable Or Usually Small Costs

- Outgoing traffic: first 100 GB per month is not charged; after that, traffic is billed by VPC rates.
- Managed PostgreSQL backups: not charged while the database plus backup volume stays below the selected cluster storage; excess backup storage is billed separately.
- Cloud DNS authoritative requests: billed per million requests; personal Todo traffic should be tiny.
- Lockbox operations: billed per 10,000 operations; app boot and occasional secret rotation should be tiny.
- Object Storage backups and Postbox email are expected to be negligible at this scale, but monitor the billing dashboard after enabling them.

## Cost Controls

- Do not run `terraform apply` until the plan and budget are approved.
- Set a Yandex Cloud budget alert immediately after billing is active.
- Delete the static public IP if the VM is destroyed; reserved inactive public IPs continue to bill.
- Stop or delete Managed PostgreSQL when abandoning production; a stopped cluster still bills storage and backups.
