# アプリアイコン

所有者提供の「OPEN A」SVGを使用する。`frontend/public/icons/01-open-a*.svg` の5点は提供ファイルのまま保持している。

| 素材 | 用途 |
| --- | --- |
| `01-open-a.svg` | シナリオ選択画面のロゴ |
| `01-open-a-small.svg` | 設計画面ヘッダーとファビコンの形状 |
| `01-open-a-dark.svg` | ダーク表示時のファビコンの配色 |
| `01-open-a-mono.svg` | Safariのmask icon |
| `01-open-a-tile.svg` | Web manifestとホーム画面用アイコン |

`favicon.svg` は小サイズ版に暗色テーマ用のCSSを追加した派生物で、外部素材を参照しない。`favicon.ico` は小サイズ版から16/32/48pxで書き出した互換用ファイル。タイル版からPNGの180px（apple-touch-icon）、192px、512pxを書き出している。元SVGを変更した場合は派生ファイルも同じ形状・色で再生成する。

全ファイルを同一オリジンで配信する。PNG/ICOは事前にSVGからレンダリングした静的ファイルなので、アプリのビルド時・実行時に画像変換依存は不要。Web manifestはアイコン情報を提供し、表示モードは従来どおりブラウザーとする。オフライン動作やservice workerは追加しない。
