# CI/CD

GitHub ActionsからCloud RunとCloudflare Workersへ配置する。AWSへの配置処理は廃止し、旧 `deploy_b.sh` / `deploy_f.sh` とフロントエンド単独workflowは削除した。旧AWS Terraformとstateはリソースの廃止判断に必要なので保全し、このCI/CDからは操作しない。

## 実行の流れ

PRは `CI Pipeline` でRust、API統合、フロントエンド、ブラウザー回帰、Terraform、デプロイ処理を検証する。PRからクラウドへ認証・配置しない。

mainへのpushまたはmainを選んだ `Production release` の手動実行で、同じCIを再利用する。CIに成功した後、GitHubのproduction Environmentの承認を経て次を実行する。

1. CIでビルド・起動検証済みのコンテナを同じrunのartifactから取得する。imageのGit SHAラベルが対象コミットと一致しなければ中止する。認証ファイルを含めた再ビルドは行わない。
2. GitHub OIDC / Workload Identity Federationで、限定したデプロイ用サービスアカウントを短時間だけ使用する。GCPの長期キーやGeminiキーをGitHub Secretsに保存しない。
3. Artifact Registryへpushし、取得したdigestを指定してCloud Run candidateを作る。既存トラフィックを維持したまま、候補のhealth・CORS・不正入力拒否を確認する。Geminiの実呼び出しはない。
4. 実際のAPI URLでフロントエンドをbuildし、Wrangler dry-runを行う。成功後にAPIのトラフィックを候補へ移し、Workersへ配信する。
5. 公開APIとトップ・SPA深いパス・CSPを確認する。run summaryにGit SHA、digest、候補revision、以前の稼働revisionを残す。成功判定は各stepの結果で確認する。

配置は共通のconcurrency groupで直列化し、実行中の配置を新しいpushで中断しない。候補確認までに失敗した場合は旧APIが稼働を続ける。API切替後にWorkersの配信・公開確認が失敗した場合は、下記の手順で状況を確認して復旧する。曖昧な配信結果を自動で再実行・巻き戻ししない。

## 初回に必要な設定

現在の非公開APIを起点に、次の準備を行う。これらはworkflowが自動で有効化する設定ではない。

- Gemini quotaと請求監視、匿名APIの利用方針、独立レビューを確認する。公開の承認後、所有者がTerraformの `public_invocation_enabled=true` をplan/applyする。CDは公開設定・IAMを変更せず、APIがまだ非公開なら最初のhealth確認で止まる。
- 所有者が `enable_github_deploy=true` のplanを確認し適用する。専用identity・必要API・対象リソースの権限を追加する。初期値はfalse。既存サービスの作り直しや匿名bindingの追加を含めない。
- [GitHub Environments](https://github.com/Morishita-mm/architecture-sandbox/settings/environments) に `production` を作り、デプロイ可能なbranchをmainに限定し、所有者の承認を必須にする。mainの保護ではCIの各検証ジョブを必須チェックにする。
- 同Environmentへ次の値を登録する。API URLはCloud Runから取得するため、手作業で転記しない。

| 種別 | 名前 | 値 |
|---|---|---|
| Variable | `GCP_PROJECT_ID` | 選定済みGCP project ID |
| Variable | `GCP_WIF_PROVIDER` | Terraform output `github_workload_identity_provider` |
| Variable | `GCP_DEPLOY_SERVICE_ACCOUNT` | Terraform output `github_deploy_service_account` |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | 対象Cloudflare account ID |
| Secret | `CLOUDFLARE_API_TOKEN` | 対象account・zoneに限定したWorkers配置token |

Cloudflare tokenは[API Tokens](https://dash.cloudflare.com/profile/api-tokens)のWorkers編集用テンプレートを起点に、対象accountとmorimizu.devのzoneへ絞る。独自ドメインの配置に必要な範囲を含める。値はGitHubのEnvironment Secretへ直接登録し、チャットやリポジトリへ貼らない。他リポジトリのGitHub Secretをこのリポジトリから読み出すことはできない。

公開初回は `sandbox.morimizu.dev` の既存DNS用途も確認する。`workers.dev` とversion preview URLは無効。DNS切替・実Geminiの採点品質・本番画面操作・共有リンクは自動smokeだけでは受入完了にならない。

## 権限と設定の所有者

Google側の信頼条件は、このrepository/ownerの数値ID、main、production Environment、`.github/workflows/deploy.yml` の一致をすべて要求する。claimは条件で使用する前にattributeへmapする。`id-token: write` は本番配置jobだけへ付与する。

| デプロイ用identityの権限 | 適用範囲 |
|---|---|
| Artifact Registry Writer | このアプリのrepository |
| Cloud Run Developer / Invoker | 既存のこのAPI service |
| Service Account User | このアプリのruntime service account |
| Workload Identity User | 上記条件を満たすGitHub identityからの代理利用 |

デプロイ処理にはSecret payloadの直接読取権限、IAM変更権限、Terraform stateへの権限を付けない。ただしデプロイ権限はruntimeとして動くコードの更新権限なので、mainの変更とproductionの承認はセキュリティ境界になる。Gemini Secretの直接参照はruntime identityに残す。

TerraformはIAM・CPU/メモリ・scale・Secret version・環境変数を管理する。イメージだけはCIへ所有権を移し、Terraformの `ignore_changes` で、通常のinfra applyが古い `image_ref` へ巻き戻さないようにする。`image_ref` は初回作成用の固定digestとして残す。イメージの変更・復旧はCDか明示したCloud Run revisionへの切替で行う。

## 復旧

候補の作成だけで失敗した場合、既存トラフィックに変更はない。失敗したcandidateの調査後、修正コミットをmainから配置する。

APIが切替済みなら、Actions summaryに記録された直前revisionを確認して指定する。run.appのURLは変更しない。

```sh
gcloud run services update-traffic architecture-sandbox-api \
  --project=SELECTED_PROJECT_ID --region=asia-northeast1 \
  --to-revisions=PREVIOUS_VERIFIED_REVISION=100 --remove-tags=candidate
```

Workersは配信ログのversionを確認し、Wranglerのdeployment履歴から対応する以前のversionへ戻す。APIとUIの互換性を確認し、復旧後にhealth・CORS・画面・保存復元を再確認する。必要なら公開APIをTerraformで非公開へ戻す。予算通知とmax instancesは厳密な月額停止上限ではない。

## 参照

- [GoogleのGitHub認証Action](https://github.com/google-github-actions/auth)
- [Deployment pipelinesのWorkload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [CloudflareとGitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
