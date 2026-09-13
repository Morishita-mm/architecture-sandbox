# Infrastructure roots

新しい移植先は [`gcp/`](gcp/)、手順は [`../docs/migration-cloudflare-gcp.md`](../docs/migration-cloudflare-gcp.md)。

このディレクトリ直下の `.tf` は旧AWS運用構成です。移植時に上書きしたり、新しいGCP stateへ取り込んだりしません。既存AWSのstateは元の管理場所で保全してください。新環境の受入と切替後、AWSリソースの停止・削除は別途明示的に承認して実施します。
