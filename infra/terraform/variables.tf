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

variable "root_domain_name" {
  type        = string
  default     = "anton415.ru"
  description = "Root domain delegated to Yandex Cloud DNS."
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key for VM access."
}

variable "production_ssh_allowed_cidrs" {
  type        = list(string)
  default     = []
  description = "IPv4 CIDR blocks allowed to SSH into the production VM. Leave empty to disable public SSH; use /32s for individual admin addresses or a narrow VPN/bastion range."

  validation {
    condition = alltrue([
      for cidr in var.production_ssh_allowed_cidrs :
      try(cidrnetmask(cidr), "") != "" && try(tonumber(split("/", cidr)[1]), -1) >= 24
    ])
    error_message = "production_ssh_allowed_cidrs must contain valid IPv4 CIDRs with prefix length /24 or narrower; use /32 for a single admin IP and never 0.0.0.0/0."
  }
}

variable "image_tag" {
  type        = string
  default     = "main"
  description = "Container image tag to boot on first VM start."
}

variable "backup_bucket_name" {
  type        = string
  description = "Object Storage bucket for independent pg_dump archives."
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

variable "vm_boot_disk_size" {
  type        = number
  default     = 30
  description = "Boot disk size in GB. It also stores the Docker PostgreSQL volume for the budget v1 deployment."
}

variable "vm_core_fraction" {
  type        = number
  default     = 20
  description = "Baseline vCPU performance for the personal Todo VM. Use 20, 50, or 100."
}
