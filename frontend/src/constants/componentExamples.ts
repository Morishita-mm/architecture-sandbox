export interface ComponentExample {
  stages: string[][];
  links: string[];
  caption: string;
  scope?: string;
  association?: boolean;
}

const flow = (types: string[], links: string[], caption: string): ComponentExample => ({ stages: types.map(type => [type]), links, caption });

// Illustrative relationships, separate from the user's design and evaluation data.
export const componentExamples: Record<string, ComponentExample> = {
  'VPC (Network)': {
    scope: 'VPC (Network)', stages: [['Subnet', 'Subnet']], links: [],
    caption: 'VPCの中に複数のSubnetを配置する例です。枠はネットワークの範囲を示し、通信の許可は別に設定します。',
  },
  'Availability Zone': {
    ...flow(['App Server', 'RDBMS (SQL)'], ['読み書き'], '同じAZにアプリとDBを配置した例です。このAZが停止すると両方に影響するため、継続が必要なら別のAZへの配置も考えます。'),
    scope: 'Availability Zone',
  },
  'Subnet': {
    ...flow(['App Server', 'RDBMS (SQL)'], ['読み書き'], '同じSubnetにアプリとDBを配置した例です。外部との経路やアクセス元の制限は、別に決めます。'),
    scope: 'Subnet',
  },
  'Security Group': {
    ...flow(['Security Group', 'App Server'], ['適用'], '破線はルールの適用関係です。たとえば、App Serverに関連付けて、Load BalancerからのHTTPS（443番ポート）だけを許可します。通信がこの部品を中継する意味ではありません。'),
    association: true,
  },
  'Client App': flow(['Client App', 'API Gateway', 'App Server'], ['API要求', '転送'], '端末のアプリがAPIの入口へ要求を送り、App Serverが業務処理を行います。'),
  'Mobile App': flow(['Mobile App', 'API Gateway', 'App Server'], ['API要求', '転送'], 'スマートフォンでの操作をAPI経由で送ります。圏外で失敗した場合の保存・再送も考えます。'),
  'Web Browser': flow(['Web Browser', 'Web Server', 'App Server'], ['画面を要求', '処理を依頼'], 'ブラウザからの要求をWeb Serverが受け、業務処理が必要な要求をApp Serverへ渡す例です。'),
  'DNS (Route53)': flow(['Web Browser', 'DNS (Route53)'], ['名前を照会'], '名前解決の関係を省略して示しています。通常はDNSリゾルバー経由で接続先を調べ、その後のWeb通信は接続先へ直接送ります。'),
  'CDN (CloudFront)': flow(['Web Browser', 'CDN (CloudFront)', 'Object Storage'], ['画像を要求', '未保持時に取得'], 'CDNに画像があればそこから返し、なければ保存先から取得します。矢印は要求の向きで、画像は逆向きに返ります。'),
  'Load Balancer': {
    stages: [['Web Browser'], ['Load Balancer'], ['App Server', 'App Server']], links: ['要求', '振り分け'],
    caption: '受けた要求を正常なApp Serverのいずれかへ振り分けます。2台に同じ要求を同時実行させる意味ではありません。',
  },
  'API Gateway': flow(['Mobile App', 'API Gateway', 'App Server'], ['API要求', '転送'], 'アプリからのAPI要求を入口で受け、経路に応じてApp Serverへ転送します。認証や利用制限のルールは別に設定します。'),
  'WAF (Firewall)': {
    ...flow(['WAF (Firewall)', 'Load Balancer'], ['適用'], '破線はWebリクエストの検査ルールを入口へ適用する関係です。対応する入口や配置方法は製品によって異なります。'),
    association: true,
  },
  'Web Server': flow(['Web Browser', 'Web Server', 'App Server'], ['画面を要求', '処理を依頼'], 'Web Serverが画面やファイルを返し、業務処理をApp Serverへ任せる例です。小さな構成では同じ実行環境にまとめられます。'),
  'App Server': flow(['Web Server', 'App Server', 'RDBMS (SQL)'], ['処理を依頼', '読み書き'], 'App Serverが入力と権限を確認して業務処理を行い、必要な記録をDBへ保存します。'),
  'Worker (Async)': flow(['App Server', 'Message Queue', 'Worker (Async)'], ['仕事を登録', '仕事を取得'], '受付側が仕事を登録し、WorkerがQueueから取得して実行します。矢印は仕事の受け渡しを表し、接続の開始方向とは限りません。'),
  'Batch Job': flow(['Batch Job', 'RDBMS (SQL)'], ['集計・更新'], '夜間に起動したBatch Jobが記録をまとめて集計する例です。起動時刻を管理する仕組みは図から省略しています。'),
  'Function (Serverless)': flow(['Object Storage', 'Function (Serverless)', 'Object Storage'], ['保存を通知', '加工結果を保存'], '画像の保存イベントで関数を起動し、加工した画像を別の保存先へ書き出します。出力側の保存で再び起動しないように条件を設定します。'),
  'RDBMS (SQL)': flow(['App Server', 'RDBMS (SQL)'], ['読み書き'], 'アプリが注文や勤怠の記録を読み書きします。ブラウザへDBの接続情報を渡さず、サーバー側でアクセスを管理する例です。'),
  'NoSQL (KV)': flow(['App Server', 'NoSQL (KV)'], ['キーで取得・保存'], 'アプリがIDをキーにして値を取得・保存します。必要な永続性や同時更新の保証を製品・設定で確認します。'),
  'NoSQL (Doc)': flow(['App Server', 'NoSQL (Doc)'], ['文書を取得・保存'], 'アプリが商品の情報などを文書単位で扱います。検索する項目に合わせた索引も用意します。'),
  'NoSQL (Graph)': flow(['App Server', 'NoSQL (Graph)'], ['関係を検索'], 'アプリから人や物のつながりを検索します。線はDBへの検索要求で、DB内部の関係そのものではありません。'),
  'Object Storage': flow(['App Server', 'Object Storage'], ['ファイルを保存'], 'アプリが受け付けたファイルを保存する例です。署名付きURLなどで利用者が直接アップロードする方式もあります。'),
  'Search Engine': flow(['App Server', 'Search Engine'], ['キーワード検索'], 'アプリが検索用の索引へ問い合わせます。元データを索引へ反映する経路は、この図では省略しています。'),
  'Distributed Cache': flow(['App Server', 'Distributed Cache'], ['コピーを照会'], 'まずキャッシュを調べる例です。見つからなければアプリが元のDBから読み、期限を付けてコピーを保存します。DBへの経路は省略しています。'),
  'Message Queue': flow(['App Server', 'Message Queue', 'Worker (Async)'], ['仕事を登録', '仕事を取得'], '受付と実行を分ける例です。矢印は仕事の受け渡しを示します。失敗時の再試行や重複実行への対策も必要です。'),
  'Pub/Sub': {
    stages: [['App Server'], ['Pub/Sub'], ['Worker (Async)', 'Function (Serverless)']], links: ['出来事を発行', '各購読先へ配信'],
    caption: '一つの出来事を購読先それぞれへ届け、通知と集計などを独立して動かす例です。配信の保証や再試行は製品・設定で確認します。',
  },
  'Event Bus': {
    stages: [['App Server'], ['Event Bus'], ['Worker (Async)', 'Function (Serverless)']], links: ['イベントを送信', '条件で振り分け'],
    caption: 'イベントの種類や内容に合う処理先へ渡します。複数のルールに一致すれば、複数の相手へ送る場合もあります。',
  },
  'Log Aggregator': flow(['App Server', 'Log Aggregator'], ['ログを送信'], 'アプリの処理記録を集め、エラーの調査に使います。ログ転送エージェントなどの中継は省略しています。'),
  'Metrics Store': flow(['App Server', 'Metrics Store'], ['指標を収集'], '応答時間やエラー数を継続して記録します。矢印は数値が集まる向きで、取得型・送信型など収集方式は製品によります。'),
  'Dist. Tracer': flow(['App Server', 'Dist. Tracer'], ['追跡情報を送信'], 'アプリが処理の経路と所要時間を送ります。通常の業務要求をこの部品へ転送する意味ではありません。'),
  'Alert Manager': flow(['Metrics Store', 'Alert Manager'], ['異常を通知'], '記録した指標を監視ルールで評価し、異常をAlert Managerへ通知する例です。ルールの評価処理と担当者への通知先は省略しています。'),
  'Health Checker': flow(['Health Checker', 'App Server'], ['応答を確認'], 'ヘルスチェック用の入口へ定期的に要求を送ります。確認結果を振り分けや通知へ反映する経路は省略しています。'),
};
