import { useEffect, useRef, useState } from 'react';
import { BiCheck, BiChevronRight, BiPlay, BiReset, BiCheckCircle, BiXCircle } from 'react-icons/bi';
import { introScenario, storageRecord, updatedAnnouncement } from '../constants/courseScenarios';
import type { NodePresentation } from './nodePresentation';
import { componentStages } from '../constants/componentStages';
import type { StageId } from '../constants/componentStages';
import { basicLessons, labLessons } from '../constants/courseCurriculum';
import { experienceComplete, practiceChecks, submitPractice } from '../utils/componentStages';
import type { StageProgress, PracticeModel } from '../utils/componentStages';
import { courseLessonComplete } from '../utils/learningCourse';
import { labComplete, designObjectives, evaluateDesign } from '../utils/courseLabs';
import type { LabResult, DesignLab } from '../utils/courseLabs';
import { studioModel, setStudioModel, setStudioDiagram, runStudio, resetStudio, labIdFor } from '../utils/courseStudio';
import { diagramStage, diagramSignature, diagramReady } from '../utils/courseDiagram';
import type { DiagramKey } from '../utils/courseDiagram';
import { coursePlayback, type PlaybackStep } from '../utils/coursePlayback';
import { LearningCanvas } from './LearningCanvas';

const instructions: Record<string, string[]> = {
  browser: ['図のWeb Browserの下の丸から、教材の応答先の上の丸へつなぐ。', '図のブラウザの「会場を調べる」を押し、要求と返事の流れ、画面の変化を見る。', 'つないだ線を外して、もう一度調べる。返事が届くか比べてみる。'],
  app: ['つながっていない状態で要求を送り、どこで止まるかを見る。', 'ブラウザの出力とアプリの入力をつなぎ、もう一度送る。'],
  database: ['DBなしで保存→アプリ再起動→読み出しを試す。', 'DBを追加し、アプリからDBへつなぐ。', '同じ操作を行い、記録が戻るか比べる。'],
  estimate: ['ブラウザ→アプリ→DBの経路を確かめる。', '集中度1倍と10倍以上を見積もって比べる。'],
  balancer: ['アプリ1台で12件を流す。', '2台目とLoad Balancerを追加し、ブラウザ→入口→アプリA/B→DBにつなぎ直す。', '12件を流す。次はアプリAを選んで停止し、要求を6件にして流す。', '追加実験：Aを再開し、DBの上限を下げる。'],
  cache: ['キャッシュなしで読む。', 'キャッシュを追加し、アプリ→キャッシュをつなぐ。2回読む。', 'DBを更新してから読み、古いコピーを確認する。', 'コピーを無効化して、もう一度読む。'],
  queue: ['キューなしで通知を依頼する。', 'Message Queueを追加し、アプリからつないで依頼する。', '教材の通知担当を停止し、1件処理を試す。'],
  worker: ['Workerを追加し、キューからつなぐ。停止中に処理を試す。', 'Workerを選んで停止を解除し、1件処理する。', '同じ仕事を再配信して処理し、二重通知を見る。', '重複防止を有効にし、再配信と処理を繰り返す。'],
  gateway: ['入口の制限なしで要求を送る。', 'API Gatewayを追加し、ブラウザ→Gateway→アプリへつなぎ直す。迂回する線を外す。', '1秒進めて要求を送る。見送り分は時間を空けて再試行する。'],
  graduation: ['条件を選び、ブラウザからアプリ、DBまでの図を試す。', '学んだ部品を追加・接続して、別の構成と比較する。', '採用理由と残る課題を記録して、コースを修了する。'],
};
export function StageStudio({ progress, studioKey, onChange, onNext, onPracticeStart, onEstimateDone, onGraduate }: { progress: StageProgress; studioKey: DiagramKey; onChange: (p: StageProgress) => void; onNext: () => void; onPracticeStart: () => void; onEstimateDone: () => void; onGraduate: () => void }) {
  const id = diagramStage(studioKey), practice = studioKey.endsWith('practice'), model = studioModel(progress, studioKey), diagram = progress.diagrams[studioKey];
  const stage = id === 'estimate' || id === 'graduation' ? null : componentStages[id];
  const heading = useRef<HTMLHeadingElement>(null);
  const [run, setRun] = useState<{ result: LabResult; playback: PlaybackStep[]; signature: string; serial: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); }; media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const [traceStep, setTraceStep] = useState(0), [confirmReset, setConfirmReset] = useState(false), [canvasEpoch, setCanvasEpoch] = useState(0);
  useEffect(() => { heading.current?.focus(); }, []);
  const signature = diagramSignature(diagram), currentRun = run?.signature === signature ? run : null;
  useEffect(() => {
    if (!playing || !currentRun || reducedMotion) return;
    const timer = window.setTimeout(() => {
      if (traceStep < currentRun.playback.length - 1) setTraceStep(n => n + 1);
      else setPlaying(false);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [playing, currentRun, traceStep, reducedMotion]);
  const play = () => {
    if (!currentRun) return;
    if (traceStep === currentRun.playback.length - 1) { setTraceStep(0); setRun({ ...currentRun, serial: currentRun.serial + 1 }); }
    // With reduced motion, the same control advances one readable step at a time.
    else if (reducedMotion) setTraceStep(n => Math.min(n + 1, currentRun.playback.length - 1));
    setPlaying(!reducedMotion && !playing);
  };
  const lab = model.kind !== 'browser' && model.kind !== 'request' && model.kind !== 'storage' ? labLessons[labIdFor(studioKey)] : null;
  const basic = model.kind === 'request' || model.kind === 'storage' ? basicLessons[model.kind] : null;
  let question = practice || id === 'browser' ? stage! : basic ?? lab!;
  if (id === 'queue' && !practice) question = { ...question, question: 'キューで受付できた時点で、通知はどうなっていますか？', answers: [{ id: 'retry', label: 'Workerが処理するまで未完了の仕事として待機する' }, { id: 'guarantee', label: '受付と同時に通知も完了している' }], correct: 'retry', explanation: '受付は仕事を預かったという意味です。Workerの完了とは別に確認します。' };
  const answer = practice ? progress.attempts[id as StageId].answer : model.kind === 'browser' ? progress.browserAnswer : model.kind === 'request' || model.kind === 'storage' ? model.value.answer : model.answer;
  function change(next: PracticeModel, keepResult = false) {
    const p = setStudioModel(progress, studioKey, next);
    if (!keepResult) { p.diagrams = { ...p.diagrams, [studioKey]: { ...diagram, checked: null } }; setRun(null); }
    onChange(p);
  }
  function setAnswer(value: string) {
    if (practice) onChange({ ...progress, attempts: { ...progress.attempts, [id]: { ...progress.attempts[id as StageId], answer: value, submitted: false } } });
    else if (model.kind === 'browser') onChange({ ...progress, browserAnswer: value });
    else if (model.kind === 'request' || model.kind === 'storage') change({ ...model, value: { ...model.value, answer: value } }, true);
    else change({ ...model, answer: value }, true);
  }
  function act(action: string) {
    const r = runStudio(progress, studioKey, action);
    const playback = coursePlayback(diagram, id, action, r.inputModel, studioModel(r.progress, studioKey), r.trace, r.result.explanation);
    onChange(r.progress); setRun({ result: r.result, playback, signature, serial: (run?.serial ?? 0) + 1 }); setTraceStep(0); setPlaying(!reducedMotion && playback.length > 1);
  }
  const operation = (label: string, action: string, primary = false, disabled = false) => <button className={`ui-button${primary ? ' course-primary' : ''}`} disabled={disabled} onClick={() => act(action)}>{primary && <BiPlay aria-hidden="true" />}{label}</button>;
  const slider = (label: string, value: number, min: number, max: number, step: number, set: (n: number) => void) => <label>{label}：{value}<input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => set(Number(e.target.value))} /></label>;
  let controls;
  if (model.kind === 'storage') controls = <><p className="studio-fixed-content">保存する記録：<strong>{storageRecord(practice)}</strong></p><div className="lab-actions">{operation('記録を保存する', 'save', true)}{operation('アプリを再起動する', 'restart')}{operation('記録を読み出す', 'read')}</div><p>アプリの一時記憶：{model.value.memory ?? '空です'} ／ DB：{model.value.database ?? '空です'}</p><div className="course-preview" aria-label="ブラウザに表示する内容"><span>画面に返った内容</span><p>{model.value.screen ?? '表示する内容はありません'}</p></div></>;
  else if (model.kind === 'estimate') controls = <>{slider('1日に利用する人数', model.users, 1000, 100000, 1000, users => change({ ...model, users }))}{slider('1人が1日に行う要求', model.requestsPerDay, 1, 100, 1, requestsPerDay => change({ ...model, requestsPerDay }))}{slider('集中する時間の倍率', model.peakFactor, 1, 30, 1, peakFactor => change({ ...model, peakFactor }))}{operation('見積もる', 'run', true)}</>;
  else if (model.kind === 'balance') controls = <><p>アプリ1台は6件/秒。台数と振り分けは図から決まります。部品を選ぶと停止・再開できます。</p>{!practice && <>{slider('この1秒に送る要求', model.load, 6, 18, 6, load => change({ ...model, load }))}<label>DBが1秒に処理できる量<select value={model.dbCapacity} onChange={e => change({ ...model, dbCapacity: Number(e.target.value) })}><option value={20}>20件（余裕あり）</option><option value={8}>8件（詰まりを試す）</option></select></label></>}{practice && <p>条件：アプリAが停止、要求6件/秒、DBは20件/秒まで。</p>}{operation('1秒分の要求を流す', 'run', true)}</>;
  else if (model.kind === 'cache') controls = <><p>DB：{model.origin} ／ キャッシュ：{model.cached ?? 'コピーなし'}</p><div className="lab-actions">{operation(practice ? '会場を読む' : 'お知らせを読む', 'read', true)}{operation('コピーを無効化する', 'invalidate')}</div>{!practice && <><p className="studio-fixed-content">新しいお知らせ：<strong>{updatedAnnouncement}</strong></p>{operation('DBを更新する', 'write')}</>}<div className="course-preview" aria-label="表示したお知らせ"><span>画面に表示する内容</span><p>{model.displayed ?? 'まだ読んでいません'}</p></div><p>DB読み出し：{model.dbReads}回 ／ キャッシュヒット：{model.hits}回</p></>;
  else if (model.kind === 'queue') controls = <>{id === 'queue' ? <>{!practice && <label><input type="checkbox" checked={!model.workerRunning} onChange={e => change({ ...model, workerRunning: !e.target.checked })} />教材の通知担当を停止する</label>}<p>このステージの通知担当は教材側にあります。Workerは次のステージから配置します。</p><div className="lab-actions">{operation('通知を依頼する', 'submit', true)}{!practice && operation('1件処理する', 'work')}</div></> : <><p>図のWorkerを選び、停止を解除すると処理できます。</p><label><input type="checkbox" checked={model.deduplicate} onChange={e => change({ ...model, deduplicate: e.target.checked })} />処理済みIDで重複を防ぐ</label><div className="lab-actions">{operation('1件処理する', 'work', true)}{!practice && operation('同じ仕事を再配信する', 'replay')}</div></>}<div className="lab-queue" aria-label="待機中の仕事"><strong>待機中：{model.pending.length}件</strong><div>{model.pending.map((n, i) => <span key={i}>#{n}</span>)}</div><p>通知を実行した回数：{model.deliveries}回</p></div></>;
  else if (model.kind === 'rate') controls = <>{!practice && slider('まとめて送る要求', model.batch, 1, 10, 1, batch => change({ ...model, batch }))}<p>仮想時間：{model.time}秒 ／ トークン：{model.tokens}/3枚（1秒に2枚補充）</p><div className="lab-actions">{operation(practice ? '7件の要求を送る' : '要求をまとめて送る', 'run', true, practice && progress.attempts.gateway.started)}{operation('仮想時間を1秒進める', 'advance')}{operation('見送り分を再試行する', 'retry')}</div><p>利用者側で再試行待ち：{model.retryWaiting}件{practice && ` ／ 処理完了：${progress.attempts.gateway.delivered}/7件`}</p>{practice && progress.attempts.gateway.started && progress.attempts.gateway.delivered < 7 && model.retryWaiting === 0 && <p>処理先であふれた要求があります。練習を最初に戻し、Gatewayを通る経路にしてから送ってください。</p>}</>;
  else if (model.kind === 'design') controls = <><label>今回満たしたい条件<select value={model.objective} onChange={e => change({ ...model, objective: e.target.value as DesignLab['objective'] })}>{Object.entries(designObjectives).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><p>図の接続から振り分け・キャッシュ・キュー・利用制限の使用を判断します。部品の数を増やすだけでは条件を満たしません。</p>{operation('この構成を確かめる', 'run', true)}<label>この構成を選ぶ理由<textarea value={model.reason} maxLength={500} rows={3} onChange={e => change({ ...model, reason: e.target.value }, true)} /></label><label>残る課題・引き受ける負担<textarea value={model.tradeoff} maxLength={500} rows={3} onChange={e => change({ ...model, tradeoff: e.target.value }, true)} /></label><p>記述は自分の学習メモです。意味や正しさの自動採点は行いません。</p></>;
  const scenario = id === 'browser' || id === 'app' ? introScenario(id, practice) : null;
  const storedScreen = model.kind === 'browser' ? model.displayed : model.kind === 'request' ? model.value.screen : null;
  const lastStep = currentRun?.playback.at(-1);
  const atEnd = currentRun && traceStep === currentRun.playback.length - 1;
  const screenState: NonNullable<NodePresentation['screen']>['state'] = currentRun
    ? !atEnd ? 'waiting' : lastStep?.kind === 'notice' ? 'blocked' : storedScreen ? 'success' : 'idle'
    : storedScreen && diagramReady(id, diagram) ? 'success' : 'idle';
  const nodePresentation = scenario ? { 'browser-1': {
    action: { label: scenario.action, onClick: () => act('send') },
    screen: { state: screenState, text: screenState === 'success' ? storedScreen! : screenState === 'waiting' ? '返事を待っています…' : screenState === 'blocked' ? '返事が届きませんでした' : 'ボタンを押して調べよう' },
  } } : undefined;
  let checks: { label: string; done: boolean }[];
  if (practice) checks = [...practiceChecks(id as StageId, progress.attempts[id as StageId]), { label: '部品をつなぎ、今の図で実験を終える', done: diagramReady(id, diagram) }];
  else if (model.kind === 'browser') checks = [{ label: '会場を調べ、ブラウザに返事が表示される', done: !!model.displayed }, { label: '部品をつなぎ、今の図で実験を終える', done: diagramReady(id, diagram) }];
  else if (model.kind === 'request' || model.kind === 'storage') checks = model.kind === 'request' ? [{ label: '接続なしで止まる様子を見る', done: model.value.sawBlocked }, { label: '接続して返事を受け取る', done: model.value.sawDelivered }] : [{ label: '一時記憶が再起動で消えることを見る', done: model.value.sawVolatileLoss }, { label: 'DBから再起動後に読み出す', done: model.value.sawDurableRead }];
  else checks = lab!.checks.filter(c => id !== 'queue' && id !== 'worker' || (id === 'queue' ? ['sync', 'queued', 'paused'] : ['paused', 'duplicate', 'deduplicated']).includes(c.id)).map(c => ({ label: c.label, done: model.observed.includes(c.id) }));
  if (!practice && model.kind !== 'browser') checks.push({ label: '部品をつなぎ、今の図で実験を終える', done: diagramReady(id, diagram) });
  if (model.kind === 'design') checks.push(
    { label: '最後に試した構成で、選んだ条件を満たす', done: Boolean(model.last?.meets && model.last.signature === evaluateDesign(model).signature) },
    { label: 'この構成を選ぶ理由を一言書く', done: Boolean(model.reason.trim()) },
    { label: '残る課題・引き受ける負担を一言書く', done: Boolean(model.tradeoff.trim()) },
  );
  const experimentDone = checks.every(c => c.done);
  const clearChecks = [...checks, { label: '実験の下にある確認問題に正解する', done: answer === question.correct }];
  const complete = practice ? checks.every(c => c.done) && answer === question.correct : id === 'estimate' ? courseLessonComplete(progress.learning, 'estimate') && diagramReady(id, diagram) : id === 'graduation' ? model.kind === 'design' && labComplete(model) && diagramReady(id, diagram) : experienceComplete(progress, id);
  const submitted = practice && progress.attempts[id as StageId].submitted;
  return <main className="stage-studio"><div className="course-heading"><span className="course-eyebrow">{practice ? '学んだ部品で設計する · 練習問題' : id === 'graduation' ? '学びを組み合わせる' : '部品をつないで、動きを比べる · 体験'}</span><h1 ref={heading} tabIndex={-1}>{id === 'estimate' ? '準備：必要な量を見積もる' : id === 'graduation' ? '卒業課題：条件から設計を選ぶ' : stage!.component}</h1><p>{practice ? stage!.task : id === 'browser' ? '利用者が操作する窓口です。教材の応答先につなぎ、要求と返事を確かめます。' : id === 'worker' ? 'キューから仕事を取り出す担当です。自分で接続し、停止と再開、重複した仕事を比べます。' : basic?.introduction ?? lab?.introduction}</p></div>

    <section className="course-mission studio-mission" aria-labelledby="studio-goal">
      <div className="studio-mission-heading"><h2 id="studio-goal">{practice ? 'この練習のクリア条件' : id === 'graduation' ? '卒業までにすること' : 'この体験で確かめること'}</h2><span role="status">{clearChecks.filter(c => c.done).length} / {clearChecks.length} 完了</span></div>
      <p>{practice ? '下の条件を満たして、確認問題の「練習の結果を確認する」を押すとクリアです。' : id === 'graduation' ? 'すべて終えたら「コースを修了する」を押して卒業です。' : '動きの違いを試し、確認問題に正解すると練習へ進めます。'}</p>
      <ul className="course-checks">{clearChecks.map(c => <li key={c.label} className={c.done ? 'is-done' : ''}><span aria-hidden="true">{c.done ? <BiCheck /> : '○'}</span><span><span className="course-sr-only">{c.done ? '確認済み：' : '未確認：'}</span>{c.label}</span></li>)}</ul>
      <nav className="studio-step-links" aria-label="取り組む順番"><a href="#studio-diagram">1. 部品をつなぐ</a><BiChevronRight aria-hidden="true" /><a href="#studio-experiment">2. 動きを試す</a><BiChevronRight aria-hidden="true" /><a href="#studio-question">3. 確認問題</a></nav>
    </section>
    <div className="studio-layout"><div className="studio-workspace">
      <h2 className="studio-section-title" id="studio-diagram" tabIndex={-1}>1. 部品を配置してつなぐ</h2>
      <LearningCanvas key={`${studioKey}-${canvasEpoch}`} stage={id} practice={practice} diagram={diagram} onChange={g => { onChange(setStudioDiagram(progress, studioKey, g)); if (diagramSignature(g) !== signature) { setRun(null); setTraceStep(0); setPlaying(false); } }} playback={currentRun?.playback} traceStep={traceStep} onTraceStep={step => { setTraceStep(step); setPlaying(false); }} playing={playing} reducedMotion={reducedMotion} onPlay={play} runId={run?.serial} simulatedStop={model.kind === 'design' && model.objective === 'continuity'} nodePresentation={nodePresentation} experiment={scenario ? undefined :
        <section className="studio-controls" aria-label="図で動きを試す"><h2 id="studio-experiment" tabIndex={-1}>2. 操作して、図で確かめる</h2><div className="lab-controls">{controls}</div>{currentRun && <a className="studio-show-flow" href="#studio-flow">要求と返事を図で見る ↑</a>}
          {(currentRun || run || diagram.checked && diagram.checked !== signature) && <section className={`course-result course-result-${currentRun?.result.tone ?? 'notice'}`} aria-live="polite" aria-atomic="true"><h2>{currentRun?.result.title ?? '図が変わりました。もう一度試しましょう。'}</h2>{currentRun && <>{currentRun.result.metrics.length > 0 && <div className="lab-metrics">{currentRun.result.metrics.map(m => <div key={m.label}><span>{m.label}</span><strong>{m.value}</strong></div>)}</div>}<p>{currentRun.result.explanation}</p>{currentRun.result.comparison && <p className="lab-comparison">{currentRun.result.comparison}</p>}</>}</section>}
        </section>
      } />
    <form className="course-reflection" onSubmit={e => { e.preventDefault(); if (practice) onChange(submitPractice(progress, id as StageId)); }}><h2 id="studio-question" tabIndex={-1}>3. 確認問題に答える</h2><p className="studio-question-intro">{experimentDone ? '実験の条件を満たしました。結果を見ながら、部品の役割を選びましょう。' : '実験のあとに、部品の役割を選びましょう。この問題への正解もクリア条件です。'}</p><fieldset><legend>{question.question}</legend>{question.answers.map(a => <label key={a.id} className={answer === a.id ? !practice || submitted ? answer === question.correct ? 'answer-correct' : 'answer-incorrect' : 'is-selected' : ''}><input type="radio" name={`studio-answer-${studioKey}`} checked={answer === a.id} onChange={() => setAnswer(a.id)} /><span>{a.label}</span>{answer === a.id && (!practice || submitted) && (answer === question.correct ? <BiCheckCircle aria-hidden="true" /> : <BiXCircle aria-hidden="true" />)}</label>)}</fieldset>{practice && <button className="ui-button course-primary" type="submit">練習の結果を確認する</button>}
      {(practice ? submitted : !!answer) && <div className={`answer-feedback ${answer === question.correct ? 'is-correct' : 'is-incorrect'}`} role="status" aria-live="polite" aria-atomic="true">{answer === question.correct ? <BiCheckCircle aria-hidden="true" /> : <BiXCircle aria-hidden="true" />}<div><strong>{!answer ? '回答を選んでください' : answer === question.correct ? '正解！' : '不正解 — もう一度考えてみよう'}</strong><p>{!answer ? '部品の役割に合うものを1つ選び、「練習の結果を確認する」を押してください。' : answer === question.correct ? question.explanation : '選んだ答えと、図の中でその部品が担当した動きを見比べてみましょう。別の答えを選んで、何度でも確かめられます。'}</p>{answer === question.correct && !experimentDone && <p>確認問題は正解です。クリアするには、上に残っている実験の条件も試しましょう。</p>}</div></div>}
    </form>
    {practice ? submitted && <section className={complete ? 'course-completion' : 'stage-feedback'} role="status"><h2>{complete ? 'ステージクリア！' : 'まだ確かめたいことがあります'}</h2><p>{complete ? stage!.explanation : checks.some(c => !c.done) ? `残っている条件：${checks.filter(c => !c.done).map(c => c.label).join('、')}。`  : '操作はできています。結果と理由の回答を見比べてみましょう。'}</p>{complete && <button className="ui-button course-primary" onClick={onNext}>次のステージへ<BiChevronRight aria-hidden="true" /></button>}</section> : complete ? <section className="course-completion"><BiCheck aria-hidden="true" /><h2>{id === 'graduation' ? '構成と理由を確かめました' : '体験で役割を確かめました'}</h2><button className="ui-button course-primary" onClick={id === 'graduation' ? onGraduate : id === 'estimate' ? onEstimateDone : onPracticeStart}>{id === 'graduation' ? 'コースを修了する' : id === 'estimate' ? 'Load Balancerの体験へ' : '練習問題へ'}<BiChevronRight aria-hidden="true" /></button></section> : <p className="course-completion-hint">チェックがすべて付くと、次へ進むボタンが表示されます。</p>}
      <details className="studio-reference"><summary>仕組み・言葉の意味・この教材の範囲</summary><p>{id === 'queue' ? 'キューは未完了の仕事を預かります。このステージの通知担当は教材側で動かし、Workerの配置と重複処理は次のステージで扱います。' : lab?.mechanism ?? (id === 'browser' ? 'ブラウザは要求を送り、相手から受け取った返事を利用者に表示します。応答先は教材側の固定した相手で、App Serverの設計は次のステージで学びます。' : basic?.explanation)}</p>{lab && <><p>{lab.tradeoff}</p><dl>{(id === 'queue' ? lab.terms.slice(0, 2) : lab.terms).map(([word, meaning]) => <div key={word}><dt>{word}</dt><dd>{meaning}</dd></div>)}</dl><p>{lab.limits}</p></>}<p>図の矢印と教材の仮定で、要求・保存・処理を再現します。実際のサーバーやAIには接続しません。アプリは負荷分散以降2台、ほかは1個ずつの入門モデルです。負荷分散を通らないアプリへの複数経路は、名前順の1台だけへ送ります。入口やDBの故障、通信遅延は扱いません。</p></details>

    </div><aside className="course-guide studio-guide" aria-label="操作のヒント">
      <details className="lab-instructions studio-instructions"><summary>{practice ? '困ったときのヒント' : '試す順番'}</summary><ol>{(practice ? [stage!.hint, '部品を配置して線をつなぎ、図と同じ枠にある操作ボタンで試します。'] : instructions[id]).map(step => <li key={step}>{step}</li>)}</ol></details>
    <div className="course-reset">{confirmReset ? <><p>この{practice ? '練習' : '体験'}の図・操作・回答を最初に戻します。クリア履歴と他のステージは残ります。</p><div><button className="ui-button" onClick={() => setConfirmReset(false)}>キャンセル</button><button className="ui-button" onClick={() => { onChange(resetStudio(progress, studioKey)); setRun(null); setConfirmReset(false); setCanvasEpoch(n => n + 1); }}>図と実験を最初に戻す</button></div></> : <button className="course-text-button" onClick={() => setConfirmReset(true)}><BiReset aria-hidden="true" />{practice ? '練習をやり直す' : '体験をやり直す'}</button>}</div>

    </aside></div>
  </main>;
}
