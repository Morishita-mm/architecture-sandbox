import { newDiagrams, diagramKeys, parseDiagram, diagramReady } from './courseDiagram.ts';
import type { CourseDiagram, DiagramKey } from './courseDiagram.ts';
import { stageIds, componentStages } from '../constants/componentStages.ts';
import type { StageId } from '../constants/componentStages.ts';
import { newCourse, newLesson, readCourse, parseCourse, courseLessonComplete, runExperiment } from './learningCourse.ts';
import type { CourseProgress, LessonState, ExperimentAction } from './learningCourse.ts';
import { newLab, runLab, parseLab, labComplete } from './courseLabs.ts';
import type { LabState, QueueLab, LabAction } from './courseLabs.ts';
import { venueScenario, loanScenario } from '../constants/courseScenarios.ts';
export const PREVIOUS_STAGE_STORAGE_KEY = 'architecture-sandbox:component-stages:v3';
export const STAGE_STORAGE_KEY = 'architecture-sandbox:component-stages:v4';
export interface BrowserModel { kind: 'browser'; draft: string; sent: string | null; reply: string | null; displayed: string | null }
export type PracticeModel = BrowserModel | { kind: 'request'; value: LessonState } | { kind: 'storage'; value: LessonState } | LabState;
export interface PracticeAttempt { model: PracticeModel; answer: string; submitted: boolean; started: boolean; delivered: number }
export interface StageProgress {
  version: 4; diagrams: Record<DiagramKey, CourseDiagram>; current: StageId | 'graduation'; view: 'map' | 'learn' | 'practice'; learning: CourseProgress;
  browser: BrowserModel; browserAnswer: string; worker: QueueLab; attempts: Record<StageId, PracticeAttempt>;
  cleared: StageId[]; graduated: boolean; migrated: boolean;
}
export const newBrowser = (): BrowserModel => ({ kind: 'browser', draft: venueScenario.request, sent: null, reply: null, displayed: null });
export const browserPracticeReply = loanScenario.reply;
export const newWorker = (): QueueLab => ({ ...newLab('queue') as QueueLab, enabled: true, workerRunning: false, pending: [1], nextId: 2 });
export function newAttempt(id: StageId): PracticeAttempt {
  let model: PracticeModel;
  switch (id) {
    case 'browser': model = { ...newBrowser(), draft: 'ボールは借りられますか' }; break;
    case 'app': model = { kind: 'request', value: { ...newLesson('request'), draft: '貸出できる道具を教えてください' } }; break;
    case 'database': model = { kind: 'storage', value: { ...newLesson('storage'), draft: 'Aさんがボールを借りた', databaseAdded: true } }; break;
    case 'balancer': model = { ...newLab('balance'), kind: 'balance', servers: 1, balanced: false, stopped: true, load: 6, dbCapacity: 20 }; break;
    case 'cache': model = { ...newLab('cache'), kind: 'cache', enabled: true, draft: '体育館', origin: '体育館', cached: '公園', displayed: null, dbReads: 0, hits: 0, invalidated: false }; break;
    case 'queue': model = { ...newWorker(), enabled: false, pending: [], nextId: 1 }; break;
    case 'worker': model = { ...newWorker(), pending: [1, 1] }; break;
    case 'gateway': model = { ...newLab('rate'), kind: 'rate', enabled: false, tokens: 3, time: 0, batch: 7, retryWaiting: 0, appRemaining: 3 }; break;
  }
  return { model, answer: '', submitted: false, started: false, delivered: 0 };
}
export function newStageProgress(learning = newCourse()): StageProgress {
  return { version: 4, diagrams: newDiagrams(), current: 'browser', view: 'map', learning, browser: newBrowser(), browserAnswer: '', worker: newWorker(), attempts: Object.fromEntries(stageIds.map(id => [id, newAttempt(id)])) as Record<StageId, PracticeAttempt>, cleared: [], graduated: false, migrated: false };
}
export function operateBrowser(previous: BrowserModel, action: string, reply = venueScenario.reply): { state: BrowserModel; message: string } {
  const state = { ...previous };
  if (action === 'send') {
    if (!state.draft.trim()) return { state, message: '送る内容を入力してください。' };
    state.sent = state.draft.trim(); state.reply = reply; state.displayed = reply;
    return { state, message: '要求が届き、戻ってきた返事をブラウザが画面に表示しました。' };
  }
  return { state, message: '図のブラウザのボタンから調べてみましょう。' };
}
export function operateAttempt(previous: PracticeAttempt, action: string): { attempt: PracticeAttempt; message: string } {
  const attempt = { ...previous, submitted: false };
  const m = attempt.model;
  if (m.kind === 'browser') { const r = operateBrowser(m, action, browserPracticeReply); attempt.model = r.state; return { attempt, message: r.message }; }
  if (m.kind === 'request' || m.kind === 'storage') {
    const r = runExperiment(m.kind, m.value, action as ExperimentAction); attempt.model = { ...m, value: r.state };
    return { attempt, message: `${r.result.title}。${r.result.explanation}` };
  }
  if (m.kind === 'rate' && action === 'run' && attempt.started) return { attempt, message: '7件は送信済みです。見送り分を再試行してください。' };
  const r = runLab(m, action as LabAction);
  if (m.kind === 'rate' && r.state.kind === 'rate' && (action === 'run' || action === 'retry')) {
    attempt.delivered += m.appRemaining - r.state.appRemaining;
    if (action === 'run') attempt.started = true;
  }
  attempt.model = r.state;
  return { attempt, message: `${r.result.title}。${r.result.explanation}` };
}
export function practiceChecks(id: StageId, a: PracticeAttempt): { label: string; done: boolean }[] {
  const m = a.model;
  switch (id) {
    case 'browser': return [{ label: 'ボールの貸出状況を調べ、ブラウザに返事が表示される', done: m.kind === 'browser' && !!m.sent && !!m.reply && m.displayed === m.reply }];
    case 'app': return [{ label: '経路をつなぎ、応答先から返事を受け取る', done: m.kind === 'request' && m.value.appConnected && m.value.sawDelivered && m.value.screen !== null }];
    case 'database': return [{ label: 'DBから再起動後に貸出記録を読み出す', done: m.kind === 'storage' && m.value.databaseConnected && m.value.sawDurableRead && m.value.restartSource === 'database' && m.value.screen === m.value.draft }];
    case 'balancer': return [{ label: 'Aが停止したまま、Bへ振り分けて6件を処理する', done: m.kind === 'balance' && m.servers === 2 && m.balanced && m.stopped && m.observed.includes('survive') }];
    case 'cache': return [{ label: '古い会場の表示を確認する', done: m.kind === 'cache' && m.observed.includes('stale') }, { label: 'コピーを無効化し、体育館を表示する', done: m.kind === 'cache' && m.enabled && m.observed.includes('fresh') && m.displayed === '体育館' }];
    case 'queue': return [{ label: '通知は実行せず、仕事をキューに残す', done: m.kind === 'queue' && m.enabled && !m.workerRunning && m.pending.length > 0 && m.deliveries === 0 }];
    case 'worker': return [{ label: '待機していた2件を取り出す', done: m.kind === 'queue' && m.pending.length === 0 }, { label: '仕事 #1 の通知を1回だけ実行する', done: m.kind === 'queue' && m.completed.includes(1) && m.deliveries === 1 && m.observed.includes('deduplicated') }];
    case 'gateway': return [{ label: '入口で利用制限を使う', done: m.kind === 'rate' && m.enabled && m.observed.includes('limited') }, { label: '見送り分を再試行し、7件すべて処理する', done: m.kind === 'rate' && m.retryWaiting === 0 && m.observed.includes('retried') && a.started && a.delivered === 7 }];
  }
}
export function experienceComplete(p: StageProgress, id: StageId): boolean {
  if (!diagramReady(id, p.diagrams[`${id}-learn`])) return false;
  if (id === 'balancer' && !diagramReady('estimate', p.diagrams.estimate)) return false;
  return experienceObserved(p, id);
}
export function experienceObserved(p: StageProgress, id: StageId): boolean {
  switch (id) {
    case 'browser': return !!p.browser.sent && !!p.browser.reply && p.browser.displayed === p.browser.reply && p.browserAnswer === 'display';
    case 'app': return courseLessonComplete(p.learning, 'request');
    case 'database': return courseLessonComplete(p.learning, 'storage');
    case 'balancer': return courseLessonComplete(p.learning, 'estimate') && courseLessonComplete(p.learning, 'balance');
    case 'cache': return courseLessonComplete(p.learning, 'cache');
    case 'queue': return ['sync', 'queued', 'paused'].every(x => p.learning.labs.queue.observed.includes(x)) && p.learning.labs.queue.answer === 'retry';
    case 'worker': return ['paused', 'duplicate', 'deduplicated'].every(x => p.worker.observed.includes(x)) && p.worker.answer === 'retry';
    case 'gateway': return courseLessonComplete(p.learning, 'rate');
  }
}
export function stageUnlocked(p: StageProgress, id: StageId | 'graduation'): boolean {
  if (id === 'graduation') return stageIds.every(key => p.cleared.includes(key));
  return p.cleared.includes(id) || stageIds.slice(0, stageIds.indexOf(id)).every(key => p.cleared.includes(key));
}
export function submitPractice(p: StageProgress, id: StageId): StageProgress {
  if (!stageUnlocked(p, id) || !experienceComplete(p, id)) return p;
  const attempt = { ...p.attempts[id], submitted: true };
  const pass = diagramReady(id, p.diagrams[`${id}-practice`]) && practiceChecks(id, attempt).every(c => c.done) && attempt.answer === componentStages[id].correct;
  return { ...p, attempts: { ...p.attempts, [id]: attempt }, cleared: pass ? [...new Set([...p.cleared, id])] : p.cleared };
}
export function graduate(p: StageProgress): StageProgress {
  return stageUnlocked(p, 'graduation') && diagramReady('graduation', p.diagrams.graduation) && labComplete(p.learning.labs.design) ? { ...p, graduated: true, view: 'map' } : p;
}
export function parseStages(raw: string): StageProgress {
  if (raw.length > 180000) throw new Error('学習記録が大きすぎます');
  const p = JSON.parse(raw);
  if (!p || (p.version !== 3 && p.version !== 4) || !['map', 'learn', 'practice'].includes(p.view) || ![...stageIds, 'graduation'].includes(p.current) || !Array.isArray(p.cleared) || p.cleared.length > 8 || p.cleared.some((id: StageId) => !stageIds.includes(id)) || new Set(p.cleared).size !== p.cleared.length || typeof p.graduated !== 'boolean' || typeof p.migrated !== 'boolean') throw new Error('学習記録が不正です');
  const text = (v: unknown, limit = 60): string => { if (typeof v !== 'string' || v.length > limit) throw new Error('学習内容が不正です'); return v; };
  const browser = (v: BrowserModel): BrowserModel => {
    if (!v || v.kind !== 'browser') throw new Error('ブラウザの記録が不正です');
    return { kind: 'browser', draft: text(v.draft), sent: v.sent === null ? null : text(v.sent), reply: v.reply === null ? null : text(v.reply), displayed: v.displayed === null ? null : text(v.displayed) };
  };
  const result = newStageProgress(parseCourse(JSON.stringify(p.learning)));
  result.browser = browser(p.browser); result.browserAnswer = text(p.browserAnswer);
  result.worker = parseLab('queue', p.worker) as QueueLab;
  for (const id of stageIds) {
    const a = p.attempts?.[id], expected = result.attempts[id].model.kind;
    if (!a || a.model?.kind !== expected || typeof a.submitted !== 'boolean' || typeof a.started !== 'boolean' || !Number.isInteger(a.delivered) || a.delivered < 0 || a.delivered > 7) throw new Error('練習の記録が不正です');
    let model: PracticeModel;
    if (expected === 'browser') model = browser(a.model);
    else if (expected === 'request' || expected === 'storage') {
      const course = newCourse(); course.lessons[expected] = a.model.value;
      model = { kind: expected, value: parseCourse(JSON.stringify(course)).lessons[expected] };
    } else model = parseLab(expected, a.model);
    result.attempts[id] = { model, answer: text(a.answer), submitted: a.submitted, started: a.started, delivered: a.delivered };
  }
  result.cleared = [...p.cleared]; result.graduated = p.graduated && result.cleared.length === stageIds.length;
  if (p.version === 4) {
    for (const key of diagramKeys) result.diagrams[key] = parseDiagram(p.diagrams?.[key], key);
  } else {
    // Earlier checks are retained as history, but the new editable diagrams must be tried.
    for (const id of stageIds) result.attempts[id].submitted = false;
  }
  result.migrated = p.migrated || p.version === 3; result.current = p.current; result.view = p.view;
  if (!stageUnlocked(result, result.current)) { result.current = stageIds.find(id => !result.cleared.includes(id)) ?? 'graduation'; result.view = 'map'; }
  if (result.view === 'practice' && (result.current === 'graduation' || !experienceComplete(result, result.current))) result.view = 'learn';
  return result;
}
export function readStages(): { progress: StageProgress; error: string; started: boolean } {
  try {
    const raw = localStorage.getItem(STAGE_STORAGE_KEY) ?? localStorage.getItem(PREVIOUS_STAGE_STORAGE_KEY);
    if (raw !== null) return { progress: parseStages(raw), error: '', started: true };
    const previous = readCourse(), progress = newStageProgress(previous.progress);
    progress.migrated = previous.started;
    return { progress, error: previous.error, started: previous.started };
  } catch { return { progress: newStageProgress(), error: '前回の学習記録を読み込めませんでした。記録は上書きしていません。学習を始めるか保存を再試行できます。設計プロジェクトには影響しません。', started: false }; }
}
