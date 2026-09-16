# 学習の達成条件と、基本操作を優先した画面

2026-09-15。[Issue #14](https://github.com/Morishita-mm/architecture-sandbox/issues/14)。ローカル実装を対象にする。既存の学習履歴・プロジェクト・詳細設定を保持する。

## チェックリスト

- [x] ホームから「設計課題に取り組む」を選んだ後、別画面でテーマを選ぶ。学習画面からも直接進める。
- [x] 接続先と追加ボタンの間隔、評価開始ボタンのサイズ・間隔をそろえる。
- [x] 学習マップのボタン位置をそろえ、開放条件をボタンより前に置く。
- [x] 卒業課題をカード全体のボタンにし、未開放・修了を区別する。「卒業 🎉」を到達地点として表示する。
- [x] 不要なAI通信のフッター文言を除く。
- [x] プロパティは表示名・短い任意メモ・接続を基本にし、詳細設定は任意として折りたたむ。
- [x] 各体験・練習の達成条件を操作前に表示する。確認問題も必須条件に含め、実験結果の後に配置する。
- [x] 卒業課題の比較・メモ・確認問題を含め、表示した条件と実際のクリア判定をそろえる。
- [x] 練習向けの採点方針をプロンプトに反映し、12要求を予備測定する。構成と短い説明を根拠として扱う。返答品質の未解決事項は下記に記録する。
- [x] 型検査・ビルド・lint・単体テスト・E2EとPC/モバイル表示を確認する。

テーマごとの重み付けは `evaluation-design-proposal.md` の検討事項として残す。今回、採点項目やAPI契約は変更しない。

## 評価の確認範囲

練習向けの説明を明確化したv4で12要求を取得。名前と接続だけの構成は67–69点、方針を文章で説明した構成は79点だった。これは固定ケース2反復の結果であり、得点保証ではない。未入力の重大不足への誤分類、意味上の誤参照、バックアップ提案の不足などが残るため、実AI品質の受入は未完了。[測定記録](evaluation-runs/2026-09-15/rubric4-review.md)とIssue #13で継続する。

## ローカルでの確認先

- 画面: http://127.0.0.1:5175/
- バックエンド: http://127.0.0.1:8086/（8080は別アプリが使用しているため分離）
- コンテナ: `architecture-sandbox-learning-clarity`、イメージ: `architecture-sandbox:learning-clarity`。公開ポートはloopback限定、CORSは上の画面のOriginだけを許可。
- 必要なときは `docker start architecture-sandbox-learning-clarity` / `docker stop architecture-sandbox-learning-clarity` で起動・停止できる。キーは記録文書や画面へ出力していない。
- フロントエンドを再開する場合: `VITE_API_BASE_URL=http://127.0.0.1:8086 VITE_APP_SHARE_URL=http://127.0.0.1:5175 npm --prefix frontend run dev -- --host 127.0.0.1 --port 5175 --strictPort`

バックエンドは今回のビルドを固定したコンテナ。以後プロンプトやRustを変更するときは再ビルドが必要。既存の学習履歴や設計は消去していない。

## 画面の記録

PC 1255px／スマートフォン390pxで、隔離されたテスト用ブラウザの架空の作業を撮影。ユーザーの作業データは撮影・変更していない。

| 流れ | PC | スマートフォン |
| --- | --- | --- |
| ホーム | [画面](images/learning-clarity/1255-home.png) | [画面](images/learning-clarity/390-home.png) |
| 設計のテーマ選択 | [画面](images/learning-clarity/1255-themes.png) | [画面](images/learning-clarity/390-themes.png) |
| 部品の編集 | [画面](images/learning-clarity/1255-properties.png) | [画面](images/learning-clarity/390-properties.png) |
| 評価の入口 | [画面](images/learning-clarity/1255-evaluate.png) | [画面](images/learning-clarity/390-evaluate.png) |
| 学習マップ | [画面](images/learning-clarity/1255-map.png) | [画面](images/learning-clarity/390-map.png) |
| 体験 | [画面](images/learning-clarity/1255-learn.png) | [画面](images/learning-clarity/390-learn.png) |
| 確認問題 | [画面](images/learning-clarity/1255-answer.png) | [画面](images/learning-clarity/390-answer.png) |
| 練習クリア | [画面](images/learning-clarity/1255-practice.png) | [画面](images/learning-clarity/390-practice.png) |

## 動作確認

- frontend: TypeScript込みのproduction build、ESLint、単体テスト104件成功。ビルドはCIと同じHTTPSのfixture URLを指定。
- E2E: 全体実行73件成功。残る1件はスマホの「追加した部品をタップして編集する」という既存操作にテストを合わせ、最終ビルドで関連18件（追加6件・任意設定5件・削除7件）を再実行して全件成功。全74件の対象を確認した。自動再試行なし。
- 8ステージ＋卒業課題の完走、保存・復元・JSON出力、学習で外部APIを呼ばないことをPC/タッチ双方で確認。
- 全7注釈、見出しフォーカス、カードの開放前後、ボタン寸法・間隔、チェックの更新、図の変更による達成状態の解除を確認。
- backend: Rustテスト4件、fmt、clippy、build成功。疑似API・計測器の統合テスト28件成功。
- linux/amd64コンテナbuild、非root実行・health・SIGTERMのスモーク成功。Cloudflare dry-run成功（公開なし）。
- ローカル5175のAPI設定、8086のhealthとCORSを確認。統合画面からの追加の実AI要求は実行していない（今回の実測上限12要求を維持）。

Issueは将来のPRと関連付けられるようOPENのまま保持。ユーザーによる操作確認・実AI品質受入・重み付けの決定は未完了。

GitHub記録: Issue #14のチェックリスト更新は完了。Issue #13には関連作業とローカル資料の所在を追記。実測詳細・費用を含むIssue #13への追記は自動承認で拒否されたため、詳細はローカル資料に保持した。
