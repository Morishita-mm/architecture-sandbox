import { labIds } from '../constants/courseCurriculum.ts';
import type { LabId } from '../constants/courseCurriculum.ts';
import { labComplete, newLabs, parseLab } from './courseLabs.ts';
import type { LabState } from './courseLabs.ts';
import { requestReply } from '../constants/courseScenarios.ts';
export type LessonId = 'request' | 'storage';
export type CourseLessonId = LessonId | LabId;
export const LEGACY_COURSE_STORAGE_KEY = 'architecture-sandbox:learning-course:v1';
export const COURSE_STORAGE_KEY = 'architecture-sandbox:learning-course:v2';
export const basicLessonIds: LessonId[] = ['request', 'storage'];
export const lessonIds: CourseLessonId[] = [...basicLessonIds, ...labIds];
export function isBasicLesson(id: CourseLessonId): id is LessonId { return id === 'request' || id === 'storage'; }

export interface LessonState {
  appConnected: boolean;
  databaseAdded: boolean;
  databaseConnected: boolean;
  draft: string;
  memory: string | null;
  database: string | null;
  screen: string | null;
  restartSource: 'memory' | 'database' | null;
  sawDelivered: boolean;
  sawBlocked: boolean;
  sawVolatileLoss: boolean;
  sawDurableRead: boolean;
  answer: string;
}
export interface CourseProgress {
  version: 2;
  current: CourseLessonId;
  lessons: Record<LessonId, LessonState>;
  labs: Record<LabId, LabState>;
}
export interface ExperimentResult {
  tone: 'success' | 'notice';
  title: string;
  steps: string[];
  explanation: string;
}
export type ExperimentAction = 'toggle-app' | 'add-database' | 'remove-database' | 'toggle-database' | 'send' | 'save' | 'restart' | 'read';

export function newLesson(id: LessonId): LessonState {
  return { appConnected: id === 'storage', databaseAdded: false, databaseConnected: false, draft: 'こんにちは！', memory: null, database: null, screen: null, restartSource: null, sawDelivered: false, sawBlocked: false, sawVolatileLoss: false, sawDurableRead: false, answer: '' };
}
export function newCourse(): CourseProgress {
  return { version: 2, current: 'request', lessons: { request: newLesson('request'), storage: newLesson('storage') }, labs: newLabs() };
}
export function courseLessonComplete(progress: CourseProgress, id: CourseLessonId): boolean {
  return isBasicLesson(id) ? lessonComplete(id, progress.lessons[id]) : labComplete(progress.labs[id]);
}
export function lessonComplete(id: LessonId, state: LessonState): boolean {
  return id === 'request'
    ? state.sawDelivered && state.sawBlocked && state.answer === 'process'
    : state.sawVolatileLoss && state.sawDurableRead && state.answer === 'separate';
}

// The lesson deliberately models one message, one process and one separate store.
// These transitions describe the authored exercise, not real infrastructure guarantees.
export function runExperiment(id: LessonId, previous: LessonState, action: ExperimentAction): { state: LessonState; result: ExperimentResult } {
  const state = { ...previous };
  const result = (tone: ExperimentResult['tone'], title: string, steps: string[], explanation: string) => ({ state, result: { tone, title, steps, explanation } });
  if (action === 'toggle-app') {
    state.appConnected = !state.appConnected;
    return result('notice', state.appConnected ? '要求を届ける経路ができました' : 'ブラウザとアプリを切り離しました', [], '送信して、画面に返ってくる結果を確かめましょう。');
  }
  if (id === 'request' && action !== 'send') return result('notice', 'この章では送信を試します', [], 'まずは要求と返事の役割を確かめましょう。');
  if (action === 'add-database') {
    state.databaseAdded = true;
    return result('notice', '保存する部品を追加しました', [], '部品を置くだけでは届きません。アプリとDBをつなぎ、メッセージを保存しましょう。');
  }
  if (action === 'remove-database') {
    state.databaseAdded = false;
    state.databaseConnected = false;
    state.database = null;
    state.screen = null;
    state.restartSource = null;
    return result('notice', 'DBを使わない構成に戻しました', [], '教材のDB内のメッセージも消去しました。次の保存先はアプリの一時記憶です。学習済みのチェックは残ります。');
  }
  if (action === 'toggle-database') {
    if (state.databaseAdded) state.databaseConnected = !state.databaseConnected;
    return result('notice', state.databaseConnected ? 'アプリとDBをつなぎました' : 'DBへの経路がありません', [], '切断してもDB内の記録は残ります。保存・読み出しを試して違いを確かめましょう。');
  }
  if (action === 'restart') {
    state.restartSource = state.databaseAdded && state.databaseConnected && state.database !== null ? 'database' : state.memory !== null ? 'memory' : state.restartSource;
    state.memory = null;
    state.screen = null;
    return result('notice', 'アプリを再起動しました', ['アプリを停止する', 'アプリの一時記憶が空になる', 'アプリを起動する'], '画面の表示も空にしました。「読み出す」で、保存先に記録があるか確かめましょう。DBは再起動していません。');
  }
  if ((action === 'send' || action === 'save') && !state.draft.trim()) {
    return result('notice', 'メッセージを入力してください', [], '「こんにちは」など、教材用の短い言葉で試しましょう。');
  }
  state.screen = null;
  if (!state.appConnected) {
    state.sawBlocked = true;
    return result('notice', '要求がアプリに届きませんでした', ['ブラウザから要求を出す', 'アプリへの経路がなく、ここで止まる'], 'ブラウザとアプリをつないで、もう一度試しましょう。部品があっても、経路がなければ処理を頼めません。');
  }
  if (id === 'request') {
    state.sawDelivered = true;
    state.screen = requestReply(state.draft);
    return result('success', 'アプリから返事が届きました', ['ブラウザ → アプリ：メッセージを届ける', 'アプリ：メッセージを受け取り、返事を作る', 'アプリ → ブラウザ：返事を表示する'], 'ブラウザは操作と表示、アプリは要求に応じた処理を担当します。線を外して、同じ操作を試してみましょう。');
  }
  if (state.databaseAdded && !state.databaseConnected) {
    return result('notice', 'DBに届かず、処理できませんでした', ['ブラウザ → アプリ：要求が届く', 'アプリ → DB：経路がなく、ここで止まる', 'アプリ → ブラウザ：処理できなかったことを知らせる'], 'この構成ではDBを保存先にしています。DBをつなぎ直すと、DBに残っている記録を読み出せます。');
  }
  const destination = state.databaseAdded ? 'database' : 'memory';
  const destinationName = destination === 'database' ? 'DB' : 'アプリの一時記憶';
  if (action === 'save') {
    state[destination] = state.draft.trim();
    state.screen = state[destination];
    state.restartSource = null;
    return result('success', `${destinationName}に保存しました`, ['ブラウザ → アプリ：保存を頼む', `アプリ：${destinationName}に記録する`, 'アプリ → ブラウザ：保存した内容を表示する'], '「アプリを再起動」してから「読み出す」を押し、同じ内容が戻るか確かめましょう。この教材では、保存のたびに1件の記録を置き換えます。');
  }
  state.screen = state[destination];
  if (destination === 'memory' && state.restartSource === 'memory' && state.memory === null) state.sawVolatileLoss = true;
  if (destination === 'database' && state.restartSource === 'database' && state.database !== null) state.sawDurableRead = true;
  return result(state.screen === null ? 'notice' : 'success', state.screen === null ? '読み出せる記録がありません' : '保存先から記録を読み出せました', ['ブラウザ → アプリ：記録を見せてと頼む', `アプリ：${destinationName}を調べる`, state.screen === null ? 'アプリ → ブラウザ：記録がないことを知らせる' : 'アプリ → ブラウザ：保存した内容を表示する'], destination === 'memory'
    ? 'このアプリの一時記憶は、アプリを再起動すると消えます。あとから読みたい情報は、別の保存先に残す必要があります。'
    : 'DBはアプリと別に記録を保持しています。ただし、DB自体の故障や誤削除に備えるには、バックアップなど別の設計が必要です。');
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('学習記録の形式が正しくありません');
  return value as Record<string, unknown>;
}
export function parseCourse(raw: string): CourseProgress {
  if (raw.length > 64000) throw new Error('学習記録が大きすぎます');
  const input = object(JSON.parse(raw));
  if ((input.version !== 1 && input.version !== 2) || !lessonIds.includes(input.current as CourseLessonId) || (input.version === 1 && !basicLessonIds.includes(input.current as LessonId))) throw new Error('未対応の学習記録です');
  const lessons = object(input.lessons);
  const course = newCourse();
  course.current = input.current as CourseLessonId;
  for (const id of basicLessonIds) {
    const source = object(lessons[id]);
    const target = course.lessons[id];
    for (const key of ['appConnected', 'databaseAdded', 'databaseConnected', 'sawDelivered', 'sawBlocked', 'sawVolatileLoss', 'sawDurableRead'] as const) {
      if (typeof source[key] !== 'boolean') throw new Error('学習記録の状態が正しくありません');
      target[key] = source[key];
    }
    for (const key of ['draft', 'memory', 'database', 'screen', 'answer'] as const) {
      const value = source[key];
      if (value === null && key !== 'draft' && key !== 'answer') { target[key] = null; continue; }
      if (typeof value !== 'string' || value.length > (key === 'screen' ? 100 : 60)) throw new Error('学習記録の文章が正しくありません');
      target[key] = value;
    }
    if (source.restartSource !== null && source.restartSource !== 'memory' && source.restartSource !== 'database') throw new Error('学習記録の保存先が正しくありません');
    target.restartSource = source.restartSource as LessonState['restartSource'];
    if (!target.databaseAdded) target.databaseConnected = false;
    if (id === 'request') { target.databaseAdded = false; target.databaseConnected = false; }
  }
  if (input.version === 2) {
    const labs = object(input.labs);
    for (const id of labIds) course.labs[id] = parseLab(id, labs[id]);
  }
  return course;
}

export function readCourse(): { progress: CourseProgress; error: string; started: boolean } {
  try {
    const raw = localStorage.getItem(COURSE_STORAGE_KEY) ?? localStorage.getItem(LEGACY_COURSE_STORAGE_KEY);
    return { progress: raw === null ? newCourse() : parseCourse(raw), error: '', started: raw !== null };
  } catch {
    return { progress: newCourse(), error: '前回の学習記録を読み込めませんでした。最初から学習できます。設計プロジェクトの保存データには影響しません。', started: false };
  }
}
