import type { PracticeModel } from './componentStages.ts';
import type { CourseDiagram, DiagramStage } from './courseDiagram.ts';
import { diagramProblem, inspectDiagram, partName } from './courseDiagram.ts';

export interface PlaybackStep {
  node: string;
  title: string;
  detail: string;
  kind: 'request' | 'response' | 'process' | 'notice';
  wire?: { id: string; reverse: boolean };
}

/** A view of one completed experiment, never another execution or a saved graph edit. */
export function coursePlayback(g: CourseDiagram, stage: DiagramStage, action: string, before: PracticeModel, after: PracticeModel, trace: string[], summary: string): PlaybackStep[] {
  const steps: PlaybackStep[] = [];
  const topology = inspectDiagram(g);
  const local = (node: string, title: string, detail = summary, kind: PlaybackStep['kind'] = 'notice') => {
    steps.push({ node, title, detail, kind }); return steps;
  };
  const move = (from: string, to: string, detail: string, returning = false) => {
    const wire = g.edges.find(e => e.source === from && e.target === to) ?? g.edges.find(e => e.target === from && e.source === to);
    if (!wire) return false;
    const reverse = wire.target === from, kind = reverse || returning ? 'response' : 'request';
    steps.push({ node: to, title: `${partName(g.nodes.find(n => n.id === from)!)} → ${partName(g.nodes.find(n => n.id === to)!)}`, detail, kind, wire: { id: wire.id, reverse } });
    return true;
  };
  const issue = diagramProblem(stage, g, action);
  if (stage === 'estimate') return local('browser-1', '必要な量を見積もる');
  if (action === 'restart') return local('app-1', 'アプリを再起動。一時記憶が空になる');
  if (action === 'advance') return local('gateway-1', '時間を進め、入口の受付枠を補充する');
  if (action === 'replay') return local('queue-1', '同じ仕事を再びキューへ入れる');
  if (action === 'invalidate') return local('cache-1', issue ? 'キャッシュへの接続を確かめる' : '保存したコピーを無効にする');
  if (before.kind === 'browser' && !before.draft.trim() || (before.kind === 'request' || before.kind === 'storage') && ['send', 'save'].includes(action) && !before.value.draft.trim()) return local('browser-1', '送る内容を入力しよう');
  if (action === 'work' && before.kind === 'queue') {
    if (issue) return local('queue-1', '仕事を届ける経路を確かめる');
    if (!before.pending.length) return local('queue-1', '待機中の仕事はありません');
    const running = topology.worker ? topology.hasWorker && !topology.worker.stopped : before.workerRunning;
    if (!running) return local(topology.worker?.id ?? 'queue-1', '停止中。仕事はキューで待つ');
    local('queue-1', '待機中の仕事を取り出す', `仕事 #${before.pending[0]}`, 'process');
    if (topology.hasWorker) move('queue-1', topology.worker!.id, `仕事 #${before.pending[0]} をWorkerへ届ける`);
    return local(topology.worker?.id ?? 'queue-1', '取り出した仕事を確かめる', summary, 'process');
  }
  if (before.kind === 'rate' && action === 'retry' && !before.retryWaiting) return local('browser-1', '再試行を待つ要求はありません');
  if (issue && before.kind !== 'request' && before.kind !== 'storage') return local(trace[0] ?? '', 'ここで止まりました', issue);
  if (before.kind === 'cache' && after.kind === 'cache' && action === 'write') {
    if (!before.draft.trim()) return local('database-1', '更新する内容を入力しよう');
    const app = topology.apps[0].id;
    local(app, 'アプリからDBに更新を頼む', before.draft.trim(), 'request');
    move(app, 'database-1', before.draft.trim());
    local('database-1', 'DBのお知らせを更新する', after.origin, 'process');
    move('database-1', app, '保存しました', true);
    return local(app, '更新を確認。キャッシュのコピーはそのまま', '画面の表示もまだ変わりません。もう一度読んで、コピーとの違いを確かめましょう。', 'response');
  }

  // Browser traces already include the reply; other traces describe the outward route.
  let route = stage === 'browser' ? trace.slice(0, -1) : [...trace];
  if (!route.length) return local('', '送り先をつなごう');
  const stopped = route.findIndex(id => g.nodes.find(n => n.id === id)?.stopped || before.kind === 'design' && before.objective === 'continuity' && id === 'app-1');
  if (stopped >= 0) route = route.slice(0, stopped + 1);
  const input = before.kind === 'browser' ? before.draft.trim() : before.kind === 'request' || before.kind === 'storage' ? action === 'read' ? '保存した記録を見せてください' : before.value.draft.trim() : action === 'submit' ? '通知をお願いします' : '要求を1件送ります';
  local(route[0], 'ブラウザから要求を送る', input, 'request');
  for (let i = 1; i < route.length; i++) if (!move(route[i - 1], route[i], i > 1 && route[i - 1].startsWith('cache') ? 'コピーがないため、アプリがDBに問い合わせる' : input)) break;
  if (stopped >= 0) return local(route.at(-1)!, '停止中のアプリからは返事が戻りません');
  if (route.length < 2) return local(route[0], '送り先への経路がありません', issue || summary);
  const last = route.at(-1)!;
  const reply = after.kind === 'browser' ? after.reply ?? summary : after.kind === 'request' || after.kind === 'storage' ? after.value.screen ?? summary : after.kind === 'cache' ? after.displayed ?? summary : after.kind === 'queue' && action === 'submit' && topology.hasQueue ? '受付済み。通知の完了はまだです' : summary;
  local(last, stage === 'browser' ? '応答先が返事を用意する' : last.startsWith('queue') ? 'キューが仕事を預かる' : last.startsWith('gateway') ? '入口で要求を見送る' : last.startsWith('database') ? 'DBで記録を保存・読み出しする' : last.startsWith('cache') ? 'キャッシュのコピーを返す' : 'アプリが要求を処理して返事を作る', reply, 'process');
  // Return along the current call stack. A cache miss already returned to the app;
  // do not send the final DB reply through the cache a second time.
  const stack: string[] = [];
  for (const node of route) { const index = stack.indexOf(node); if (index >= 0) stack.splice(index + 1); else stack.push(node); }
  for (let i = stack.length - 1; i > 0; i--) move(stack[i], stack[i - 1], reply, true);
  return local(route[0], stage === 'browser' || stage === 'app' ? 'ブラウザに返事が表示される' : 'ブラウザが処理の結果を受け取る', reply, 'response');
}
