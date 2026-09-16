import { stageIds, componentStages } from '../constants/componentStages.ts';
import type { StageId } from '../constants/componentStages.ts';
import type { LessonState } from './learningCourse.ts';
import type { LabState } from './courseLabs.ts';

export type DiagramStage = StageId | 'estimate' | 'graduation';
export type DiagramKey = `${StageId}-${'learn' | 'practice'}` | 'estimate' | 'graduation';
export type PartType = StageId | 'responder';
export interface CoursePart { id: string; kind: PartType; x: number; y: number; stopped: boolean }
export interface CourseWire { id: string; source: string; target: string }
export interface CourseDiagram { nodes: CoursePart[]; edges: CourseWire[]; checked: string | null }
export const diagramKeys: DiagramKey[] = [...stageIds.flatMap(id => [`${id}-learn`, `${id}-practice`] as DiagramKey[]), 'estimate', 'graduation'];
export function diagramStage(key: DiagramKey): DiagramStage { return key.split('-')[0] as DiagramStage; }
export function allowedParts(stage: DiagramStage): readonly StageId[] {
  return stage === 'graduation' ? stageIds : stageIds.slice(0, stage === 'estimate' ? 3 : stageIds.indexOf(stage) + 1);
}
export function partName(node: CoursePart): string { return node.kind === 'responder' ? '教材の応答先' : componentStages[node.kind].component + (node.kind === 'app' ? ` ${node.id.endsWith('-2') ? 'B' : 'A'}` : ''); }
export function partRole(kind: PartType): string { return kind === 'responder' ? '要求を受けて、教材の返事を返す相手' : componentStages[kind].role; }
export function diagramSignature(g: CourseDiagram): string {
  return JSON.stringify([g.nodes.map(n => [n.id, n.kind, n.stopped]).sort(), g.edges.map(e => [e.source, e.target]).sort()]);
}
export function connectParts(g: CourseDiagram, source: string, target: string): CourseDiagram {
  if (g.nodes.find(n => n.id === source)?.kind === 'responder' || source === target || !g.nodes.some(n => n.id === source) || !g.nodes.some(n => n.id === target) || g.edges.length >= 24 || g.edges.some(e => e.source === source && e.target === target)) return g;
  return { ...g, edges: [...g.edges, { id: `${source}--${target}`, source, target }] };
}
/** Arrange by teaching role, never infer or change the learner's connections. */
function layoutCourseDiagram(g: CourseDiagram, stage: DiagramStage, rowHeight: number, columnWidth: number): CourseDiagram {
  const parts = g.nodes.map(n => ({ id: n.id, kind: n.kind }));
  // Leave room for the part this exercise asks the learner to add.
  if (stage !== 'estimate' && stage !== 'graduation' && !parts.some(n => n.kind === stage)) parts.push({ id: `${stage}-1`, kind: stage });
  const rows: PartType[][] = [['browser'], ['gateway'], ['balancer'], ['app'], ['responder', 'cache', 'database', 'queue'], ['worker']];
  const positions = new Map<string, { x: number; y: number }>();
  let row = 0;
  for (const kinds of rows) {
    const members = kinds.flatMap(kind => parts.filter(n => n.kind === kind).sort((a, b) => a.id.localeCompare(b.id)));
    if (!members.length) continue;
    members.forEach((n, i) => positions.set(n.id, { x: 320 + (i - (members.length - 1) / 2) * columnWidth, y: 40 + row * rowHeight }));
    row++;
  }
  const queue = parts.find(n => n.kind === 'queue');
  if (queue) for (const n of parts.filter(n => n.kind === 'worker')) positions.get(n.id)!.x = positions.get(queue.id)!.x;
  // The first lesson's fixed responder stays where it was, including restored older diagrams.
  const fixture = g.nodes.find(n => n.kind === 'responder');
  const dx = fixture ? fixture.x - positions.get(fixture.id)!.x : 0, dy = fixture ? fixture.y - positions.get(fixture.id)!.y : 0;
  return { ...g, nodes: g.nodes.map(n => ({ ...n, x: Math.max(-5000, Math.min(5000, positions.get(n.id)!.x + dx)), y: Math.max(-5000, Math.min(5000, positions.get(n.id)!.y + dy)) })) };
}
export function arrangeCourseDiagram(g: CourseDiagram, stage: DiagramStage): CourseDiagram {
  // Intro browser cards include an action: keep a long, visible travel lane below them.
  return layoutCourseDiagram(g, stage, stage === 'browser' || stage === 'app' ? 240 : 190, 320);
}
function refreshDefaultLayout(g: CourseDiagram, stage: DiagramStage): CourseDiagram {
  const previous = layoutCourseDiagram(g, stage, 120, 280);
  // Only refresh untouched old templates. A manually positioned graph stays exactly as saved.
  return g.nodes.every((n, i) => n.x === previous.nodes[i].x && n.y === previous.nodes[i].y) ? arrangeCourseDiagram(g, stage) : g;
}
export function addPart(g: CourseDiagram, stage: DiagramStage, kind: StageId, position?: { x: number; y: number }, practice = false): CourseDiagram {
  if (!allowedParts(stage).includes(kind)) return g;
  const max = kind === 'app' && allowedParts(stage).includes('balancer') ? 2 : 1;
  const number = Array.from({ length: max }, (_, i) => i + 1).find(i => !g.nodes.some(n => n.id === `${kind}-${i}`));
  if (!number) return g;
  const node: CoursePart = { id: `${kind}-${number}`, kind, x: 0, y: 0, stopped: kind === 'worker' || (stage === 'balancer' && practice && kind === 'app' && number === 1) };
  const next = { ...g, nodes: [...g.nodes, node] };
  if (position) return { ...g, nodes: [...g.nodes, { ...node, x: Math.max(-5000, Math.min(5000, position.x)), y: Math.max(-5000, Math.min(5000, position.y)) }] };
  const arranged = arrangeCourseDiagram(next, stage);
  // Keep a clean starter layout tidy as parts are added; don't move a custom layout.
  if (arrangeCourseDiagram(g, stage).nodes.every((n, i) => n.x === g.nodes[i].x && n.y === g.nodes[i].y)) return arranged;
  const placed = { ...arranged.nodes.at(-1)! };
  const step = placed.x >= 0 ? -320 : 320;
  while (g.nodes.some(n => Math.abs(n.x - placed.x) < 260 && Math.abs(n.y - placed.y) < 110)) placed.x += step;
  return { ...g, nodes: [...g.nodes, placed] };
}
export function removePart(g: CourseDiagram, id: string): CourseDiagram {
  if (g.nodes.find(n => n.id === id)?.kind === 'responder') return g;
  return { ...g, nodes: g.nodes.filter(n => n.id !== id), edges: g.edges.filter(e => e.source !== id && e.target !== id) };
}
export function newDiagram(key: DiagramKey): CourseDiagram {
  const stage = diagramStage(key), practice = key.endsWith('practice');
  let g: CourseDiagram = { nodes: [], edges: [], checked: null };
  const add = (kind: StageId) => { g = addPart(g, stage, kind, undefined, practice); };
  const link = (s: string, t: string) => { g = connectParts(g, `${s}-1`, `${t}-1`); };
  if (stage === 'browser') {
    if (!practice) add('browser');
    g.nodes.push({ id: 'responder', kind: 'responder', x: 320, y: 280, stopped: false });
    return arrangeCourseDiagram(g, stage);
  }
  add('browser'); if (stage === 'app' && practice) return g;
  add('app');
  if (stage === 'app') return g;
  link('browser', 'app');
  if (['balancer', 'estimate', 'cache', 'graduation'].includes(stage)) { add('database'); link('app', 'database'); }
  if (stage === 'cache' && practice) add('cache');
  if (stage === 'worker') { add('queue'); link('app', 'queue'); }
  return g;
}
export function newDiagrams(): Record<DiagramKey, CourseDiagram> { return Object.fromEntries(diagramKeys.map(key => [key, newDiagram(key)])) as Record<DiagramKey, CourseDiagram>; }
export function parseDiagram(value: unknown, key: DiagramKey): CourseDiagram {
  const g = value as CourseDiagram, stage = diagramStage(key);
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges) || g.nodes.length > 10 || g.edges.length > 24 || !(g.checked === null || typeof g.checked === 'string' && g.checked.length < 6000)) throw new Error('学習する図の形式が不正です');
  const seen = new Set<string>();
  const nodes = g.nodes.map(n => {
    const fixture = stage === 'browser' && n?.kind === 'responder' && n.id === 'responder';
    if (!n || (!fixture && (!allowedParts(stage).includes(n.kind as StageId) || !(n.id === `${n.kind}-1` || n.kind === 'app' && allowedParts(stage).includes('balancer') && n.id === 'app-2'))) || seen.has(n.id) || !Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > 5000 || Math.abs(n.y) > 5000 || typeof n.stopped !== 'boolean') throw new Error('使用できない部品、位置または重複があります');
    if (n.stopped && !((stage === 'balancer' && n.kind === 'app') || n.kind === 'worker')) throw new Error('この部品の停止は扱いません');
    seen.add(n.id); return { id: n.id, kind: n.kind, x: n.x, y: n.y, stopped: n.stopped };
  });
  for (const kind of [...stageIds, 'responder']) {
    const max = kind === 'app' && allowedParts(stage).includes('balancer') ? 2 : 1;
    if (nodes.filter(n => n.kind === kind).length > max) throw new Error('部品の台数が範囲外です');
  }
  if (stage === 'browser' && !nodes.some(n => n.kind === 'responder')) throw new Error('教材の応答先がありません');
  const pairs = new Set<string>();
  const edges = g.edges.map(e => {
    if (!e || e.source === 'responder' || !seen.has(e.source) || !seen.has(e.target) || e.source === e.target || e.id !== `${e.source}--${e.target}` || pairs.has(e.id)) throw new Error('接続が不正です');
    pairs.add(e.id); return { id: e.id, source: e.source, target: e.target };
  });
  return refreshDefaultLayout({ nodes, edges, checked: g.checked }, stage);
}
export function inspectDiagram(g: CourseDiagram) {
  const nodes = [...g.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const of = (kind: PartType) => nodes.filter(n => n.kind === kind);
  const linked = (s?: CoursePart, t?: CoursePart) => !!s && !!t && g.edges.some(e => e.source === s.id && e.target === t.id);
  const browser = of('browser')[0], database = of('database')[0], cache = of('cache')[0], queue = of('queue')[0], worker = of('worker')[0];
  const routes: CoursePart[][] = [];
  const walk = (path: CoursePart[]) => {
    const n = path.at(-1)!;
    if (n.kind === 'app') { routes.push(path); return; }
    for (const next of nodes) if (!path.includes(next) && linked(n, next) && ['app', 'balancer', 'gateway'].includes(next.kind)) walk([...path, next]);
  };
  if (browser) walk([browser]);
  const balanced = routes.length > 0 && routes.every(p => p.some(n => n.kind === 'balancer'));
  const limited = routes.length > 0 && routes.every(p => p.some(n => n.kind === 'gateway'));
  const routedApps = of('app').filter(n => routes.some(p => p.at(-1) === n));
  const apps = balanced ? routedApps : routedApps.slice(0, 1);
  return { browser, database, cache, queue, worker, routes, apps, routedApps, balanced, limited, linked,
    browserReady: linked(browser, of('responder')[0]),
    hasDatabase: !!database && apps.length > 0 && apps.every(n => linked(n, database)),
    hasCache: !!cache && apps.length > 0 && apps.every(n => linked(n, cache)),
    hasQueue: !!queue && apps.length > 0 && apps.every(n => linked(n, queue)),
    hasWorker: linked(queue, worker),
  };
}
export function diagramProblem(stage: DiagramStage, g: CourseDiagram, action = 'run'): string {
  const t = inspectDiagram(g);
  if (stage === 'browser') return t.browserReady ? '' : 'Web Browserの出力から、教材の応答先の入力へつないでください。';
  if (stage === 'worker' && ['work', 'replay'].includes(action)) return t.hasWorker ? '' : 'Message QueueからWorkerへの接続がありません。部品を追加してつないでください。';
  if (!t.browser || !t.apps.length) return 'ブラウザからアプリへ届く経路がありません。矢印の向きも確かめてください。';
  if (!['balancer', 'graduation'].includes(stage) && t.apps.some(n => n.stopped)) return '経路上のアプリが停止しています。稼働状態を確かめてください。';
  if (['balancer', 'estimate', 'cache', 'graduation'].includes(stage) && !t.hasDatabase) return '要求が届くアプリからDBへつながっていません。保存先までの経路を確かめてください。';
  if (stage === 'balancer' && t.apps.length > 1 && t.apps.every(n => n.stopped)) return 'すべてのアプリが停止しています。1台を再開して比較してください。';
  if (stage === 'cache' && action === 'invalidate' && !t.hasCache) return 'アプリからキャッシュへつないでから、コピーを無効化してください。';
  if (stage === 'worker' && !t.hasQueue) return 'アプリからMessage Queueへつながっていません。';
  if (stage === 'graduation' && t.hasQueue && (!t.hasWorker || t.worker?.stopped)) return 'キューにWorkerをつなぎ、停止を解除してから試してください。';
  return '';
}
export function diagramReady(stage: DiagramStage, g: CourseDiagram): boolean {
  if (g.checked !== diagramSignature(g) || diagramProblem(stage, g, stage === 'worker' ? 'work' : 'run')) return false;
  const t = inspectDiagram(g);
  if (stage === 'database') return t.hasDatabase;
  if (stage === 'balancer') return t.balanced && t.apps.length === 2;
  if (stage === 'cache') return t.hasCache;
  if (stage === 'queue') return t.hasQueue;
  if (stage === 'worker') return t.hasWorker && !t.worker?.stopped;
  if (stage === 'gateway') return t.limited;
  return true;
}
export function syncLessonDiagram(state: LessonState, g: CourseDiagram): LessonState {
  const t = inspectDiagram(g);
  return { ...state, appConnected: t.apps.length > 0 && t.apps.some(n => !n.stopped), databaseAdded: !!t.database, databaseConnected: t.hasDatabase };
}
export function syncLabDiagram<T extends LabState>(state: T, g: CourseDiagram): T {
  const t = inspectDiagram(g);
  switch (state.kind) {
    case 'balance': return { ...state, servers: Math.max(1, t.routedApps.length), balanced: t.balanced, stopped: t.apps.some(n => n.id === 'app-1' && n.stopped), stoppedB: t.apps.some(n => n.id === 'app-2' && n.stopped), routed: t.apps.map(n => n.id) };
    case 'cache': return { ...state, enabled: t.hasCache };
    case 'queue': return { ...state, enabled: t.hasQueue, ...(t.worker ? { workerRunning: t.hasWorker && !t.worker.stopped } : {}) };
    case 'rate': return { ...state, enabled: t.limited };
    case 'design': return { ...state, servers: Math.max(1, t.routedApps.length), balanced: t.balanced, cache: t.hasCache, queue: t.hasQueue && t.hasWorker, limit: t.limited, routed: t.apps.map(n => n.id), componentCount: g.nodes.length };
    default: return state;
  }
}
export function diagramTrace(g: CourseDiagram, stage: DiagramStage, action: string, cacheHit = false): string[] {
  const t = inspectDiagram(g);
  if (stage === 'browser') return [t.browser?.id, ...(t.browserReady ? ['responder', t.browser?.id] : [])].filter(Boolean) as string[];
  if (stage === 'worker' && ['work', 'replay'].includes(action)) return [t.queue?.id, ...(t.hasWorker ? [t.worker?.id] : [])].filter(Boolean) as string[];
  const path = t.routes.find(p => !p.at(-1)?.stopped) ?? t.routes[0];
  if (!path) return t.browser ? [t.browser.id] : [];
  const ids = path.map(n => n.id);
  if (['submit', 'work', 'replay'].includes(action) && t.hasQueue) ids.push(t.queue!.id);
  else if (stage === 'cache' && t.hasCache && action !== 'write') { ids.push(t.cache!.id); if (!cacheHit && action === 'read' && t.hasDatabase) ids.push(t.apps[0].id, t.database!.id); }
  else if (t.hasDatabase && ['save', 'read', 'write', 'run'].includes(action)) ids.push(t.database!.id);
  return ids;
}
