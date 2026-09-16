# コンポーネント別ステージと練習問題

後続変更: [React Flowによる体験・練習 #9](https://github.com/Morishita-mm/architecture-sandbox/issues/9)を実装済み。最新仕様・検証は `docs/interactive-course-canvas.md`、画面は `docs/course-canvas-captures.md`。以下はステージ化した時点（固定UI・進捗v3）の記録。現在は学習・練習の両方でReact Flowを使い、v4へ移行する。

進捗: **8 / 8項目をローカル実装・自己検証済み**。初学者の実利用と公開は未実施。

2026-09-15の依頼: 体験だけでなく練習で使い方を確かめ、クリアすると次のコンポーネントへ進む。入門コースは基本8種類を対象とし、全32種類を履修したとは扱わない。

## 今回の順序

Web Browser → App Server → RDBMS (SQL) → Load Balancer → Distributed Cache → Message Queue → Worker (Async) → API Gateway（利用制限）→ 卒業課題。

各ステージは「役割と体験」「別の場面で使う練習」「結果と理由の確認」。負荷分散の前には、既存の見積もりも体験する。クリア済みは復習でき、自由設計へはいつでも進める。

## 完了チェックリスト

- [x] STAGE-01 コンポーネントごとの到達目標と順序、練習問題を定義。
- [x] STAGE-02 一覧でクリア・進行中・未開放と学んだ内容を表示。
- [x] STAGE-03 体験と別の場面の操作問題・確認問題でクリアを判定。
- [x] STAGE-04 前ステージのクリアで次を開放し、復習・再挑戦を用意。
- [x] STAGE-05 旧記録を保持して移行し、保存・再開・異常系を検証。
- [x] STAGE-06 卒業課題と修了一覧、自由設計への引き継ぎを整備。
- [x] STAGE-07 単体・PC／スマホE2E・型検査・lint・buildと既存機能を確認。
- [x] STAGE-08 README・検証台本・親Issueと後続PRの関連を更新。

AIは教材・採点に使用しない。学習記録だけを専用キーで拡張し、設計プロジェクトの保存形式とAPIは変更しない。旧版の観察済み記録は維持し、未実施の新しい練習をクリア済みにはしない。

今回もローカル開発のみ。実際の初学者の理解・応用力は実利用で確認する。既存の[8章拡張 #7](https://github.com/Morishita-mm/architecture-sandbox/issues/7)と[UX改善 #5](https://github.com/Morishita-mm/architecture-sandbox/issues/5)に関連付ける。


## 練習問題とクリア条件

| ステージ | 練習する場面 | 操作で確認する到達 |
| --- | --- | --- |
| Web Browser | 道具の貸出状況を尋ねる | 要求を送り、受け取った返事を画面に表示 |
| App Server | 貸出できる道具を尋ねる | 経路を接続し、要求に対するアプリの返事を受信 |
| RDBMS (SQL) | Aさんのボールの貸出を記録 | DBに保存後、アプリを再起動して読み出す |
| Load Balancer | Aが停止中、6件/秒の要求 | 2台と振り分けを使い、残るBへ6件を送る |
| Distributed Cache | 会場が公園から体育館へ変更 | 古い表示を観察し、コピーを無効化して体育館を表示 |
| Message Queue | 通知担当が停止中 | 通知完了とせず、仕事を受け付けて待機させる |
| Worker (Async) | 同じ仕事 #1 が2件届く | 2件を取り出し、通知の実行は1回に抑える |
| API Gateway | 7件を要求、処理先は3件/秒まで | 制限と再試行で、失わず7件すべてを処理 |

各ステージで、対応する体験の完了・練習の操作結果・理由の正答を必要とする。「練習の結果を確認する」の提出でクリアを記録する。理由だけの正答やチェックボックスの切り替えだけで先に進めない。未達の操作と理由の見直しを区別し、任意のヒントと体験への戻り道を用意する。

見積もりはLoad Balancerの準備課題。キュー段階では受付と完了に操作を絞り、再配信・重複防止はWorker段階で扱う。卒業課題では、複数の構成比較、条件を満たした現在の構成、理由・残る課題の記述、振り返りを要求する。自由記述の意味の自動採点は行わない。修了後は各部品の到達目標を一覧で振り返り、完成した図とメモを自由設計へ渡せる。

## 進捗と保存

- 専用キー `architecture-sandbox:component-stages:v3` に体験・練習・クリア履歴・現在地を保存。クリア履歴と最新の操作状態は別に持ち、復習・リセットで獲得済みの開放は取り消さない。
- 新キーがなければ従来の `learning-course:v2` / `v1` を読み、体験記録を保持して移行。旧キーは削除・上書きしない。未実施の新しい練習は未クリアとして明示する。
- 不正な形式・値を拒否し、開放されていない再開先は有効な画面へ戻す。読み込み失敗・保存失敗は表示し、その画面で継続と保存再試行ができる。壊れた新記録を黙って旧記録へ置き換えない。
- 設計プロジェクトのJSON/API契約は変更しない。学習記録全体は端末間同期・JSON書き出しの対象外。卒業課題から渡した図とメモは従来の設計保存に含まれる。

## 後から調整する場所

- `frontend/src/constants/componentStages.ts`: 部品ごとの役割・到達目標・問題・理由・ヒント。
- `frontend/src/utils/componentStages.ts`: 開放・クリア・進捗移行・練習の初期状態と判定。
- `frontend/src/components/LearningCourse.tsx`: 学習マップ、各ステージへの振り分け、卒業と自由設計への導線。
- `frontend/src/components/StagePractice.tsx`: 練習操作、結果の提出とフィードバック。
- `frontend/src/constants/courseCurriculum.ts` / `frontend/src/utils/courseLabs.ts`: 従来の体験説明と教材の計算。技術資料は[8章拡張の記録](learning-course-expansion.md)を参照。

## 最終自己検証（2026-09-15）

- frontend単体 **85 / 85成功**。追加12件で、操作＋回答＋明示的提出、順次開放、体験と練習の分離、重複配信、再試行時の要求数、卒業条件、保存・移行・不正値を確認。
- `npm run lint` 成功。`npm run build` はTypeScript検査を含め成功。本番用のfixture API originを指定し、実AIへ接続していない。
- 最終buildでPlaywright **56 / 56成功**。PC 1255×963とスマホ390×844で全8ステージの体験と練習、卒業、途中再開、誤答・未達からの修正、図・メモの引き継ぎとJSON復元を完走。教材のAPI要求は **0件**。
- 320pxで旧v1/v2移行・順次開放、クリア済み再挑戦と他記録の保持、破損／保存失敗と再試行を確認。自由設計への直接移動、部品ヘルプ、チャット、保存、編集、Undo、評価対応の既存機能も全件成功。
- 実画面でもPC／スマホの学習マップと練習・クリア表示を確認。横はみ出しなし、教材内React Flowは0個。チェックの達成状態は読み上げ用の文言も用意。
- 対象: `codex/learning-ux-local`、base `e0ac3af`＋未コミット差分。変更されたfrontend/backend/scriptsと評価fixtureのパス＋内容をソート順・NUL区切りで集計したSHA-256: `0f5f843ed784a148e8f7b2b0aeb2b4ffc7fe6e10d3f20fb7e026908a0db2233a`。
- backend・コンテナ・実AI・本番環境は今回再検証していない。初学者の理解・応用力も未検証。[実利用台本](usability-study.md)へステージの確認項目を追加し、参加者0名のまま記録する。

画像は教材の仮の入力による自己検証で、学習効果の証拠ではない。

- [学習マップ（PC）](images/component-stages-desktop.png)
- [練習とクリア表示（PC）](images/component-stage-practice.png)
- [学習マップ（スマホ）](images/component-stages-mobile.png)

## Issueと後続PR

作業は[Issue #8](https://github.com/Morishita-mm/architecture-sandbox/issues/8)、全体は[Issue #5](https://github.com/Morishita-mm/architecture-sandbox/issues/5)で追跡。旧#6・#7にも現在仕様への参照を残す。後続PRには `Closes #8`、`Closes #7`、`Closes #6`、`Refs #5` を記載する。ローカル開発の指示に従い、今回はpush・PR・公開を行わず、IssueはOPENを維持する。
