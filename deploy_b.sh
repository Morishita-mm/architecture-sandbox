#!/usr/bin/env bash
# Build and publish an immutable candidate; Terraform apply is a separate step.
set -euo pipefail
cd "$(dirname "$0")"
: "${GCP_PROJECT_ID:?Set the explicitly selected GCP project ID}"
GCP_REGION="${GCP_REGION:-asia-northeast1}"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit the reviewed changes before publishing an image." >&2
  exit 1
fi
revision="$(git rev-parse HEAD)"
registry="${GCP_REGION}-docker.pkg.dev"
image="${registry}/${GCP_PROJECT_ID}/architecture-sandbox/backend:${revision}"
# Build with the existing Docker context/plugins before isolating registry auth.
docker build --platform linux/amd64 -f Dockerfile.prod --label "org.opencontainers.image.revision=${revision}" -t "$image" .
# Use a temporary Docker auth file, not the user's persistent credential config.
docker_auth_dir="$(mktemp -d)"
trap 'rm -rf "$docker_auth_dir"' EXIT
export DOCKER_HOST="${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}')}"
export DOCKER_CONFIG="$docker_auth_dir"
gcloud auth print-access-token --project="$GCP_PROJECT_ID" | docker login -u oauth2accesstoken --password-stdin "https://${registry}"
docker push "$image"
digest="$(gcloud artifacts docker images describe "$image" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')"
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "No immutable digest returned" >&2; exit 1; }
printf 'Set image_ref to: %s@%s\n' "${image%:*}" "$digest"
