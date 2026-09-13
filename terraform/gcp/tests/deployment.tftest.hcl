mock_provider "google" {}
variables {
  # Keep local production tfvars from changing these isolated plan fixtures.
  project_id                = "sandbox-test-project"
  region                    = "asia-northeast1"
  enable_service            = false
  enable_github_deploy      = false
  public_invocation_enabled = false
  image_ref                 = ""
  gemini_secret_version     = ""
}
run "foundation_only" {
  command = plan
  assert {
    condition     = length(google_cloud_run_v2_service.backend) == 0
    error_message = "Bootstrap must not create an unconfigured Cloud Run service."
  }
  assert {
    condition     = length(google_cloud_run_v2_service_iam_member.public) == 0
    error_message = "Bootstrap must not grant anonymous invocation."
  }
}
run "private_service" {
  command = plan
  variables {
    enable_service        = true
    image_ref             = "asia-northeast1-docker.pkg.dev/sandbox-test-project/architecture-sandbox/backend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    gemini_secret_version = "1"
  }
  assert {
    condition     = google_cloud_run_v2_service.backend[0].template[0].scaling[0].min_instance_count == 0
    error_message = "Idle services must scale to zero."
  }
  assert {
    condition     = length(google_cloud_run_v2_service_iam_member.public) == 0
    error_message = "Service creation must not implicitly publish the API."
  }
}
run "reject_mutable_image" {
  command = plan
  variables {
    enable_service        = true
    image_ref             = "asia-northeast1-docker.pkg.dev/sandbox-test-project/architecture-sandbox/backend:latest"
    gemini_secret_version = "1"
  }
  expect_failures = [google_cloud_run_v2_service.backend]
}
run "reject_unpinned_secret" {
  command = plan
  variables { gemini_secret_version = "latest" }
  expect_failures = [var.gemini_secret_version]
}
run "github_deployment_scope" {
  command = plan
  variables {
    enable_github_deploy  = true
    enable_service        = true
    image_ref             = "asia-northeast1-docker.pkg.dev/sandbox-test-project/architecture-sandbox/backend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    gemini_secret_version = "1"
  }
  assert {
    condition = alltrue([
      strcontains(google_iam_workload_identity_pool_provider.github[0].attribute_condition, "assertion.repository_id == '1109877269'"),
      strcontains(google_iam_workload_identity_pool_provider.github[0].attribute_condition, "assertion.repository_owner_id == '183205013'"),
      strcontains(google_iam_workload_identity_pool_provider.github[0].attribute_condition, "assertion.ref == 'refs/heads/main'"),
      strcontains(google_iam_workload_identity_pool_provider.github[0].attribute_condition, ":environment:production'"),
      strcontains(google_iam_workload_identity_pool_provider.github[0].attribute_condition, ".github/workflows/deploy.yml@refs/heads/main'"),
    ])
    error_message = "Deployment identity must be restricted by immutable repo identity, branch, environment and workflow."
  }
  assert {
    condition     = length(google_cloud_run_v2_service_iam_member.public) == 0
    error_message = "Enabling CI/CD must never grant anonymous invocation."
  }
  assert {
    condition     = alltrue([for claim in ["assertion.sub", "assertion.repository_id", "assertion.repository_owner_id", "assertion.ref", "assertion.workflow_ref"] : contains(values(google_iam_workload_identity_pool_provider.github[0].attribute_mapping), claim)])
    error_message = "Every condition claim must be mapped before it can be asserted."
  }
  assert {
    condition     = toset(keys(google_cloud_run_v2_service_iam_member.deployer)) == toset(["roles/run.developer", "roles/run.invoker"])
    error_message = "Deployer needs only service delivery and health-check roles on the existing API."
  }
}
