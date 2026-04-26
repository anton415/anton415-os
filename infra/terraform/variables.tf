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

variable "postgres_backup_retain_period_days" {
  type        = number
  default     = 7
  description = "Managed PostgreSQL automatic backup retention. Yandex allows 7 to 60 days; 7 is the budget baseline."

  validation {
    condition     = var.postgres_backup_retain_period_days >= 7 && var.postgres_backup_retain_period_days <= 60
    error_message = "postgres_backup_retain_period_days must be between 7 and 60."
  }
}

variable "backup_daily_retention_days" {
  type        = number
  default     = 7
  description = "Retention for independent daily pg_dump archives in Object Storage."

  validation {
    condition     = var.backup_daily_retention_days >= 1
    error_message = "backup_daily_retention_days must be at least 1."
  }
}

variable "backup_monthly_retention_days" {
  type        = number
  default     = 90
  description = "Retention for independent monthly pg_dump archives in Object Storage."

  validation {
    condition     = var.backup_monthly_retention_days >= 7
    error_message = "backup_monthly_retention_days must be at least 7."
  }
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
