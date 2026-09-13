#!/usr/bin/env bash
# Release the exact container tested by this GitHub Actions run. Never change IAM.
set -euo pipefail
: "${GCP_PROJECT_ID:?}"
: "${GCP_REGION:?}"
: "${GITHUB_SHA:?}"
: "${GITHUB_RUN_ID:?}"
: "${GITHUB_RUN_ATTEMPT:?}"
: "${GITHUB_OUTPUT:?}"
[[ "$GCP_PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]
[[ "$GCP_REGION" == asia-northeast1 ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
service=architecture-sandbox-api
revision="${service}-${GITHUB_SHA:0:7}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
[[ ${#revision} -le 63 ]]
export EXPECTED_REVISION="$revision"
common=(--project="$GCP_PROJECT_ID" --region="$GCP_REGION" --quiet)
case "${1:-}" in
  candidate)
    backend_url="$(gcloud run services describe "$service" "${common[@]}" --format='value(status.url)')"
    [[ "$backend_url" =~ ^https://[a-z0-9-]+\.a\.run\.app$ ]]
    # First public release is a separate, explicit infrastructure decision.
    # Failing here leaves the running service, registry and frontend unchanged.
    if ! curl --fail --silent --show-error --max-time 20 "$backend_url/health" >/dev/null; then
      echo 'Complete the approved public API bootstrap before running a production release.' >&2
      exit 1
    fi
    previous_revision="$(gcloud run services describe "$service" "${common[@]}" --format=json | node -e '
      let data=""; process.stdin.on("data", c=>data+=c); process.stdin.on("end", ()=>{
        const traffic=JSON.parse(data).status.traffic.filter(t=>t.percent>0);
        if(traffic.length!==1 || traffic[0].percent!==100) process.exit(1);
        console.log(traffic[0].revisionName);
      });')"
    [[ "$previous_revision" =~ ^architecture-sandbox-api-[a-z0-9-]+$ ]]
    source_revision="$(docker image inspect architecture-sandbox:tested --format='{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
    [[ "$source_revision" == "$GITHUB_SHA" ]] || { echo 'Tested image source does not match this release.' >&2; exit 1; }
    image="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/architecture-sandbox/backend"
    gcloud auth print-access-token --project="$GCP_PROJECT_ID" | docker login -u oauth2accesstoken --password-stdin "https://${GCP_REGION}-docker.pkg.dev"
    docker tag architecture-sandbox:tested "$image:$GITHUB_SHA"
    docker push "$image:$GITHUB_SHA"
    digest="$(gcloud artifacts docker images describe "$image:$GITHUB_SHA" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')"
    [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]
    gcloud run services update "$service" "${common[@]}" --image="$image@$digest" \
      --revision-suffix="${revision#"$service-"}" --no-traffic --tag=candidate
    candidate_url="$(gcloud run services describe "$service" "${common[@]}" --format=json | node -e '
      let data=""; process.stdin.on("data", c=>data+=c); process.stdin.on("end", ()=>{
        const candidate=JSON.parse(data).status.traffic.find(t=>t.tag==="candidate");
        if(!candidate || candidate.revisionName!==process.env.EXPECTED_REVISION) process.exit(1);
        console.log(candidate.url);
      });')"
    [[ "$candidate_url" =~ ^https://candidate---[a-z0-9-]+\.a\.run\.app$ ]]
    printf 'backend_url=%s\ncandidate_url=%s\nrevision=%s\nprevious_revision=%s\nimage_ref=%s\n' \
      "$backend_url" "$candidate_url" "$revision" "$previous_revision" "$image@$digest" >> "$GITHUB_OUTPUT"
    ;;
  promote)
    gcloud run services update-traffic "$service" "${common[@]}" --to-revisions="$revision=100" --remove-tags=candidate
    ;;
  *) echo 'Usage: deploy-backend.sh candidate|promote' >&2; exit 1 ;;
esac
