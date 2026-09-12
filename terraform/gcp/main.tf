locals {
  name = "architecture-sandbox"
  required_services = toset([
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
  ])
}
resource "google_project_service" "required" {
  for_each           = local.required_services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
resource "google_artifact_registry_repository" "backend" {
  location      = var.region
  repository_id = local.name
  format        = "DOCKER"
  lifecycle { prevent_destroy = true }
  depends_on = [google_project_service.required["artifactregistry.googleapis.com"]]
}
resource "google_service_account" "backend" {
  account_id   = "architecture-sandbox-api"
  display_name = "Architecture Sandbox Cloud Run runtime"
  depends_on   = [google_project_service.required["iam.googleapis.com"]]
}
resource "google_secret_manager_secret" "gemini" {
  secret_id = "architecture-sandbox-gemini-api-key"
  replication {
    auto {}
  }
  lifecycle { prevent_destroy = true }
  depends_on = [google_project_service.required["secretmanager.googleapis.com"]]
}
resource "google_secret_manager_secret_iam_member" "backend" {
  secret_id = google_secret_manager_secret.gemini.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}
resource "google_cloud_run_v2_service" "backend" {
  count                = var.enable_service ? 1 : 0
  name                 = "architecture-sandbox-api"
  location             = var.region
  deletion_protection  = true
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = false

  template {
    service_account                  = google_service_account.backend.email
    timeout                          = "120s"
    max_instance_request_concurrency = 8
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    containers {
      image = var.image_ref
      ports { container_port = 8080 }
      resources {
        limits   = { cpu = "1", memory = "512Mi" }
        cpu_idle = true
      }
      env {
        name  = "FRONTEND_ORIGIN"
        value = var.frontend_origin
      }
      env {
        name  = "AI_MODEL_NAME"
        value = var.ai_model_name
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini.secret_id
            version = var.gemini_secret_version
          }
        }
      }
      startup_probe {
        http_get { path = "/healthz" }
        initial_delay_seconds = 0
        period_seconds        = 3
        timeout_seconds       = 1
        failure_threshold     = 10
      }
      liveness_probe {
        http_get { path = "/healthz" }
        period_seconds    = 30
        timeout_seconds   = 1
        failure_threshold = 3
      }
    }
  }
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = can(regex("^${var.region}-docker\\.pkg\\.dev/${var.project_id}/${local.name}/backend@sha256:[a-f0-9]{64}$", var.image_ref))
      error_message = "Deploy a digest from this project's Architecture Sandbox Artifact Registry repository."
    }
    precondition {
      condition     = var.gemini_secret_version != ""
      error_message = "Add a Gemini Secret version before enabling the service."
    }
  }
  depends_on = [
    google_project_service.required["run.googleapis.com"],
    google_secret_manager_secret_iam_member.backend,
  ]
}
resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.enable_service && var.public_invocation_enabled ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
