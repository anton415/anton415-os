locals {
  app_name      = "anton415-os"
  database_name = "anton415_os"
  database_user = "anton415_app"
  image_name    = "cr.yandex/${yandex_container_registry.app.id}/anton415-os:${var.image_tag}"
  root_zone     = trimsuffix(var.root_domain_name, ".")
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

  ingress {
    protocol       = "TCP"
    description    = "SSH"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 22
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

resource "yandex_container_registry" "app" {
  name = "${local.app_name}-registry"
}

resource "yandex_lockbox_secret" "app" {
  name        = "${local.app_name}-runtime"
  description = "Runtime OAuth, SMTP/Postbox, cookie, and object storage secrets. Add versions outside Terraform."
}

resource "yandex_mdb_postgresql_cluster" "main" {
  name        = "${local.app_name}-postgres"
  environment = "PRODUCTION"
  network_id  = yandex_vpc_network.main.id

  config {
    version = "16"
    resources {
      resource_preset_id = var.postgres_resource_preset_id
      disk_type_id       = "network-ssd"
      disk_size          = var.postgres_disk_size
    }
    backup_retain_period_days = var.postgres_backup_retain_period_days
    backup_window_start {
      hours   = 2
      minutes = 0
    }
  }

  host {
    zone             = var.zone
    subnet_id        = yandex_vpc_subnet.app.id
    assign_public_ip = false
  }
}

resource "yandex_mdb_postgresql_user" "app" {
  cluster_id = yandex_mdb_postgresql_cluster.main.id
  name       = local.database_user
  password   = var.db_password
}

resource "yandex_mdb_postgresql_database" "app" {
  cluster_id = yandex_mdb_postgresql_cluster.main.id
  name       = local.database_name
  owner      = yandex_mdb_postgresql_user.app.name
}

resource "yandex_storage_bucket" "backups" {
  bucket = var.backup_bucket_name

  lifecycle_rule {
    id      = "daily-retention"
    enabled = true

    filter {
      prefix = "postgres/daily/"
    }

    expiration {
      days = var.backup_daily_retention_days
    }
  }

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
      size     = 20
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
      domain_name       = var.domain_name
      database_url      = "postgres://${local.database_user}:${urlencode(var.db_password)}@c-${yandex_mdb_postgresql_cluster.main.id}.rw.mdb.yandexcloud.net:6432/${local.database_name}?sslmode=require"
      allowed_emails    = var.allowed_emails
      backup_bucket     = var.backup_bucket_name
      lockbox_secret_id = yandex_lockbox_secret.app.id
    })
  }
}

resource "yandex_dns_recordset" "todo" {
  zone_id = yandex_dns_zone.public.id
  name    = "${var.domain_name}."
  type    = "A"
  ttl     = 300
  data    = [yandex_vpc_address.app.external_ipv4_address[0].address]
}
