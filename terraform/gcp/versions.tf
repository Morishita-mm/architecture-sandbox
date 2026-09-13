terraform {
  required_version = ">= 1.9.0, < 2.0.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.45"
    }
  }
  # A dedicated prefix; never reuse the old AWS state or another app's state.
  backend "gcs" {}
}
provider "google" {
  project = var.project_id
  region  = var.region
}
