import { ThemeToggle } from './ThemeToggle';
import { useEffect, useRef, useState } from 'react';
import { BiArrowBack, BiBookOpen, BiCheck, BiChevronRight, BiLockAlt, BiNetworkChart, BiHelpCircle } from 'react-icons/bi';
import { HelpModal } from './HelpModal';
import { stageIds, componentStages } from '../constants/componentStages';
import type { StageId } from '../constants/componentStages';
import { courseLessonComplete } from '../utils/learningCourse';
import { labComplete } from '../utils/courseLabs';
import type { DesignLab } from '../utils/courseLabs';
import { STAGE_STORAGE_KEY, readStages, experienceComplete, stageUnlocked, graduate } from '../utils/componentStages';
import type { StageProgress } from '../utils/componentStages';
import type { ProjectSaveData } from '../types';
import { createCourseProject } from '../utils/courseProject';
import { StageStudio } from './StageStudio';
import { diagramReady } from '../utils/courseDiagram';
import type { DiagramKey } from '../utils/courseDiagram';
import './LearningCourse.css';

export function LearningCourse({ onHome, onDesign, onPractice }: { onHome: () => void; onDesign: () => void; onPractice: (project: ProjectSaveData) => void }) {
  const [initial] = useState(readStages);
  const [progress, setProgress] = useState(initial.progress);
  const [saveError, setSaveError] = useState(initial.error);
  const [showGuide, setShowGuide] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = progress.current, count = progress.cleared.length;
  useEffect(() => { heading.current?.focus(); }, [progress.view, id]);
  function update(next: StageProgress) {
    setProgress(next);
    try { localStorage.setItem(STAGE_STORAGE_KEY, JSON.stringify(next)); setSaveError(''); }
    catch { setSaveError('学習記録をブラウザに保存できません。今の画面では続けられます。閉じる前に保存を再試行してください。'); }
  }
  function choose(next: StageId | 'graduation', view: 'learn' | 'practice' = 'learn') {
    if (!stageUnlocked(progress, next)) return;
    if (view === 'practice' && (next === 'graduation' || !experienceComplete(progress, next))) return;
    update({ ...progress, current: next, view, learning: { ...progress.learning, current: next === 'balancer' ? courseLessonComplete(progress.learning, 'estimate') && diagramReady('estimate', progress.diagrams.estimate) ? 'balance' : 'estimate' : progress.learning.current } });
  }
  function next() { if (id === 'graduation' || !progress.cleared.includes(id)) return; choose(stageIds[stageIds.indexOf(id) + 1] ?? 'graduation'); }
  const course = progress.learning;
  let content;
  if (progress.view === 'map') content = <main>
    <div className="course-heading"><span className="course-eyebrow">基本8コンポーネント＋卒業課題</span><h1 ref={heading} tabIndex={-1}>学習マップ</h1><p>体験で役割を知り、練習で使い方を確かめます。ステージをクリアすると、次の部品へ進めます。</p></div>
    {progress.migrated && <div className="stage-migration"><p>以前の体験とクリア履歴を引き継ぎました。新しい図は、部品をつないで試してから練習へ進めます。</p><button className="course-text-button" onClick={() => update({ ...progress, migrated: false })}>確認しました</button></div>}
    {progress.graduated && <section className="course-completion stage-graduated" role="status"><BiCheck size={32} aria-hidden="true" /><h2>入門コース修了！</h2><p>基本8種類の役割と使い方を、体験・練習・卒業課題で確かめました。下の一覧からいつでも復習できます。</p>{diagramReady('graduation', progress.diagrams.graduation) && labComplete(course.labs.design) && course.labs.design.kind === 'design' && <button className="ui-button course-primary" onClick={() => onPractice(createCourseProject(course.labs.design as DesignLab, crypto.randomUUID(), new Date().toISOString(), progress.diagrams.graduation))}>この構成で自由設計へ</button>}<button className="course-text-button" onClick={onDesign}>別のテーマで設計する</button></section>}
    <section aria-label="コンポーネントの学習進捗"><ol className="stage-map">{stageIds.map((key, i) => {
      const stage = componentStages[key], cleared = progress.cleared.includes(key), open = stageUnlocked(progress, key), experienced = experienceComplete(progress, key);
      return <li key={key} className={`stage-card ${cleared ? 'is-cleared' : open ? 'is-current' : 'is-locked'}`}>
        <div className="stage-card-top"><span className="stage-number">{String(i + 1).padStart(2, '0')}</span><span className="stage-state">{cleared ? <><BiCheck aria-hidden="true" />クリア</> : open ? '取り組めます' : <><BiLockAlt aria-hidden="true" />未開放</>}</span></div>
        <h2>{stage.component}</h2><p className="stage-role">{stage.role}</p><p className="stage-outcome">{cleared ? '確認した使い方：' : 'ここで学ぶ使い方：'}{stage.outcome}</p>
        <div className="stage-milestones"><span>{experienced ? '✓' : '○'} 体験</span><span>{cleared ? '✓' : '○'} 練習問題</span></div>
        <small className="stage-unlock-condition">{!open ? `${componentStages[stageIds[i - 1]].component}をクリアすると開放` : cleared ? 'いつでも復習できます' : '体験と練習問題を終えるとクリア'}</small>
        <button className={`ui-button${open && !cleared ? ' course-primary' : ''}`} disabled={!open} aria-label={`${stage.component}の${cleared ? '復習' : '学習を始める'}`} onClick={() => choose(key, experienced && !cleared ? 'practice' : 'learn')}>{cleared ? '復習する' : experienced ? '練習から続ける' : '体験する'}<BiChevronRight aria-hidden="true" /></button>
      </li>;
    })}</ol></section>
    <button className="stage-final" disabled={!stageUnlocked(progress, 'graduation')} onClick={() => choose('graduation')}><span className="stage-final-content"><span className="course-eyebrow">学んだ部品を組み合わせる</span><strong>卒業課題：条件から設計を選ぶ</strong><span>2つの構成を試し、選んだ理由と残る課題を一言ずつまとめましょう。</span><span className="stage-final-action">{count < 8 ? `あと${8 - count}ステージで開放` : progress.graduated ? '卒業課題を見直す' : '卒業課題に挑戦する'}</span></span>{count < 8 ? <BiLockAlt aria-hidden="true" /> : <BiChevronRight aria-hidden="true" />}</button>
    <details className="course-boundaries"><summary>このコースで学ぶ範囲</summary><p>基本8種類の役割と基本的な使い方を、ブラウザ内の簡略モデルで学びます。API Gatewayでは利用制限を扱います。全32種類や実システムの運用を網羅するコースではありません。学んだことを別の題材で説明し、自由設計でも試してみましょう。</p></details>
  </main>;
  else {
    const studioKey: DiagramKey = id === 'graduation' ? 'graduation' : progress.view === 'practice' ? `${id}-practice` : id === 'balancer' && course.current === 'estimate' ? 'estimate' : `${id}-learn`;
    content = <div>{id === 'balancer' && progress.view === 'learn' && <nav className="stage-substeps" aria-label="負荷分散の体験"><button className="ui-button" onClick={() => update({ ...progress, learning: { ...course, current: 'estimate' } })}>必要な量を見積もる</button><button className="ui-button" disabled={!courseLessonComplete(course, 'estimate') || !diagramReady('estimate', progress.diagrams.estimate)} onClick={() => update({ ...progress, learning: { ...course, current: 'balance' } })}>負荷分散を試す</button></nav>}<StageStudio key={studioKey} progress={progress} studioKey={studioKey} onChange={update} onNext={next} onPracticeStart={() => choose(id, 'practice')} onEstimateDone={() => update({ ...progress, learning: { ...course, current: 'balance' } })} onGraduate={() => update(graduate(progress))} /></div>;
  }
  return <div className="course-screen"><header className="course-header"><button className="ui-button" onClick={onHome}><BiArrowBack aria-hidden="true" />ホーム</button><span className="course-brand"><BiBookOpen aria-hidden="true" />部品の役割から学ぶ</span><div className="course-header-actions"><ThemeToggle /><button className="ui-button" onClick={() => setShowGuide(true)}><BiHelpCircle aria-hidden="true" />操作ガイド</button><button className="ui-button" onClick={onDesign}><BiNetworkChart aria-hidden="true" />設計課題に進む</button></div></header><div className="course-shell">
    <div className="stage-progress-bar"><button className="ui-button" onClick={() => update({ ...progress, view: 'map' })}>学習マップ</button><div><span>{count} / 8 ステージクリア</span><progress aria-label="クリアしたステージ" value={count} max={8} /></div><span aria-label={progress.graduated ? '卒業課題も完了' : '到達目標：卒業'}>{progress.graduated ? '卒業しました 🎉' : '卒業 🎉'}</span></div>
    {saveError && <div className="course-save-error" role="alert"><p>{saveError}</p><button className="ui-button" onClick={() => update(progress)}>保存を再試行</button></div>}
    {progress.view !== 'map' && id !== 'graduation' && <nav className="stage-substeps" aria-label="ステージの進め方"><button className="ui-button" aria-current={progress.view === 'learn' ? 'step' : undefined} onClick={() => choose(id)}>1. 役割を体験</button><button className="ui-button" aria-current={progress.view === 'practice' ? 'step' : undefined} disabled={!experienceComplete(progress, id)} onClick={() => choose(id, 'practice')}>2. 練習で確かめる</button><span>{progress.cleared.includes(id) ? 'クリア済み・復習できます' : '練習をクリアすると次へ進めます'}</span></nav>}
    {content}<footer className="course-footer">{saveError ? '学習記録の保存を確認してください' : '体験・練習・クリア履歴はこのブラウザに保存されます'}</footer>
  </div>{showGuide && <HelpModal isOpen onClose={() => setShowGuide(false)} initialTopic="tutorial" />}</div>;
}
