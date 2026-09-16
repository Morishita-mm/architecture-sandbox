import { labIds, labLessons } from '../constants/courseCurriculum.ts';
import type { LabId } from '../constants/courseCurriculum.ts';

interface AppRoutes { routed?: string[] }
interface LabBase { observed: string[]; answer: string }
export interface EstimateLab extends LabBase { kind: 'estimate'; users: number; requestsPerDay: number; peakFactor: number }
export interface BalanceLab extends LabBase, AppRoutes { kind: 'balance'; servers: number; balanced: boolean; stopped: boolean; load: number; dbCapacity: number; stoppedB?: boolean }
export interface CacheLab extends LabBase { kind: 'cache'; enabled: boolean; draft: string; origin: string; cached: string | null; displayed: string | null; dbReads: number; hits: number; invalidated: boolean }
export interface QueueLab extends LabBase { kind: 'queue'; enabled: boolean; workerRunning: boolean; deduplicate: boolean; pending: number[]; completed: number[]; deliveries: number; nextId: number; lastId: number | null }
export interface RateLab extends LabBase { kind: 'rate'; enabled: boolean; tokens: number; time: number; batch: number; retryWaiting: number; appRemaining: number }
export interface DesignTrial { signature: string; objective: string; completed: number; requests: number; components: number; dbReads: number; meets: boolean }
export interface DesignLab extends LabBase, AppRoutes { kind: 'design'; objective: 'small' | 'peak' | 'continuity'; servers: number; balanced: boolean; cache: boolean; queue: boolean; limit: boolean; reason: string; tradeoff: string; last: DesignTrial | null; componentCount?: number }
export type LabState = EstimateLab | BalanceLab | CacheLab | QueueLab | RateLab | DesignLab;
export type LabAction = 'run' | 'read' | 'write' | 'invalidate' | 'submit' | 'work' | 'replay' | 'advance' | 'retry';
export interface LabResult { title: string; explanation: string; steps: string[]; metrics: { label: string; value: string }[]; tone: 'success' | 'notice'; comparison?: string }
export function newLab(kind: LabId): LabState {
  const base = { observed: [], answer: '' };
  switch (kind) {
    case 'estimate': return { ...base, kind, users: 10000, requestsPerDay: 20, peakFactor: 1 };
    case 'balance': return { ...base, kind, servers: 1, balanced: false, stopped: false, load: 12, dbCapacity: 20 };
    case 'cache': return { ...base, kind, enabled: false, draft: '集合は12時です', origin: '集合は10時です', cached: null, displayed: null, dbReads: 0, hits: 0, invalidated: false };
    case 'queue': return { ...base, kind, enabled: false, workerRunning: true, deduplicate: false, pending: [], completed: [], deliveries: 0, nextId: 1, lastId: null };
    case 'rate': return { ...base, kind, enabled: false, tokens: 3, time: 0, batch: 5, retryWaiting: 0, appRemaining: 3 };
    case 'design': return { ...base, kind, objective: 'small', servers: 1, balanced: false, cache: false, queue: false, limit: false, reason: '', tradeoff: '', last: null };
  }
}
export function newLabs(): Record<LabId, LabState> { return Object.fromEntries(labIds.map(id => [id, newLab(id)])) as Record<LabId, LabState>; }
export function estimateLoad(s: EstimateLab) {
  const daily = s.users * s.requestsPerDay;
  return { daily, average: daily / 86400, peak: daily / 86400 * s.peakFactor };
}
export function routeLoad(s: Pick<BalanceLab, 'servers' | 'balanced' | 'stopped' | 'stoppedB' | 'routed' | 'load' | 'dbCapacity'>) {
  const routed = s.routed ?? (s.balanced && s.servers === 2 ? ['app-1', 'app-2'] : ['app-1']);
  const active = routed.filter(id => id === 'app-1' ? !s.stopped : !s.stoppedB);
  const available = active.length, appDone = Math.min(s.load, available * 6);
  const completed = Math.min(appDone, s.dbCapacity);
  const a = active.includes('app-1') ? available === 2 ? Math.ceil(appDone / 2) : appDone : 0;
  const b = active.includes('app-2') ? available === 2 ? Math.floor(appDone / 2) : appDone : 0;
  return { available, appDone, completed, unprocessed: s.load - completed, a, b, dbLimited: appDone > s.dbCapacity };
}
export const designObjectives = { small: '普段の利用：4件/秒を処理する', peak: '集中する時間：12件/秒を処理する', continuity: 'アプリAが停止：4件/秒を処理する' };
export function evaluateDesign(s: DesignLab): DesignTrial {
  const requests = s.objective === 'peak' ? 12 : 4;
  const admitted = s.limit ? Math.min(requests, 3) : requests;
  const route = routeLoad({ ...s, stopped: s.objective === 'continuity', load: admitted, dbCapacity: 20 });
  const dbReads = s.cache ? Math.ceil(route.completed / 2) : route.completed;
  return { signature: JSON.stringify([s.objective, s.servers, s.balanced, s.cache, s.queue, s.limit, ...(s.routed ? [s.routed, s.componentCount] : [])]), objective: designObjectives[s.objective], completed: route.completed, requests, components: s.componentCount ?? 2 + s.servers + Number(s.balanced) + Number(s.cache) + Number(s.queue) * 2 + Number(s.limit), dbReads, meets: route.completed === requests };
}
export function labComplete(state: LabState): boolean {
  const lesson = labLessons[state.kind];
  const observed = lesson.checks.every(c => state.observed.includes(c.id));
  if (!observed || state.answer !== lesson.correct) return false;
  return state.kind !== 'design' || Boolean(state.last?.meets && state.last.signature === evaluateDesign(state).signature && state.reason.trim() && state.tradeoff.trim());
}
function observed<T extends LabState>(s: T, ...facts: string[]): T {
  return { ...s, observed: [...new Set([...s.observed, ...facts])] };
}
export function runLab(previous: LabState, action: LabAction): { state: LabState; result: LabResult } {
  let state: LabState = structuredClone(previous);
  const finish = (title: string, explanation: string, steps: string[] = [], metrics: LabResult['metrics'] = [], tone: LabResult['tone'] = 'notice', comparison?: string) => ({ state, result: { title, explanation, steps, metrics, tone, comparison } });
  const count = (label: string, value: number, unit = '件') => ({ label, value: `${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}${unit}` });
  switch (state.kind) {
    case 'estimate': {
      if (action !== 'run') break;
      const { daily, average, peak } = estimateLoad(state);
      state = observed(state, state.peakFactor === 1 ? 'average' : 'peak');
      return finish(peak > 10 ? '集中する時間は、仮の処理上限を超えます' : 'この仮定では、1台の処理上限内です', '平均とピークは別の数字です。何倍に集中するかは仮定なので、実際の使われ方を確認する必要があります。', [`${state.users.toLocaleString()}人 × ${state.requestsPerDay}回 = ${daily.toLocaleString()}件/日`, `${daily.toLocaleString()}件 ÷ 86,400秒 = 平均 ${average.toFixed(2)}件/秒`, `平均 × ${state.peakFactor}倍 = ピーク ${peak.toFixed(2)}件/秒`], [count('1日の要求', daily), count('平均', average, '件/秒'), count('ピーク', peak, '件/秒'), count('教材の1台上限', 10, '件/秒')], peak > 10 ? 'notice' : 'success');
    }
    case 'balance': {
      if (action !== 'run') break;
      const r = routeLoad(state);
      if (state.servers === 1 && !state.stopped && r.unprocessed > 0) state = observed(state, 'overload');
      if (state.balanced && state.servers === 2 && !state.stopped && !state.stoppedB && r.completed > 6) state = observed(state, 'spread');
      if (state.balanced && state.servers === 2 && (state.stopped || state.stoppedB) && r.completed === state.load) state = observed(state, 'survive');
      return finish(r.dbLimited ? '今度はDBの上限が全体を制限しています' : r.unprocessed ? '処理しきれない要求が残りました' : 'この1秒分の要求を処理できました', r.dbLimited ? 'アプリを増やしても、すべてが通るDBの能力を超えることはできません。' : state.stopped || state.stoppedB ? '停止を検知して別のアプリへ送る前提です。止まった後の合計能力は減ります。' : state.servers === 1 ? '1台の上限は6件/秒です。台数と振り分けを変え、処理できる量を比べましょう。' : !state.balanced ? '2台目への経路がありません。同じ1台に届く構成では、追加した能力を使えません。' : '稼働中の2台へ要求を分けました。全体の能力は増えますが、1台停止した場合と共通のDBも確かめましょう。', [`入口：${state.balanced ? '稼働中のアプリに振り分ける' : '図の直接経路に送る'}`, `アプリA ${r.a}件・アプリB ${r.b}件を処理`, `DBが${r.completed}件を処理し、返事を返す`], [count('要求', state.load), count('アプリAの処理', r.a), count('アプリBの処理', r.b), count('完了', r.completed), count('未処理', r.unprocessed)], r.unprocessed ? 'notice' : 'success');
    }
    case 'cache': {
      if (action === 'write') {
        if (!state.draft.trim()) return finish('更新する内容を入力してください', '教材用の短いお知らせで試せます。');
        state.origin = state.draft.trim();
        return finish('DBのお知らせを更新しました', 'キャッシュは変更していません。もう一度読み、表示する内容を比べましょう。', ['アプリ → DB：新しい内容を保存', 'キャッシュ：以前のコピーを維持']);
      }
      if (action === 'invalidate') { state.cached = null; state.invalidated = true; return finish('コピーを無効化しました', 'DBの記録は残ります。キャッシュを使ったまま、もう一度読んでみましょう。'); }
      if (action !== 'read') break;
      const hit = state.enabled && state.cached !== null;
      state.displayed = hit ? state.cached : state.origin;
      if (hit) { state.hits += 1; state = observed(state, 'hit'); }
      else { state.dbReads += 1; if (state.enabled) state.cached = state.origin; else state = observed(state, 'direct'); }
      const stale = state.displayed !== state.origin;
      if (stale) state = observed(state, 'stale');
      if (state.enabled && !hit && state.invalidated && state.observed.includes('stale')) state = observed(state, 'fresh');
      return finish(stale ? '更新前のコピーが表示されました' : hit ? 'DBを読まず、キャッシュから返しました' : 'DBから最新の内容を読みました', stale ? '問い合わせは減りましたが、表示は古いままです。キャッシュを無効化してもう一度読みましょう。' : '累計のDB読み出し回数と、画面に返った内容を見比べましょう。', [state.enabled ? `アプリ → キャッシュ：${hit ? 'ヒット' : 'ミス'}` : 'キャッシュを使わない', hit ? 'コピーを取得する' : 'アプリ → DB：読み出す', `ブラウザに「${state.displayed}」を表示`], [count('DB読み出し累計', state.dbReads, '回'), count('キャッシュヒット累計', state.hits, '回')], stale ? 'notice' : 'success');
    }
    case 'queue': {
      if (action === 'submit') {
        if (state.pending.length >= 20 || state.nextId > 1000) return finish('教材の受付上限です', '残った仕事を処理するか、この章をやり直してください。');
        const id = state.nextId++;
        if (state.enabled) { state.pending.push(id); state = observed(state, 'queued'); return finish(`仕事 #${id} を受け付けました`, 'まだ通知は送っていません。「1件処理する」でWorkerの動きを進めます。', ['アプリ → キュー：仕事を預ける', 'アプリ → ブラウザ：受付済みと返す'], [count('待っている仕事', state.pending.length), count('通知実行累計', state.deliveries)], 'success'); }
        state.completed.push(id); state.lastId = id; state.deliveries += 1; state = observed(state, 'sync');
        return finish(`仕事 #${id} の完了を待って返事をしました`, '同期の処理では、通知が終わるまで利用者の要求への返事を待ちます。ここでは実時間の待ちを発生させず、順序を再現しています。', ['ブラウザ → アプリ：通知を頼む', 'アプリ：通知が終わるまで処理する', 'アプリ → ブラウザ：完了と返す'], [count('通知実行累計', state.deliveries)], 'success');
      }
      if (action === 'replay') {
        if (!state.enabled || state.lastId === null) return finish('再配信する仕事がありません', 'キューを有効にし、通知を1件処理してから試しましょう。');
        if (state.pending.length >= 20) return finish('教材のキューがいっぱいです', '先に残った仕事を処理してください。');
        state.pending.push(state.lastId);
        return finish(`仕事 #${state.lastId} がもう一度届きました`, '次の処理で、通知が二重に送られるかを確かめましょう。', ['同じ仕事IDをキューへ再配信']);
      }
      if (action !== 'work') break;
      if (!state.pending.length) return finish('待っている仕事はありません', 'キューを使って通知を依頼しましょう。');
      if (!state.workerRunning) { state = observed(state, 'paused'); return finish('Workerが停止しているため、仕事は残っています', '受付と完了は別です。Workerを再開して処理しましょう。', ['キュー：仕事を保持', 'Worker：停止中'], [count('待っている仕事', state.pending.length)]); }
      const job = state.pending.shift()!;
      const duplicate = state.completed.includes(job);
      state.lastId = job;
      if (duplicate && state.deduplicate) { state = observed(state, 'deduplicated'); return finish(`仕事 #${job} の重複を検知しました`, '処理済みIDを確認したため、通知の実行数は増えません。', ['Worker：処理済みIDを確認', '同じ通知を送らず完了扱いにする'], [count('通知実行累計', state.deliveries), count('残りの仕事', state.pending.length)], 'success'); }
      if (duplicate) state = observed(state, 'duplicate'); else state.completed.push(job);
      state.deliveries += 1;
      return finish(duplicate ? '同じ通知を二重に実行しました' : `仕事 #${job} の通知を実行しました`, duplicate ? '重複防止を有効にして、同じ仕事の再配信をもう一度試しましょう。' : 'Workerが仕事を取り出し、通知を実行しました。再配信された場合も試せます。', [`Worker：仕事 #${job} を取り出す`, '通知を送る', '仕事の完了を記録する'], [count('通知実行累計', state.deliveries), count('残りの仕事', state.pending.length)], duplicate ? 'notice' : 'success');
    }
    case 'rate': {
      if (action === 'advance') { state.time += 1; state.tokens = Math.min(3, state.tokens + 2); state.appRemaining = 3; return finish('仮想時間を1秒進めました', 'トークンを2枚補充し、アプリの次の1秒の処理枠を用意しました。', [], [count('仮想時間', state.time, '秒'), count('トークン', state.tokens, '枚')]); }
      if (action !== 'run' && action !== 'retry') break;
      const requested = action === 'retry' ? state.retryWaiting : state.batch;
      if (!requested) return finish('再試行を待つ要求はありません', '入口で見送られた要求があるときに再試行できます。');
      const admitted = state.enabled ? Math.min(state.tokens, requested) : requested;
      const rejected = requested - admitted;
      if (state.enabled) state.tokens -= admitted;
      const completed = Math.min(admitted, state.appRemaining);
      const overloaded = admitted - completed;
      state.appRemaining -= completed;
      state.retryWaiting = action === 'retry' ? rejected : Math.min(10000, state.retryWaiting + rejected);
      if (!state.enabled && overloaded) state = observed(state, 'overload');
      if (state.enabled && rejected && completed && !overloaded) state = observed(state, 'limited');
      if (action === 'retry' && state.enabled && completed) state = observed(state, 'retried');
      return finish(overloaded ? '処理先の上限を超えました' : rejected ? '入口で一部の受付を見送りました' : '今回の要求を処理できました', rejected ? '429相当の応答です。見送り分は利用者側で再試行を待ちます。時間を進めてから試してください。' : '処理先の能力自体が増えたわけではありません。同じ時刻に送れば枠が減り続けます。', [`入口：${admitted}件を通し、${rejected}件を見送る`, `アプリ：${completed}件完了、${overloaded}件は能力超過`, `利用者側：${state.retryWaiting}件を再試行待ちとして保持`], [count('完了', completed), count('入口で見送り', rejected), count('能力超過', overloaded), count('残りのトークン', state.tokens, '枚')], overloaded || rejected ? 'notice' : 'success');
    }
    case 'design': {
      if (action !== 'run') break;
      const trial = evaluateDesign(state), before = state.last;
      state = observed(state, 'tested', ...(before && before.signature !== trial.signature ? ['compared'] : []));
      state.last = trial;
      return finish(trial.meets ? '教材で指定した処理条件を満たしました' : '指定した全要求は処理できませんでした', 'この結果だけでは本番の安全性を判断できません。理由と残る課題を書き、図を自由設計へ移して検討を続けられます。', [trial.objective, `受付 → アプリ → DB：${trial.completed}/${trial.requests}件を処理`, state.queue ? '通知はキューで受付後に処理する' : '通知は同期で完了を待つ', state.cache ? '読み出しの半分がキャッシュヒットする仮定' : '読み出しはすべてDBへ届く'], [count('要求', trial.requests), count('完了', trial.completed), count('DB読み出し', trial.dbReads, '回'), count('配置する部品', trial.components, '個')], trial.meets ? 'success' : 'notice', before ? `前回「${before.objective}」：${before.completed}/${before.requests}件完了・部品${before.components}個 → 今回：${trial.completed}/${trial.requests}件完了・部品${trial.components}個。条件が違う場合は単純な優劣では比べられません。` : '条件か構成を変えて、もう一度確かめると前回との差を表示します。');
    }
  }
  return finish('この章の操作を選んでください', '画面の案内から実験を進められます。');
}

// Persist only bounded, known fields. Missing new chapters are allowed only during v1 migration.
export function parseLab(id: LabId, input: unknown): LabState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('学習記録の形式が不正です');
  const v = input as Record<string, unknown>;
  if (v.kind !== id) throw new Error('学習する章が一致しません');
  const bool = (key: string) => { if (typeof v[key] !== 'boolean') throw new Error('設定が不正です'); return v[key]; };
  const num = (key: string, min: number, max: number) => { const x = v[key]; if (typeof x !== 'number' || !Number.isInteger(x) || x < min || x > max) throw new Error('数値が範囲外です'); return x; };
  const str = (key: string, max = 60) => { const x = v[key]; if (typeof x !== 'string' || x.length > max) throw new Error('文章が範囲外です'); return x; };
  const nullable = (key: string) => v[key] === null ? null : str(key);
  const ids = (key: string, max: number) => { const x = v[key]; if (!Array.isArray(x) || x.length > max || x.some(n => !Number.isInteger(n) || n < 1 || n > 1000)) throw new Error('仕事の記録が不正です'); return [...x] as number[]; };
  if (!Array.isArray(v.observed) || v.observed.length > 10 || v.observed.some(x => typeof x !== 'string' || !labLessons[id].checks.some(c => c.id === x))) throw new Error('観察記録が不正です');
  const routes: AppRoutes = {};
  if (v.routed !== undefined) {
    if (!Array.isArray(v.routed) || v.routed.length > 2 || v.routed.some(x => x !== 'app-1' && x !== 'app-2') || new Set(v.routed).size !== v.routed.length) throw new Error('アプリの経路が不正です');
    routes.routed = [...v.routed];
  }
  const base = { observed: [...new Set(v.observed)] as string[], answer: str('answer') };
  switch (id) {
    case 'estimate': return { ...base, kind: id, users: num('users', 100, 1000000), requestsPerDay: num('requestsPerDay', 1, 100), peakFactor: num('peakFactor', 1, 50) };
    case 'balance': return { ...base, ...routes, ...(v.stoppedB === undefined ? {} : { stoppedB: bool('stoppedB') }), kind: id, servers: num('servers', 1, 2), balanced: bool('balanced'), stopped: bool('stopped'), load: num('load', 1, 30), dbCapacity: num('dbCapacity', 1, 30) };
    case 'cache': return { ...base, kind: id, enabled: bool('enabled'), draft: str('draft'), origin: str('origin'), cached: nullable('cached'), displayed: nullable('displayed'), dbReads: num('dbReads', 0, 1e9), hits: num('hits', 0, 1e9), invalidated: bool('invalidated') };
    case 'queue': {
      const nextId = num('nextId', 1, 1001), pending = ids('pending', 20), completed = ids('completed', 1000), lastId = v.lastId === null ? null : num('lastId', 1, 1000);
      if ([...pending, ...completed].some(n => n >= nextId) || (lastId !== null && !completed.includes(lastId)) || new Set(completed).size !== completed.length) throw new Error('仕事IDが不整合です');
      return { ...base, kind: id, enabled: bool('enabled'), workerRunning: bool('workerRunning'), deduplicate: bool('deduplicate'), pending, completed, deliveries: num('deliveries', 0, 1e9), nextId, lastId };
    }
    case 'rate': return { ...base, kind: id, enabled: bool('enabled'), tokens: num('tokens', 0, 3), time: num('time', 0, 1e9), batch: num('batch', 1, 10), retryWaiting: num('retryWaiting', 0, 10000), appRemaining: num('appRemaining', 0, 3) };
    case 'design': {
      if (v.objective !== 'small' && v.objective !== 'peak' && v.objective !== 'continuity') throw new Error('設計条件が不正です');
      let last: DesignTrial | null = null;
      if (v.last !== null) {
        if (!v.last || typeof v.last !== 'object') throw new Error('比較結果が不正です');
        const trial = v.last as DesignTrial;
        if (typeof trial.signature !== 'string' || trial.signature.length > 120 || typeof trial.objective !== 'string' || trial.objective.length > 100 || typeof trial.meets !== 'boolean' || [trial.completed, trial.requests, trial.components, trial.dbReads].some(n => !Number.isInteger(n) || n < 0 || n > 100)) throw new Error('比較結果が不正です');
        last = { signature: trial.signature, objective: trial.objective, completed: trial.completed, requests: trial.requests, components: trial.components, dbReads: trial.dbReads, meets: trial.meets };
      }
      return { ...base, ...routes, ...(v.componentCount === undefined ? {} : { componentCount: num('componentCount', 0, 10) }), kind: id, objective: v.objective, servers: num('servers', 1, 2), balanced: bool('balanced'), cache: bool('cache'), queue: bool('queue'), limit: bool('limit'), reason: str('reason', 500), tradeoff: str('tradeoff', 500), last };
    }
  }
}
