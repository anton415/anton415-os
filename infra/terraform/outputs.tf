output "registry_id" {
  value = yandex_container_registry.app.id
}

output "deploy_service_account_id" {
  value = yandex_iam_service_account.deploy.id
}

output "app_public_ip" {
  value = yandex_vpc_address.app.external_ipv4_address[0].address
}

output "lockbox_secret_id" {
  value = yandex_lockbox_secret.app.id
}

output "backup_bucket" {
  value = yandex_storage_bucket.backups.bucket
}

output "dns_zone_id" {
  value = yandex_dns_zone.public.id
}

output "domain_nameservers" {
  value = [
    "ns1.yandexcloud.net.",
    "ns2.yandexcloud.net.",
  ]
}
