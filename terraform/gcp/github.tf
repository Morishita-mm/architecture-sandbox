# Bootstrap this trust once with the infrastructure owner's credentials.
# Deployments cannot read Secrets or modify IAM/Terraform state directly.
resource "google_project_service" "github_auth" {
  for_each = var.enable_github_deploy ? toset([
    "iamcredentials.googleapis.com", "sts.googleapis.com",
  ]) : toset([])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
resource "google_service_account" "deployer" {
  count        = var.enable_github_deploy ? 1 : 0
  account_id   = "architecture-sandbox-deploy"
  display_name = "Architecture Sandbox GitHub release"
  depends_on   = [google_project_service.required["iam.googleapis.com"]]
}
resource "google_iam_workload_identity_pool" "github" {
  count                     = var.enable_github_deploy ? 1 : 0
  workload_identity_pool_id = "architecture-github"
  display_name              = "Architecture Sandbox GitHub"
  depends_on                = [google_project_service.github_auth]
}
resource "google_iam_workload_identity_pool_provider" "github" {
  count                              = var.enable_github_deploy ? 1 : 0
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "production"
  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
    "attribute.workflow_ref"        = "assertion.workflow_ref"
  }
  # Numeric identities prevent a renamed/deleted repository being impersonated.
  attribute_condition = join(" && ", [
    "assertion.repository_owner_id == '183205013'",
    "assertion.repository_id == '1109877269'",
    "assertion.ref == 'refs/heads/main'",
    "assertion.sub == 'repo:Morishita-mm/architecture-sandbox:environment:production'",
    "assertion.workflow_ref == 'Morishita-mm/architecture-sandbox/.github/workflows/deploy.yml@refs/heads/main'",
  ])
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}
resource "google_service_account_iam_member" "github_deployer" {
  count              = var.enable_github_deploy ? 1 : 0
  service_account_id = google_service_account.deployer[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository_id/1109877269"
}
resource "google_artifact_registry_repository_iam_member" "deployer" {
  count      = var.enable_github_deploy ? 1 : 0
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.backend.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer[0].email}"
}
resource "google_service_account_iam_member" "deployer_runtime" {
  count              = var.enable_github_deploy ? 1 : 0
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer[0].email}"
}
resource "google_cloud_run_v2_service_iam_member" "deployer" {
  for_each = var.enable_github_deploy && var.enable_service ? toset([
    "roles/run.developer", "roles/run.invoker",
  ]) : toset([])
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend[0].name
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer[0].email}"
}
