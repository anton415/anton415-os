# GitHub Actions

This repository uses two workflows:

- `CI`: runs on pull requests and pushes to `main`.
- `Deploy Production`: runs only when manually dispatched or when a GitHub Release is published.

Production deploys target `https://anton415.ru` and require the `production` GitHub environment. The environment is configured with manual approval so a release or manual dispatch can build the production image only after approval.

## Required Repository Secrets

Store these as GitHub Actions secrets:

- `YC_REGISTRY_ID`: Yandex Container Registry ID.
- `YC_SA_JSON_KEY`: JSON key for the deploy service account with `container-registry.images.pusher`.
- `PRODUCTION_SSH_HOST`: production VM public IP or DNS name.
- `PRODUCTION_SSH_USER`: SSH user, currently `ubuntu`.
- `PRODUCTION_SSH_KEY`: private SSH key matching the VM public key.

Do not commit service-account JSON keys, SSH private keys, Terraform variables, Lockbox env files, or Object Storage keys.

## Required Repository Variables

- `YC_APP_SECURITY_GROUP_ID`: Yandex VPC security group ID attached to the production VM.

The production security group does not allow broad SSH ingress. `Deploy Production` resolves the current GitHub-hosted runner public IP, adds a temporary `/32` SSH rule to `YC_APP_SECURITY_GROUP_ID`, runs the VM deploy over SSH, and removes that exact rule in an `always()` cleanup step. The deploy service account therefore needs both `container-registry.images.pusher` and `vpc.securityGroups.admin`, managed by Terraform. Keep permanent SSH allowlists empty or limited to fixed admin/VPN `/32` entries; never use `0.0.0.0/0` for SSH.

## Deploy Flow

1. Merge code to `main`.
2. Publish a GitHub Release, or run `Deploy Production` manually.
3. Approve the `production` environment deployment.
4. Actions builds a `linux/amd64` Docker image and pushes it to Yandex Container Registry.
5. Actions connects to the VM over SSH, syncs Lockbox secrets, updates `APP_VERSION`, extracts migrations from the image, runs migrations, recreates the app/Caddy containers, and checks `/health`.

The deployment workflow always pushes the deployed tag and also refreshes the `main` image tag for convenience.

Frontend CI and the Docker web build use Node.js 24, while local frontend work supports Node.js 22-24 with npm 10+. GitHub-provided and Docker Actions are pinned to major versions that run on the Node 24 action runtime.
