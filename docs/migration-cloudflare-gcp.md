# Cloudflare / GCPへの移植

## 構成と移植範囲

公開予定は `https://sandbox.morimizu.dev`。morimizu-siteと同じCloudflare Workers Static AssetsでReact SPAを配信し、ブラウザからGCP Cloud RunのRust APIへHTTPSで接続する。Cloud Run / Artifact Registryはtech-interviewerと同じ東京（`asia-northeast1`）を採用する。tech-interviewer固有のFirebase Hosting・Firestore・認証機構は、このstatelessアプリには追加しない。

```text
Browser ── HTTPS ── sandbox.morimizu.dev (Cloudflare Workers Static Assets)
        └─ HTTPS ── Cloud Run API (Tokyo) ── Gemini / TinyURL
                              └─ Secret Manager: Gemini API key
```

| 旧AWS | 移植先 |
| --- | --- |
| S3 / CloudFront | Cloudflare Workers Static Assets、SPA fallback、Custom Domain |
| App Runner | Cloud Run、min 0 / max 2 instances、1 vCPU / 512 MiB、concurrency 8 |
| ECR | Artifact Registry、Linux amd64、Git SHAタグから固定digestで配置 |
| Terraformの平文APIキー変数 | Secret Manager、数値version固定、専用runtime SAへのsecret単位のaccessor |
| 手動AWS deploy scripts | `deploy_b.sh`（image push）、`deploy_f.sh`（Cloudflare）、GCP Terraform |

移植後の全体レビューで、内部要件をサーバーへ移し、公開Scenarioだけを受け取るAPIへ変更した。フロントエンドとバックエンドを同じ版で配置する。旧Base64ファイル・挑戦状は読み込みを維持し、新規保存・共有は公開データのJSONを使う。詳しい互換性、制限、匿名APIの残存リスクは[セキュリティレビュー](security-review.md)を参照。

## 費用

2026-09-13に公式料金を確認。Cloudflare静的アセットへのリクエストは無料・無制限で、この構成のためのWorkers有料プラン契約は不要。[Cloudflare](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

GCPは請求先の有効化が必要。Cloud Runはリクエスト課金・min instances 0で待機コストを抑える。実行時間、メモリ、リクエスト、外向き通信は利用量に応じて課金される。無料枠を他サービスと共有する場合もあるため、無料運用は保証しない。[Cloud Run料金](https://cloud.google.com/run/pricing)

Artifact Registryは請求先全体の最初の0.5 GiBが無料で、超過した保存容量は課金される。Secret Managerは有効version数とアクセス回数、Terraform用GCSは保存・操作に料金がある。既存イメージはrollbackに必要なものを確認してから整理する。[Artifact Registry](https://cloud.google.com/artifact-registry/pricing)、[Secret Manager](https://cloud.google.com/secret-manager/pricing)、[Cloud Storage](https://cloud.google.com/storage/pricing)

Geminiは既存の `gemini-2.5-flash` を維持し、利用するキーの料金枠・入出力token量で費用が変わる。モデル名は設定で変更可能。新しい課金契約や実API呼び出しはローカル検証に不要。[Gemini料金](https://ai.google.dev/gemini-api/docs/pricing)

利用頻度・既存請求先の無料枠消費量が未確定なので月額合計は未算出。公開前にGemini側のquotaとGCP予算通知を確認する。予算通知は自動停止ではなく、max instances 2も月額上限ではない。AWSを停止・削除するまでは旧環境の費用が残る。

## ローカル開発と検証

Node 22、Rust 1.93、Terraform 1.9以上、Dockerを使用する。`.env.example`を`.env`へコピーし、実AIを試す場合のみローカルでキーを設定する。

```sh
cp .env.example .env
# .envを編集。キーはコミットしない。
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

UIは `http://localhost:5173`、APIは `http://localhost:8080`。PostgreSQLは不要。Cargoを直接実行する場合は `.env` をshellへexportし、`backend/`から `cargo run --locked` を実行する。

```sh
(cd backend && cargo fmt --all -- --check && cargo clippy --locked --all-targets -- -D warnings && cargo test --locked && cargo build --locked)
node --test scripts/backend.test.mjs
(cd frontend && npm ci && npm run lint && npm test && VITE_API_BASE_URL=https://api.example.com npm run build && npm run deploy:check)
terraform -chdir=terraform/gcp init -backend=false -lockfile=readonly
terraform -chdir=terraform/gcp validate
terraform -chdir=terraform/gcp test
docker build --platform linux/amd64 -f Dockerfile.prod -t architecture-sandbox:test .
node scripts/container-smoke.mjs architecture-sandbox:test
```

APIテストはローカル疑似Geminiだけを呼び出す。`cargo test`単体は既存のRust unit testが0件なので、必ずNodeのHTTP統合テストを実行する。CIも同じ検証を行う。

本番buildにはHTTPSの `VITE_API_BASE_URL` を必須とし、設定漏れで利用者のlocalhostへ通信しないようにする。Cloudflare配信のローカル確認には `VITE_API_BASE_URL=http://localhost:8080 npm run build:local` → `npm run preview:cloudflare` を使用し、APIの `FRONTEND_ORIGIN=http://localhost:8787` と一致させる。

## 初回配置

本番操作前に移植先GCP project、既存billing accountの利用、Cloudflare account、Secretの登録元を確定する。他アプリのGCP既定projectやTerraform stateを暗黙利用しない。GCP project新設・billing・IAM・公開設定・DNS切替は実行対象を確認してから行う。

1. 選定したGCP projectを用意し、請求先を有効化する。Terraform state用に非公開・uniform bucket-level access・public access prevention・versioning付きGCS bucketを用意する。既存の保護されたstate bucketを利用する場合もprefixは `architecture-sandbox/gcp` に分離する。
2. Terraform用のApplication Default Credentialsを確認する。既存認証で不足する場合のみ `gcloud auth application-default login` を実施する。`terraform/gcp/backend.hcl.example` と `terraform.tfvars.example` を同じディレクトリ内の `.example` なしのファイルへコピーし、実値を記入する。Secret値は記入しない。
3. `enable_service=false` / `public_invocation_enabled=false` のまま基盤をplanし、内容を確認してapplyする。

```sh
terraform -chdir=terraform/gcp init -reconfigure -backend-config=backend.hcl
terraform -chdir=terraform/gcp plan -out=foundation.tfplan
terraform -chdir=terraform/gcp apply foundation.tfplan
```

この段階で作るのは必要API、専用Artifact Registry、runtime service account、Secretの容器とsecret単位のaccessorであり、Cloud Runはまだ作らない。image / Secret / serviceの初回依存を分けるための `enable_service` で、`-target` は使わない。

4. Gemini APIキーをSecret Managerの `architecture-sandbox-gemini-api-key` に登録し、数値versionを控える。Cloud Consoleまたは保護されたローカルファイルを入力に使う。キーをコマンド引数、チャット、tfvars、ログへ貼らない。登録後 `gemini_secret_version` を設定する。
5. 検証済み変更をcommit後、明示したprojectへimageをpushする。スクリプトはdirty treeを拒否し、Terraformを自動applyしない。

```sh
GCP_PROJECT_ID=SELECTED_PROJECT_ID ./deploy_b.sh
```

6. 出力されたdigestを `image_ref` に設定し、`enable_service=true` / `public_invocation_enabled=false` としてplan/applyする。API起動時のキー・定義JSONの検証、コンテナの `/healthz` probeを確認する。

```sh
terraform -chdir=terraform/gcp plan -out=service.tfplan
terraform -chdir=terraform/gcp apply service.tfplan
terraform -chdir=terraform/gcp output -raw backend_url
# 権限のあるownerがローカル認証proxy経由でhealthを確認する。
gcloud run services proxy architecture-sandbox-api --region=asia-northeast1 --project=SELECTED_PROJECT_ID --port=8081
# 別terminalで curl --fail http://localhost:8081/healthz
```

7. 匿名公開を承認後、`public_invocation_enabled=true` のplanで、このserviceだけに `allUsers / roles/run.invoker` が追加されることを確認してapplyする。ブラウザはrun.appへ直接APIリクエストを送るため、この手順が必要。Gemini利用のquota・課金を確認する。
8. `backend_url` を `VITE_API_BASE_URL` に指定してCloudflareへデプロイする。`wrangler.jsonc` のCustom Domainが `sandbox.morimizu.dev` を設定する。workers.devとversion preview URLsは無効。既存DNS recordがある場合は上書き前に用途を確認する。

```sh
export CLOUDFLARE_ACCOUNT_ID=SELECTED_CLOUDFLARE_ACCOUNT_ID
export VITE_API_BASE_URL="$(terraform -chdir=terraform/gcp output -raw backend_url)"
./deploy_f.sh
```

Cloudflare認証には既存のWrangler認証、または必要範囲のAPI tokenを使用する。GitHub Actionsでは `production` Environmentへ `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` secretsと `VITE_API_BASE_URL` variableを設定し、mainの `Deploy frontend to Cloudflare` を手動実行する。PR CIは外部へ配置しない。

## 本番の受入・切替・rollback

ローカル成功だけでは本番完了にしない。配置したGit SHA、image digest、Cloud Run revision、Cloudflare versionを記録し、次を実測する。

- `sandbox.morimizu.dev` のTLS、トップ、再読込、SPA fallback、challenge queryの読込。
- 新Cloud RunへのCORS preflight、チャット、評価（実Gemini、所有者のテストデータ）、障害時表示。API deadlineは120秒、Gemini全体は90秒以内。
- ノードの追加・選択・プロパティ編集・グループ操作、JSON保存・復元。既存challenge URLのpayload互換性。TinyURLによる共有。
- 公開前後のIAM、Secret version、最小0 / 最大2、不要なDB / NAT / 常駐サービスがないこと。
- 新環境で受入後にリンクを新URLへ変更。旧cloudfront.net / awsapprunner.comのURLはDNSで引き継げないため、必要な旧リンクはAWS側のredirect等を別途検討する。

障害時は確認済みCloud Run digestとCloudflare versionへ戻す。API停止は `public_invocation_enabled=false` のplanを確認してapplyする。新環境の受入と切替が完了するまで旧AWSはそのまま保全する。停止・削除はAWSの実リソース/stateを確認し、別途承認後に行う。GCPのstateを旧AWS rootで操作しない。

## 参照

- [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract)
- [Cloud Run / Secret Manager](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Cloudflare SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)

## 移植実装時点（bb5f34e）の検証結果

以降のセキュリティ修正と最新の検証は[セキュリティレビュー](security-review.md)を参照。

- Rust: fmt / clippy（warningsをエラー扱い）/ build / test成功。HTTP統合テスト13件成功（実Gemini呼び出し0）。
- Frontend: lint成功、Vite設定テスト7件成功、production / development build成功、Wrangler dry-run成功。npm auditは全依存で既知脆弱性0件。
- Terraform: validate成功、mock providerを使うplan test 4件成功。Mac ARM64 / Linux AMD64のprovider checksumを固定。
- Docker: linux/amd64 build成功、非root UID 10001、PORT=9090、定義ファイルを含む起動、health、SIGTERM終了を確認。Compose設定とshell構文も成功。
- Browser: Cloudflareローカル配信→Rust→疑似Geminiでチャット、ノード追加、プロパティの編集・閉じる・再選択、評価82点表示、実ファイルへの保存とそのファイルからの復元を確認。確認時のbrowser console errorは0件。HTTPでSPA深いパス・queryとヘッダーを確認。
- Cloudflare: `morimizu.dev` zoneがactive、`sandbox.morimizu.dev`に既存DNS / Worker Custom Domainがないことを読み取り確認。
- 本番未実施: project / billing / Secret登録、GCP apply、Cloudflare deploy、実Gemini・TinyURL、実ドメインのTLS・CORS、AWS切替・撤去。GitHub CI結果はPRを参照。
- ChatGPT: このworkspaceの既存連携先が未設定のため独立レビューは未実施。この時点では新規連携・認証・権限変更はしていない。

Viteは大きなbundle（約828 kB、gzip約256 kB）を警告する。buildは成功しており、今回の移植では既存画面の分割は行っていない。
