# セキュリティ・不要コード・性能レビュー

対象: AWSからCloudflare Workers / GCP Cloud Runへ移すArchitecture Sandbox。
依頼範囲はコードのレビュー、修正、互換性と動作の検証、ChatGPTによる独立した受入レビュー。本番配置、課金設定、認証方式の新設、AWS停止は別の作業です。

## 修正した問題

| 問題 | 修正と受入条件 |
| --- | --- |
| ブラウザのシナリオ定義・チャット・保存に内部要件とsystemメッセージを含む | 公開Scenarioは識別子、タイトル、概要、難易度、相手役だけ。要件はRustのscenarioモジュールで一元管理し、チャットと採点が同じ値を参照。ブラウザ通信・ビルド成果物・新規保存に内部定義が含まれないことを確認 |
| 任意のクライアントsystem指示、偽装した採点要件を採用 | APIは型付き入力と許可したフィールド・roleだけを受け付ける。既定シナリオはIDから正規のテーマと要件を決定。GeminiのsystemInstructionとユーザーコンテンツを分離 |
| Base64をJSON拡張子で保存、読み込みを型キャストで信用 | schemaVersion=2のUTF-8 JSONを保存。旧Base64を読み込んで公開データへ変換。systemとrequirementsは破棄。サイズ・型・ノード参照・親子の循環を検証し、CSSなどは許可した項目だけ再構築 |
| 共有した既定シナリオがカスタム化され採点条件が変わる | 新規リンクは既定IDを維持。公開ScenarioのJSONをURLエンコード。旧Base64リンクも読み込み、既定タイトルと一致する旧challenge_*は元の既定シナリオに変換 |
| 不正なAI JSONや上流エラーをHTTP 200で返す | 採点結果の全6軸・0〜100の整数・説明を検証。不正・空・途中終了・安全性ブロックは502。上流の本文・URL・認証キーを利用者やログへ返さない |
| 入出力量・同時実行・外部呼び出し回数が無制限 | 本文128KiB、入力と出力の上限、1プロセスあたり同時2件・30件/分・300件/時、超過は429。外部応答45秒、短縮15秒、応答本文上限。自動リトライによる重複課金を除去 |
| 任意のURLを短縮できる公開プロキシ | 設定済みfrontend originのルートとchallengeパラメータだけを許可。第三者・userinfo・異なるscheme・追加パラメータ・fragmentを拒否。リダイレクトを追わず、返却URLもhttps://tinyurl.comに限定 |
| AI Markdownの外部画像・リンクによる外部通信誘導 | 画像を出力せずリンクを通常文字として表示。CSPの接続先をAPI originに限定。no-referrer、frame-ancestors、nosniffを設定 |
| 各要求でHTTPクライアント作成と定義ファイル読み込み | 起動時に検証・ロードし、接続プールと評価プロンプトを再利用 |
| 初回に設計・評価ライブラリ全体を読む | 設計画面と評価画面を遅延ロード。ローカルbuildのJSは単一約830kB/gzip256kBから初期約245kB/gzip79kB（共有モジュールは別）へ分割 |
| 読み込み後のノードID重複、projectId変更、古い選択状態 | ノードはUUID、読込projectIdを維持、選択はIDで現行ノードから取得。state更新中の別state変更と再初期化effectを除去。既存ノードをグループへ移す際も親を子より前に並べ、React Flowの削除処理で子を取り残さない |
| 未使用実装・依存 | ScenarioSettings、EvaluationModal、react/viteテンプレート画像、SQLxキャッシュ、async-trait、@types/uuid、成功を装う/api/projectsを削除 |
| 依存関係の既知脆弱性 | bytes / quinn-proto / rustls-webpkiを修正版へ更新。randの健全性警告も解消。RustSecで7件の脆弱性と1件の警告から0件へ。HTTP/3など未使用機能のlockfile依存も監査対象 |
| 開発コンテナの不要な公開と秘密ファイル混入 | Composeのホストポートを127.0.0.1へ限定。開発用build contextにも.envと生成物の除外を追加 |

## 保存・共有と機密性

新規保存は暗号化しません。自分で編集した設計・メモ・会話・評価を自分の端末へ保存する用途で、サーバーの秘密を含める必要がないためです。Base64は表現形式であり暗号化ではありません。bcryptはパスワード照合用の一方向ハッシュで、復元する保存データには使えません。将来、端末紛失などに備えた暗号化が必要になれば、鍵・パスフレーズ・復旧方法を含む別の設計が必要です。

ブラウザへ届いたデータは開発者ツールから見えます。HTTPSは通信経路を保護しますが、ブラウザの所有者から内容を隠す機能ではありません。今回防ぐのは内部定義の一括配布です。ヒアリングで得た要件や評価文に出た情報は、当然会話・保存に残ります。

この公開リポジトリを読める人は、Rust側の静的要件も読めます。またLLMへの指示は機密保護の完全な境界にはなりません。プロンプト抽出・採点誘導を完全には防げず、採点は学習用の参考です。秘密鍵や認証情報をプロンプトへ埋め込んではいけません。

保存上限は2MiB、ノード200個、辺400本、履歴1000件。タイトル120文字、概要・ノード説明2000文字、メモ10万文字。各チャット入力は4000文字まで。AIへは直近100件・合計24000文字以内の文脈だけを送り、全履歴はローカル保存に残します。長い会話ではAIが古い質問を参照できなくなります。グラフの説明も合計24000文字以内です。

古い保存ファイル内の壊れた部分的評価は破棄して設計を復元します。未知のコンポーネント、壊れた参照、将来のschemaVersionや上限超過は拒否します。旧challenge_*リンクは元の識別子を失っているため、既定タイトルと同名のカスタムが既定扱いになる互換上の曖昧さがあります。新規リンクでは生じません。

共有URLには公開シナリオのテーマを含みます。共有対象へ秘密情報を入れないでください。「結果をシェア」操作時だけTinyURLへそのURLを送ります。リンクコピーではTinyURLを呼びません。設計・会話をTinyURLへ送ることはありません。従来のBase64 URLを新ドメインへ持ち込めますが、AWSの旧URLそのものを維持するには別の転送設定が必要です。

## API契約の変更

フロントエンドとバックエンドはこの版を同時に配置してください。旧クライアントのsystem付き要求を許容する互換ルートは用意しません。

- `POST /api/chat`: `{scenario: PublicScenario, messages: [{role: "user" | "model", content}]}` → `{reply}`。最後はuser。旧scenario_id / partner_role / systemは受け付けません。
- `POST /api/evaluate`: `{scenario: PublicScenario, nodes: [{id,type,label,description,parentNode?}], edges: [{source,target}]}` → `{totalScore, details, feedback, improvement}`。scoreフォールバックやpartial_successは廃止。
- `POST /api/shorten`: `{target_url}` → `{short_url}`。自サイトのchallenge URLだけ。
- `/api/projects`: 削除（404）。保存は従来からローカルファイルのみで、サーバー側保存はありませんでした。
- 400=検証不合格、413=本文上限、422=JSON型不一致、429=利用制限、502=上流応答不正、503=サービス利用不可。アプリ側エラーは`{error}`。JSON抽出段階のエラーはAxumの標準応答です。

## 公開前に残る条件

APIは利用者認証を持ちません。CORSはブラウザの読み取り制御で、curlやbotのアクセス制御ではありません。現在の回数制限はインスタンスごとに共有されるため、他人が枠を使い切ると利用できなくなります。再起動やスケールアウトで枠は増えます。max_instancesも厳密な支出上限ではありません。

公開前に、Gemini側の利用枠と請求設定・監視を確認し、匿名公開での悪用と費用を許容するか判断する必要があります。保証された利用者別枠が必要なら認証と共有ストアなどを選定します。今回はそれらのサービス・費用を追加していません。Terraformの公開invokerは初期値falseを維持しています。

実Geminiの応答品質、実TinyURLの成功経路、ドメイン・TLS、実クラウドの受入は未実施です。ローカルfixtureで実APIを代替しても、本番受入の証明にはなりません。

## 検証・独立レビュー

- 自動検証: フロントエンド32件、Rust単体2件、API統合21件が成功。lint / 型検査 / build / clippy成功。production build / Wrangler dry-run / linux/amd64 Docker buildが成功。非root UID 10001、PORT変更、health、SIGTERM終了を確認。Composeの構文確認も成功。
- 依存監査: npm audit、cargo auditとも既知脆弱性0件（2026-09-13）。
- ブラウザ: 偽Geminiを使ったカスタムチャット・ノード配置・編集・82点の評価表示・外部画像/リンク抑止・実JSONファイル保存を確認。ブラウザの送信JSONと保存ファイルに内部定義がないことを確認。
- 最終ローカル画面確認（2026-09-13）: 新JSONと旧Base64の実保存ファイルを画面から読み込み、タイトル・会話・ノード・評価結果を復元できた。旧ファイルの再保存はschemaVersion 2の通常JSONとなり、projectIdを維持し、隠し要件・systemメッセージを含めない。保存完了は画面内通知で表示され、操作を継続できた。
- グループ操作: 既存ノードの後にグループを追加し、所属・切り離し・再所属を確認。保存時に親が子より前に並び、画面から親を削除すると子も削除されることを確認。
- 評価グラフ: 初回表示でサイズ未確定の警告が出る問題を修正。既存レイアウトの高さをグラフにも明示し、修正後の評価表示でconsole warning/errorが0件。frontendの32テスト・lint・型検査を含むlocal/production build・Wrangler dry-runも成功。
- ChatGPT: 専用チャットと読み取り専用連携の新設は許可済み。固定アドレスの接続を作成し、診断成功・認証なしの外部アクセスが401で拒否されることを確認。`.c2cignore`でTerraform状態・実設定・実行時生成物・Git内部ファイルを追加除外し、既定の認証情報除外と他workspaceへのアクセス拒否も確認した。ChatGPT側の手動登録と専用チャットの用意、独立レビューは未実施。

参照: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)、[Gemini generateContent](https://ai.google.dev/api/generate-content)。
