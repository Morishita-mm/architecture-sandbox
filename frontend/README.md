# Frontend

React + TypeScript / Vite。Cloudflare Workersの静的アセットとして配信します。
開発と公開手順は[ルートREADME](../README.md)、[移植手順](../docs/migration-cloudflare-gcp.md)を参照してください。

- `npm ci`、`npm run lint`、`npm test`
- `VITE_API_BASE_URL=https://your-api.example.com npm run build`
- ローカル検証: `VITE_API_BASE_URL=http://localhost:8080 npm run build:local`
- `npm run deploy:check` は公開せずWorkers設定を検証します。

Node.js 22.18以降を使用してください。テストはNodeのTypeScript型消去を使用します。
`securityHeaders.ts`から、ビルド時のAPI originに限定したCSPを含む`dist/_headers`を生成します。
隠し要件・システム指示・APIキーを`VITE_*`やフロントエンドへ追加しないでください。
保存形式とAPI境界は[セキュリティレビュー](../docs/security-review.md)を参照してください。
