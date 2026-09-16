import type { AppNodeData, SimpleEdgeData } from '../types';
import { placementTypes } from './designModel.ts';

export interface ReviewNode { id: string; type?: string; data: AppNodeData; parentNode?: string }
export interface ReviewGraph { nodes: ReviewNode[]; edges: SimpleEdgeData[] }
export interface Finding { id: string; kind: 'fact' | 'unknown' | 'question'; title: string; detail: string; nodeId?: string; edgeId?: string }
const stores = new Set(['RDBMS (SQL)', 'NoSQL (KV)', 'NoSQL (Doc)', 'NoSQL (Graph)', 'Object Storage']);

/** Checks recorded fields, not the truth of free text or real cloud configuration. */
export function reviewDesign({ nodes, edges }: ReviewGraph): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const add = (node: ReviewNode, code: string, kind: Finding['kind'], title: string, detail: string) => findings.push({ id: `${node.id}:${code}`, nodeId: node.id, kind, title, detail });
  if (!nodes.length) return [{ id: 'empty', kind: 'unknown', title: '確認する部品がありません', detail: '自由に部品を置いてから、接続や役割を考えてみましょう。' }];
  for (const n of nodes) {
    const d = n.data.design ?? {};
    for (const key of Object.keys(placementTypes) as (keyof typeof placementTypes)[]) {
      if (d[key] && (byId.get(d[key])?.data.originalType !== placementTypes[key] || d[key] === n.id)) add(n, key, 'fact', `${n.data.label}: 配置先を選び直す`, `${placementTypes[key]}の参照先がないか、種類が一致していません。`);
    }
    if (n.data.originalType === 'Subnet' && (!d.vpcId || !d.zoneId)) add(n, 'subnet-scope', 'unknown', `${n.data.label}: 所属先が未確認`, 'AWSのSubnetは1つのVPCと1つのAZに属します。専用欄で指定してください。図の囲みからは推測しません。');
    if (d.subnetId && d.zoneId) {
      const subnetZone = byId.get(d.subnetId)?.data.design?.zoneId;
      if (subnetZone && subnetZone !== d.zoneId) add(n, 'zone-mismatch', 'fact', `${n.data.label}: AZの指定が食い違っています`, '部品に指定したAZと、配置先SubnetのAZを一致させてください。');
    }
    if (n.parentNode && byId.get(n.parentNode)?.data.originalType === 'Security Group') add(n, 'legacy-sg', 'fact', `${n.data.label}: 囲みと通信ルールを区別する`, '旧形式のSecurity Groupの囲みに配置されています。囲みだけでは適用済みと扱いません。部品の設定から明示的に関連付けてください。');
    if (d.securityGroupIds?.some(id => byId.get(id)?.data.originalType !== 'Security Group')) add(n, 'missing-sg', 'fact', `${n.data.label}: 通信ルールの参照先がありません`, '部品を削除しても設計意図は自動で消しません。設定から関連付けを解除するか、Undoで戻してください。');
    if (n.data.originalType === 'Security Group') {
      if (!nodes.some(other => other.data.design?.securityGroupIds?.includes(n.id))) add(n, 'sg-target', 'unknown', `${n.data.label}: 関連付け先が未確認`, '適用したい部品の設定で、このSecurity Groupを選択します。');
      if (!d.rules?.trim()) add(n, 'sg-rules', 'unknown', `${n.data.label}: 許可する通信が未記録`, '相手・受信か送信か・プロトコル・ポートを記録しましょう。実際の許可判定は行いません。');
    }
    if (n.type !== 'group' && !edges.some(e => e.source === n.id || e.target === n.id)) add(n, 'isolated', 'fact', `${n.data.label}: 接続線がありません`, '単独で使う意図があるか、つなぎ忘れかを確認しましょう。未接続だけでは不正解としません。');
    if ((d.replicas ?? 0) > 1 && !d.redundancy?.trim()) add(n, 'replicas', 'unknown', `${n.data.label}: 台数以外の備えも確認`, '切り替え方と配置先は未記録です。複数台であることだけでは停止を防げると判断できません。');
    if (stores.has(n.data.originalType) && !d.backup?.trim()) add(n, 'backup', 'unknown', `${n.data.label}: 復元の方法を確認`, 'バックアップ欄は未記録です。設計理由に書いてある場合も、どう戻せることを確認するかを振り返りましょう。');
    if (d.requirement?.trim() && !d.evidence?.trim()) add(n, 'evidence', 'unknown', `${n.data.label}: 条件の根拠が未記録`, '誰に何を確認したかを記録します。ここでは条件の正しさを自動認定しません。');
    if (d.scope === 'external') add(n, 'external', 'question', `${n.data.label}: 外部が応答しなければ？`, '認証・通知・決済などを任せる場合、待ち時間、失敗の伝え方、重複実行への備えを接続に記録しましょう。');
  }
  edges.forEach((e, i) => {
    const d = e.data ?? {};
    const label = `${byId.get(e.source)?.data.label ?? e.source} → ${byId.get(e.target)?.data.label ?? e.target}`;
    const missing = [!d.payload?.trim() && '渡すもの', !d.protocol?.trim() && '通信方式', !d.mode && '結果を待つか'].filter(Boolean);
    if (missing.length) findings.push({ id: `edge:${e.id ?? i}`, edgeId: e.id, kind: 'unknown', title: `${label}: 接続の意味を確認`, detail: `${missing.join('・')}が未記録です。線を選ぶか、部品の「つながっている接続を編集」から記録できます。` });
    if (d.mode === 'async' && !d.retry?.trim()) findings.push({ id: `retry:${e.id ?? i}`, edgeId: e.id, kind: 'unknown', title: `${label}: 失敗した仕事はどうする？`, detail: '再試行・重複を防ぐ方法・諦めた仕事の確認先を考えましょう。' });
  });
  return findings;
}

export function reachable(graph: ReviewGraph, source: string, disabled = new Set<string>()) {
  const ids = new Set(graph.nodes.map(n => n.id));
  const visited = new Set<string>();
  if (!ids.has(source) || disabled.has(source)) return visited;
  const queue = [source]; visited.add(source);
  for (let i = 0; i < queue.length; i++) for (const edge of graph.edges) {
    if (edge.source === queue[i] && ids.has(edge.target) && !disabled.has(edge.target) && !visited.has(edge.target)) {
      visited.add(edge.target); queue.push(edge.target);
    }
  }
  return visited;
}

/** Whole selected logical component stops. Count is not expanded into virtual replicas. */
export function failureImpact(graph: ReviewGraph, source: string, stopped: string) {
  const selected = graph.nodes.find(n => n.id === stopped);
  const disabled = new Set(selected ? [stopped] : []);
  // Use explicit placement only. Security Group association is not physical containment.
  if (selected && Object.values(placementTypes).includes(selected.data.originalType as typeof placementTypes[keyof typeof placementTypes])) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of graph.nodes) {
        const d = n.data.design;
        if (!disabled.has(n.id) && [d?.vpcId, d?.zoneId, d?.subnetId].some(id => id && disabled.has(id))) { disabled.add(n.id); changed = true; }
      }
    }
  }
  const before = reachable(graph, source);
  const after = reachable(graph, source, disabled);
  return { disabled: [...disabled], before: [...before], after: [...after], lost: [...before].filter(id => !after.has(id)) };
}

export function compareDesigns(before: ReviewGraph, after: ReviewGraph) {
  const byId = new Map(before.nodes.map(n => [n.id, n]));
  const added = after.nodes.filter(n => !byId.has(n.id));
  const removed = before.nodes.filter(n => !after.nodes.some(next => next.id === n.id));
  const changed = after.nodes.filter(n => { const previous = byId.get(n.id); return previous && JSON.stringify([previous.data, previous.parentNode]) !== JSON.stringify([n.data, n.parentNode]); });
  const edgeKey = (e: SimpleEdgeData) => JSON.stringify([e.source, e.target, e.data ?? null]);
  const oldEdges = new Set(before.edges.map(edgeKey)); const newEdges = new Set(after.edges.map(edgeKey));
  return { added, removed, changed, connectionsAdded: after.edges.filter(e => !oldEdges.has(edgeKey(e))).length, connectionsRemoved: before.edges.filter(e => !newEdges.has(edgeKey(e))).length };
}
