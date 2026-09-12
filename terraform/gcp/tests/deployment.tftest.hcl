mock_provider "google" {}
variables {
  # Keep local production tfvars from changing these isolated plan fixtures.
  project_id                = "sandbox-test-project"
  region                    = "asia-northeast1"
  enable_service            = false
  public_invocation_enabled = false
  image_ref                 = ""
  gemini_secret_version      = ""
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
