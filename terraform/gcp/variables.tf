variable "project_id" {
  description = "Explicitly selected, billing-enabled GCP project. Never inferred from gcloud defaults."
  type        = string
}
variable "region" {
  type    = string
  default = "asia-northeast1"
}
variable "frontend_origin" {
  type    = string
  default = "https://sandbox.morimizu.dev"
  validation {
    condition     = can(regex("^https://[a-z0-9.-]+$", var.frontend_origin))
    error_message = "Use one exact HTTPS origin without a trailing slash."
  }
}
variable "enable_service" {
  description = "Bootstrap with false; enable after pushing the image and adding a Secret version."
  type        = bool
  default     = false
}
variable "image_ref" {
  description = "Immutable Artifact Registry image digest."
  type        = string
  default     = ""
}
variable "gemini_secret_version" {
  description = "Pinned numeric Secret Manager version; no secret payload enters Terraform."
  type        = string
  default     = ""
  validation {
    condition     = var.gemini_secret_version == "" || can(regex("^[1-9][0-9]*$", var.gemini_secret_version))
    error_message = "Use a numeric Secret version, never latest."
  }
}
variable "ai_model_name" {
  type    = string
  default = "gemini-3.5-flash-lite"
}
variable "public_invocation_enabled" {
  description = "Enable only when the API is ready for anonymous browser access. CORS is not authentication."
  type        = bool
  default     = false
}
