locals {
  app_name          = "anton415-hub"
  database_name     = "anton415_hub"
  database_user     = "anton415_hub_app"
  image_name        = "cr.yandex/${yandex_container_registry.app.id}/anton415-hub:${var.image_tag}"
  root_zone         = trimsuffix(var.root_domain_name, ".")
  ssh_allowed_cidrs = sort(distinct(var.production_ssh_allowed_cidrs))
}

resource "yandex_vpc_network" "main" {
  name = "${local.app_name}-network"
}

resource "yandex_vpc_subnet" "app" {
  name           = "${local.app_name}-subnet"
  zone           = var.zone
  network_id     = yandex_vpc_network.main.id
  v4_cidr_blocks = ["10.41.0.0/24"]
}

resource "yandex_vpc_address" "app" {
  name = "${local.app_name}-public-ip"

  external_ipv4_address {
    zone_id = var.zone
  }
}

resource "yandex_vpc_security_group" "app" {
  name       = "${local.app_name}-app-sg"
  network_id = yandex_vpc_network.main.id

  dynamic "ingress" {
    for_each = length(local.ssh_allowed_cidrs) == 0 ? [] : [local.ssh_allowed_cidrs]

    content {
      protocol       = "TCP"
      description    = "SSH from approved admin networks"
      v4_cidr_blocks = ingress.value
      port           = 22
    }
  }

  ingress {
    protocol       = "TCP"
    description    = "HTTP for ACME redirect"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 80
  }

  ingress {
    protocol       = "TCP"
    description    = "HTTPS"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 443
  }

  egress {
    protocol       = "ANY"
    description    = "Outbound"
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "yandex_iam_service_account" "app" {
  name        = "${local.app_name}-app"
  description = "Runs the personal Todo production VM."
}

resource "yandex_iam_service_account" "deploy" {
  name        = "${local.app_name}-deploy"
  description = "Pushes production images from GitHub Actions."
}

resource "yandex_resourcemanager_folder_iam_member" "app_registry_puller" {
  folder_id = var.folder_id
  role      = "container-registry.images.puller"
  member    = "serviceAccount:${yandex_iam_service_account.app.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "app_lockbox_viewer" {
  folder_id = var.folder_id
  role      = "lockbox.payloadViewer"
  member    = "serviceAccount:${yandex_iam_service_account.app.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "deploy_registry_pusher" {
  folder_id = var.folder_id
  role      = "container-registry.images.pusher"
  member    = "serviceAccount:${yandex_iam_service_account.deploy.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "deploy_security_group_admin" {
  folder_id = var.folder_id
  role      = "vpc.securityGroups.admin"
  member    = "serviceAccount:${yandex_iam_service_account.deploy.id}"
}

resource "yandex_container_registry" "app" {
  name = "${local.app_name}-registry"
}

resource "yandex_lockbox_secret" "app" {
  name        = "${local.app_name}-runtime"
  description = "Runtime database, auth, OAuth, SMTP/Postbox, and object storage secrets. Add versions outside Terraform."
}

resource "yandex_storage_bucket" "backups" {
  bucket    = var.backup_bucket_name
  folder_id = var.folder_id

  lifecycle_rule {
    id      = "monthly-retention"
    enabled = true

    filter {
      prefix = "postgres/monthly/"
    }

    expiration {
      days = var.backup_monthly_retention_days
    }
  }
}

resource "yandex_dns_zone" "public" {
  name        = replace(local.root_zone, ".", "-")
  description = "Public DNS zone for ${local.root_zone}."
  zone        = "${local.root_zone}."
  public      = true
}

data "yandex_compute_image" "container_optimized" {
  family = "container-optimized-image"
}

resource "yandex_compute_instance" "app" {
  name        = "${local.app_name}-app"
  platform_id = var.vm_platform_id
  zone        = var.zone

  resources {
    cores         = var.vm_cores
    memory        = var.vm_memory
    core_fraction = var.vm_core_fraction
  }

  boot_disk {
    initialize_params {
      image_id = data.yandex_compute_image.container_optimized.id
      type     = "network-hdd"
      size     = var.vm_boot_disk_size
    }
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.app.id
    nat                = true
    nat_ip_address     = yandex_vpc_address.app.external_ipv4_address[0].address
    security_group_ids = [yandex_vpc_security_group.app.id]
  }

  service_account_id = yandex_iam_service_account.app.id

  metadata = {
    ssh-keys = "ubuntu:${var.ssh_public_key}"
    user-data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
      image_name        = local.image_name
      registry_id       = yandex_container_registry.app.id
      image_tag         = var.image_tag
      root_domain_name  = var.root_domain_name
      database_name     = local.database_name
      database_user     = local.database_user
      backup_bucket     = var.backup_bucket_name
      lockbox_secret_id = yandex_lockbox_secret.app.id
    })
  }
}

resource "yandex_dns_recordset" "root" {
  zone_id = yandex_dns_zone.public.id
  name    = "${local.root_zone}."
  type    = "A"
  ttl     = 300
  data    = [yandex_vpc_address.app.external_ipv4_address[0].address]
}
