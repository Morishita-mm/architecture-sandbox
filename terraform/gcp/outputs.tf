output "repository_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}"
}
output "gemini_secret_id" {
  value = google_secret_manager_secret.gemini.secret_id
}
output "backend_url" {
  value = try(google_cloud_run_v2_service.backend[0].uri, null)
}
output "frontend_origin" {
  value = var.frontend_origin
}
output "github_workload_identity_provider" {
  value = try(google_iam_workload_identity_pool_provider.github[0].name, null)
}
output "github_deploy_service_account" {
  value = try(google_service_account.deployer[0].email, null)
}
