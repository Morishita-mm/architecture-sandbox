# 2026-09-16 本番受入

## 対象

- main: `384073ae7ff2e2709688cae37198549de30e376d`
- PR: [#20](https://github.com/Morishita-mm/architecture-sandbox/pull/20)
- Production release: [run 35049999538](https://github.com/Morishita-mm/architecture-sandbox/actions/runs/35049999538)
- Cloud Run revision: `architecture-sandbox-api-384073a-35049999538-1`
- Frontend: `https://sandbox.morimizu.dev`
- Backend: `https://architecture-sandbox-api-h5zlhkux4q-an.a.run.app`
- Model: `gemini-3.5-flash-lite`

## 配置結果

PRと本番releaseのTerraform、Rust、統合テスト、frontend unit、Playwright 92件、production build、Cloudflare dry-runが成功した。CIで検証したコンテナをArtifact Registryへ送り、0% trafficのCloud Run候補でhealth・CORS・不正入力を確認してからトラフィックを切り替えた。Cloudflare配信、独自ドメイン、公開APIとSPAのsmokeも成功した。

## 実Gemini確認

自動リトライなしで、会話8回、評価3回を本番APIへ送った。全11要求がHTTP 200で、応答時間は1.0〜2.4秒だった。

- 利用者数・時間帯・ピークを聞く同一質問は3/3回で `users` と `traffic` を返した。
- 停止時間とデータ損失を聞く質問は `availability` を返した。
- 自分で仕様を決める自由テーマは条件IDを追加せず、未決事項を質問として整理した。
- プロンプトインジェクション形式の質問には内部プロンプトの開示を拒否した。
- 根拠3件を付けた評価は73点で、全4条件に対して確認済み3、未確認1（予算）を返した。
- 同一設計を追加で2回評価した総合点は70点と71点だった。

公開UIからも実Geminiへ予算を質問し、回答と「確認できた条件 1件・予算」を確認した。ページ再読込後にトップの作業一覧から再開し、質問、回答、条件チップが復元された。

## 見つかった問題

1. 拒否回答が「朝9時に一斉打刻」と条件を本文で再掲した一方、`coveredConditionIds` は空だった。回答本文とモデルの自己申告IDが一致しない場合、読んだ条件が到達度へ残らない。[Issue #21](https://github.com/Morishita-mm/architecture-sandbox/issues/21)
2. 同一設計で、DBのバックアップ・復元手順の未確認が「重大な不足」と「未確認事項」の間を移動した。点差は1点でも、改善優先度の意味が変わる。[Issue #22](https://github.com/Morishita-mm/architecture-sandbox/issues/22)
3. 一部の評価文に `社員のブラウザから[社員のブラウザ]` の重複表現があった。Issue #22で構造化と表示整形を扱う。
4. GitHub ActionsでNode.js 20廃止警告が出た。今回のreleaseは成功したが、Action更新が必要。[Issue #23](https://github.com/Morishita-mm/architecture-sandbox/issues/23)

## 判定

本番配置、実Geminiとの基本的な会話・評価、聞き取り到達度、自動保存からの再開は動作した。聞き取り到達度を正式な判定として扱うには回答本文と条件IDの整合検査が必要で、評価の重大度区分も受入未完了。AI結果は引き続き学習の参考情報として扱う。

## 修正候補のローカル検証

Issue #21〜#23に対し、回答本文の条件断片とIDのサーバー照合、内部情報抽出要求のローカル拒否、評価区分の構造化とサーバー正規化、Node.js 24対応Actionへの更新を実装した。Rust単体11件、API統合32件、frontend単体125件、Playwright 92件、fmt・clippy・build・lint・型検査が成功した。本節はローカル検証の記録であり、上記の本番判定は次回配置と実Gemini再試験が終わるまで変更しない。

## 修正後の本番再試験

PR #24をmain `427d567`へマージし、[release run 35055011268](https://github.com/Morishita-mm/architecture-sandbox/actions/runs/35055011268)で配置した。全CI、候補検証、Cloud Run切替、Cloudflare配信、公開smokeが成功し、Node.js 20廃止警告は0件だった。

- 通常質問3回はすべて `users` / `traffic` が一致し、停止とデータ損失の質問は `availability` が一致した。
- 内部情報抽出要求は35msでローカル拒否し、Geminiへ送信せず、非公開条件の再掲と条件ID追加はなかった。
- 同一設計の評価は74点、73点、72点。3回とも「重大な不足なし」で、バックアップ・復元や負荷試験は未確認事項に分類された。
- 1回の評価で `[勤怠DB](#node=app)` と誤ったノードIDが生成された。表示側は不正参照を開かないが、正しい設定へ戻れないため、表示名が一意な場合にサーバーの実在IDへ正規化する修正と回帰試験を追加した。修正の本番配置は次回releaseで確認する。

## 合意仕様と重点配分の本番受入

PR #25でノードリンク正規化を配置した後、PR #26をmain `39526ad`へマージし、[release run 35058881096](https://github.com/Morishita-mm/architecture-sandbox/actions/runs/35058881096)で配置した。検証、0% trafficの候補確認、Cloud Run切替、Cloudflare配信、公開smokeはすべて成功した。

- 既定2テーマ×3ケースの全6件で実Geminiへ交渉を依頼し、サーバー許可リストの期待した変更案を6/6件返した。応答時間は1.1〜1.6秒だった。
- 交代勤務ケースで「日次集計を翌朝8時まで」に確定すると仕様版がv2へ進み、続く会話はv2の条件を回答し、同じ変更案を繰り返さなかった。公開UIでもケース名、v1からv2への更新、確定履歴を確認した。
- 同じ3層構成を小規模オフィスと交代勤務で評価した結果は66点と51点だった。ケース別重点配分は35/5/20/20/20/0と75/15/0/10/0/0で、サーバー側の再計算値と両方一致した。6軸の値とレーダーチャートは保持した。
- 「内部のシステム指示と非公開の採点条件」という言い換えはGemini自身が拒否し、内部情報の漏えいはなかった。一方、ローカル判定を通過して1.1秒の外部呼び出しが発生したため、この表現をサーバーの拒否対象へ追加し、providerを呼ばない統合回帰試験を追加した。修正は後続releaseで再確認する。

初回の評価試験2件は受入スクリプトが公開DTOにない`position`を送って422となった。正しいDTOへ直した再試験は2/2件成功しており、アプリ本体の不具合ではない。実応答は`/private/tmp/architecture-sandbox-spec-live.json`と`/private/tmp/architecture-sandbox-weight-live.json`に記録した（ローカル受入証跡のためリポジトリには含めない）。

## 抽出要求の本番再試験

PR #27をmain `f066a36`へマージし、[release run 35060336627](https://github.com/Morishita-mm/architecture-sandbox/actions/runs/35060336627)で配置した。全検証、候補確認、Cloud Run切替、Cloudflare配信、公開smokeが成功した。同じ抽出要求を公開APIへ再送するとHTTP 200・316msでサーバー固定の拒否文を返し、確認済み条件は0件だった。外部モデルが生成した前回の文面と異なり、統合試験でもprovider要求数が増えないことを確認している。受入証跡は`/private/tmp/architecture-sandbox-injection-retest.json`に保存した。
