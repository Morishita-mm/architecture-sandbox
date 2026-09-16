import type { ProjectSaveData, SimpleNodeData, SimpleEdgeData } from '../types.ts';
import { courseNodeData } from './courseEditor.ts';
import type { CourseDiagram } from './courseDiagram.ts';
import type { DesignLab } from './courseLabs.ts';
import { designObjectives, evaluateDesign } from './courseLabs.ts';

/** A fresh editable project; course progress and existing project drafts stay separate. */
export function createCourseProject(state: DesignLab, projectId: string, timestamp: string, diagram?: CourseDiagram): ProjectSaveData {
  const nodes: SimpleNodeData[] = [];
  const edges: SimpleEdgeData[] = [];
  function node(id: string, label: string, originalType: string, x: number, y: number, description: string) {
    nodes.push({ id, type: 'custom', position: { x, y }, data: { label, originalType, description } });
  }
  function edge(source: string, target: string, payload: string, mode: 'sync' | 'async' = 'sync') {
    edges.push({ id: `${source}-${target}`, source, target, data: { payload, mode } });
  }
  node('browser', '利用者の画面', 'Web Browser', 0, 160, 'お知らせを読み、通知を依頼する画面');
  let entrance = 'browser', x = 260;
  if (state.limit) {
    node('gateway', '利用制限の入口', 'API Gateway', x, 160, '教材ではトークン数で受付を制限。実際の上限・利用者ごとの公平性・再試行方法は別に決める');
    edge(entrance, 'gateway', 'お知らせの要求'); entrance = 'gateway'; x += 260;
  }
  if (state.balanced) {
    node('balancer', '要求を振り分ける', 'Load Balancer', x, 160, '稼働中のアプリへ要求を振り分ける。停止検知の方法と時間は要検討');
    edge(entrance, 'balancer', 'お知らせの要求'); entrance = 'balancer'; x += 260;
  }
  node('app-a', 'アプリA', 'App Server', x, 60, 'お知らせの読み出し・通知依頼の処理。教材上の仮の能力は6件/秒');
  edge(entrance, 'app-a', 'お知らせの要求');
  const apps = ['app-a'];
  if (state.servers === 2) {
    node('app-b', 'アプリB', 'App Server', x, 320, state.balanced ? 'Aと並列に要求を処理する' : '台数を増やしただけの状態。入口から届く経路は未設定');
    if (state.balanced) edge(entrance, 'app-b', 'お知らせの要求');
    apps.push('app-b');
  }
  node('database', 'お知らせの元データ', 'RDBMS (SQL)', x + 540, 160, 'お知らせを保存する共通のDB。DB自身の冗長化・バックアップは未設計');
  if (state.cache) node('cache', 'お知らせのコピー', 'Distributed Cache', x + 270, -100, 'よく使う情報のコピー。更新時の無効化と有効期限は要検討');
  if (state.queue) {
    node('queue', '通知待ちの仕事', 'Message Queue', x + 270, 580, '受付と通知の実行を分ける。保存期間・再配信は要検討');
    node('worker', '通知の実行', 'Worker (Async)', x + 540, 580, '通知を実行。処理済みIDによる重複防止と失敗時の復旧は要検討');
    edge('queue', 'worker', '通知する仕事と仕事ID', 'async');
  }
  for (const id of apps) {
    edge(id, 'database', state.cache ? 'キャッシュにないお知らせの読み出し' : 'お知らせの読み出し');
    if (state.cache) edge(id, 'cache', 'コピーの取得・格納・無効化');
    if (state.queue) edge(id, 'queue', '通知する仕事と仕事ID', 'async');
  }
  if (diagram) {
    nodes.length = 0; edges.length = 0;
    for (const n of diagram.nodes) if (n.kind !== 'responder') nodes.push({ id: n.id, type: 'custom', position: { x: n.x, y: n.y }, data: courseNodeData(n) });
    for (const e of diagram.edges) if (nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)) {
      const target = diagram.nodes.find(n => n.id === e.target)!;
      edge(e.source, e.target, target.kind === 'queue' || target.kind === 'worker' ? '通知する仕事と仕事ID' : target.kind === 'cache' ? 'コピーの取得・格納・無効化' : target.kind === 'database' ? 'お知らせの読み出し' : 'お知らせの要求', target.kind === 'queue' || target.kind === 'worker' ? 'async' : 'sync');
    }
  }
  const trial = evaluateDesign(state);
  return {
    schemaVersion: 3, version: '1.0', timestamp, projectId,
    scenario: { id: 'custom', title: '地域イベントのお知らせ', description: '地域イベントのお知らせを読み、参加者への通知を依頼できるサービスを設計する。入門教材で試した仮定を出発点に、利用者・データ・停止時の影響・費用を検討する。', isCustom: true, difficulty: 'small', partnerRole: 'cto' },
    memo: [
      '入門コース 卒業課題から引き継いだ設計',
      `選んだ条件：${designObjectives[state.objective]}`,
      `選んだ理由：${state.reason.trim() || '未記入'}`,
      `引き受ける注意点：${state.tradeoff.trim() || '未記入'}`,
      `教材の試算：${trial.completed}/${trial.requests}件を処理、部品${trial.components}個、DB読み出し${trial.dbReads}回。`,
      'これはブラウザ内の簡略モデルによる試算です。実際の性能・可用性・安全性を保証しません。',
      '仮定：アプリ1台6件/秒、共通DB20件/秒。停止は検知済み。キャッシュは半数ヒット・有効なコピー。利用制限は初期トークン3枚。キューは通知の受付と実行を分離し、この読み出し能力は変えません。',
      '次に確かめること：実測した負荷、データの鮮度、通知失敗と重複、DBや入口の故障、認証・権限、運用と費用。',
    ].join('\n\n'),
    diagram: { nodes, edges }, chatHistory: [], interviewEvidence: [], evaluation: null,
  };
}
