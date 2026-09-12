#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/frontend"
: "${VITE_API_BASE_URL:?Set the deployed HTTPS Cloud Run origin}"
: "${CLOUDFLARE_ACCOUNT_ID:?Set the intended Cloudflare account ID}"
export VITE_API_BASE_URL
export VITE_APP_SHARE_URL="${VITE_APP_SHARE_URL:-https://sandbox.morimizu.dev}"
npm ci
npm run lint
npm test
npm run build
npm run deploy:check
npm run deploy
