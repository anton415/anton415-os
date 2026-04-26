variable "cloud_id" {
  type        = string
  description = "Yandex Cloud ID."
}

variable "folder_id" {
  type        = string
  description = "Yandex Cloud folder ID."
}

variable "zone" {
  type        = string
  default     = "ru-central1-a"
  description = "Primary availability zone."
}

variable "domain_name" {
  type        = string
  default     = "todo.anton415.ru"
  description = "Canonical production hostname."
}

variable "root_domain_name" {
  type        = string
  default     = "anton415.ru"
  description = "Root domain delegated to Yandex Cloud DNS."
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key for VM access."
}

variable "image_tag" {
  type        = string
  default     = "main"
  description = "Container image tag to boot on first VM start."
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Initial PostgreSQL application user password."
}

variable "allowed_emails" {
  type        = string
  sensitive   = true
  description = "Comma-separated auth allowlist."
}

variable "backup_bucket_name" {
  type        = string
  description = "Object Storage bucket for independent pg_dump archives."
}

variable "postgres_resource_preset_id" {
  type    = string
  default = "c3-c2-m4"
}

variable "postgres_disk_size" {
  type    = number
  default = 10
}

variable "vm_platform_id" {
  type    = string
  default = "standard-v3"
}

variable "vm_cores" {
  type    = number
  default = 2
}

variable "vm_memory" {
  type    = number
  default = 2
}

variable "vm_core_fraction" {
  type        = number
  default     = 20
  description = "Baseline vCPU performance for the personal Todo VM. Use 20, 50, or 100."
}
