import React, { useState, useEffect, useRef } from "react";
import { SCENARIOS } from "../scenarios";
import type { Scenario, ProjectSaveData } from "../types";
import { FaCog, FaLightbulb, FaGithub, FaFire } from "react-icons/fa";
import { BiFolderOpen, BiHelpCircle, BiRocket, BiGlobe, BiDownload, BiBookOpen, BiNetworkChart, BiChevronRight, BiArrowBack } from "react-icons/bi";
import { loadProjectFromLocalFile, saveProjectToLocalFile } from "../utils/fileHandler";
import { HelpModal } from "./HelpModal";

import { parseChallenge } from "../utils/projectFormat";
import { readDrafts, deleteDraft, type LocalDraft } from '../utils/draftStore';
import { evaluationKey } from '../utils/designSnapshot';
import { readStages } from '../utils/componentStages';

import qiitaIcon from "../assets/qiita-icon.png";

const difficultyLabels: Record<string, string> = {
  small: "★☆☆ 小規模",
  medium: "★★☆ 中規模",
  large: "★★★ 大規模",
};

const roleLabels: Record<string, string> = {
  ceo: "非技術系CEO (夢を語る)",
  cto: "技術責任者 CTO (品質重視)",
  cfo: "財務担当 CFO (コスト重視)",
};

const familyLabels: Record<string, string> = {
  business: '社内業務', content: 'コンテンツ', realtime: 'リアルタイム', transaction: '取引・予約',
};

interface ScenarioSelectionScreenProps {
  onSelectScenario: (scenario: Scenario) => void;
  onProjectLoad: (loadedData: ProjectSaveData, evaluationKey?: string | null) => void;
  onStartLearning: () => void;
  choosingTheme: boolean;
  onChooseTheme: () => void;
  onHome: () => void;
}

export const ScenarioSelectionScreen: React.FC<
  ScenarioSelectionScreenProps
> = ({ onSelectScenario, onProjectLoad, onStartLearning, choosingTheme, onChooseTheme, onHome }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const [course] = useState(readStages);
  const finishedLessons = course.progress.cleared.length;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [choosingTheme]);
  const [loadError, setLoadError] = useState("");
  const [helpTopic, setHelpTopic] = useState<'index' | 'learning' | null>(null);
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [draftError, setDraftError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draftExport, setDraftExport] = useState<{ id: string; message: string; error: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    readDrafts().then(({ drafts, unreadable }) => {
      if (active) {
        setDrafts(drafts);
        if (unreadable) setDraftError(`${unreadable}件の保存データを読み込めませんでした。保存したJSONファイルからも再開できます。`);
      }
    }).catch(() => { if (active) setDraftError('このブラウザの保存データを読み込めませんでした。保存したJSONファイルからも再開できます。'); });
    return () => { active = false; };
  }, []);
  const removeDraft = async (id: string) => {
    try {
      await deleteDraft(id);
      setDrafts(items => items.filter(item => item.project.projectId !== id));
      setDeletingId(null);
    } catch { setDraftError('保存データを削除できませんでした。もう一度お試しください。'); }
  };
  const exportDraft = (draft: LocalDraft) => {
    const { project } = draft;
    try {
      // Apply the same evaluation policy as the editor's project export.
      const current = draft.evaluationKey === evaluationKey(project.scenario, project.diagram);
      saveProjectToLocalFile({ ...project, evaluation: current ? project.evaluation : null }, `${project.scenario.title.trim() || 'untitled'}_v${project.version}.json`);
      setDraftExport({ id: project.projectId, error: false, message: `JSONのダウンロードを開始しました。「既存プロジェクトを読み込む」から再開できます。${project.evaluation && !current ? '変更前・対応未確認の評価は含めていません。' : ''}` });
    } catch {
      setDraftExport({ id: project.projectId, error: true, message: 'JSONファイルを保存できませんでした。もう一度お試しください。ブラウザの作業は残っています。' });
    }
  };
  const [pendingChallenge, setPendingChallenge] = useState<Scenario | null>(
    null
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const challengeData = params.get("challenge");

    if (challengeData) {
      try {
        setPendingChallenge(parseChallenge(challengeData));
        window.history.replaceState({}, "", window.location.pathname);
      } catch (error) {
        console.error("Failed to parse challenge data:", error);
      }
    }
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await loadProjectFromLocalFile(file);
      onProjectLoad(data);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "ファイルの読み込みに失敗しました。"
      );
    } finally {
      event.target.value = ""; // リセット
    }
  };

  const challengeOverlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3000,
    backdropFilter: "blur(4px)",
  };

  const challengeModalStyle: React.CSSProperties = {
    backgroundColor: "white",
    width: "90%",
    maxWidth: "500px",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    animation: "popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  };

  const challengeHeaderStyle: React.CSSProperties = {
    backgroundColor: "#FFCCBC",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderBottom: "1px solid #FFAB91",
  };

  const challengeInfoStyle: React.CSSProperties = {
    backgroundColor: "var(--app-subtle)",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid var(--app-border)",
    marginTop: "10px",
  };

  const challengeFooterStyle: React.CSSProperties = {
    padding: "15px 20px",
    backgroundColor: "var(--app-subtle)",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    borderTop: "1px solid var(--app-border)",
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: "10px 20px",
    border: "1px solid var(--app-border)",
    borderRadius: "6px",
    backgroundColor: "white",
    cursor: "pointer",
    fontWeight: "bold",
    color: "var(--app-muted)",
  };

  const startChallengeButtonStyle: React.CSSProperties = {
    padding: "10px 25px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#FF5722",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 2px 5px rgba(255, 87, 34, 0.4)",
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-tools">
        {choosingTheme && <button className="ui-button welcome-home" onClick={onHome}><BiArrowBack aria-hidden="true" />ホーム</button>}
        <button className="ui-button" onClick={() => setHelpTopic('index')}>
          <BiHelpCircle size={18} /> 操作ガイド
        </button>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {helpTopic && <HelpModal isOpen initialTopic={helpTopic === 'learning' ? 'learning' : undefined} onClose={() => setHelpTopic(null)} />}
      {/* 挑戦状受け取りモーダル */}
      {pendingChallenge && (
        <div style={challengeOverlayStyle}>
          <div style={challengeModalStyle}>
            <div style={challengeHeaderStyle}>
              <FaFire size={24} color="#FF5722" />
              <h2 style={{ margin: 0, color: "#BF360C" }}>
                設計チャレンジが届きました！
              </h2>
            </div>
            <div style={{ padding: "20px", textAlign: "left" }}>
              <p style={{ color: "var(--app-muted)", marginBottom: "15px" }}>
                以下の設定でアーキテクチャ設計を開始しますか？
              </p>
              <div style={challengeInfoStyle}>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "18px" }}>
                  {pendingChallenge.title}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--app-muted)", margin: 0 }}>
                  {pendingChallenge.description}
                </p>

                <div
                  style={{
                    marginTop: "15px",
                    fontSize: "13px",
                    color: "var(--app-text)",
                  }}
                >
                  <strong>シナリオ設定:</strong>
                  <ul style={{ paddingLeft: "20px", margin: "5px 0" }}>
                    {pendingChallenge.customMode === 'self_defined' ? <li><strong>進め方: </strong>自分で仕様を決める</li> : <>
                      {pendingChallenge.scenarioFamily && <li><strong>サービスの型: </strong>{familyLabels[pendingChallenge.scenarioFamily]}</li>}
                      <li><strong>課題の複雑さ: </strong>{difficultyLabels[pendingChallenge.difficulty || "medium"]}</li>
                    </>}
                    <li>
                      <strong>相手役: </strong>
                      {roleLabels[pendingChallenge.partnerRole || "ceo"]}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div style={challengeFooterStyle}>
              <button
                onClick={() => setPendingChallenge(null)}
                style={cancelButtonStyle}
              >
                キャンセル
              </button>
              <button
                onClick={() => onSelectScenario(pendingChallenge)}
                style={startChallengeButtonStyle}
              >
                <BiRocket size={18} /> 挑戦を受ける
              </button>
            </div>
          </div>
        </div>
      )}


      <main className="welcome-content">
        {!choosingTheme ? <>
        <img className="welcome-icon" src="/icons/01-open-a.svg" alt="" width={64} height={64} />
        <h1 ref={heading} tabIndex={-1}>Architecture Sandbox</h1>
        <p className="welcome-description">つないで、試して、仕組みがわかる。<br />部品の役割を体験するところから、自分で考えるシステム設計へ。</p>
        <div className="welcome-paths" aria-label="始め方を選ぶ">
          <button className="welcome-path welcome-path-learning" onClick={onStartLearning}>
            <BiBookOpen className="welcome-path-icon" aria-hidden="true" />
            <span className="welcome-path-kicker">仕組みを知りたい方へ</span><strong>部品の役割から学ぶ</strong>
            <span>1種類ずつ、体験と練習で使い方を確認。クリアして次の部品へ進みます。</span>
            <span className="welcome-path-action">{course.started ? `学習を再開 · ${finishedLessons} / 8ステージクリア` : '8ステージの学習を始める'}<BiChevronRight aria-hidden="true" /></span>
          </button>
          <button className="welcome-path" onClick={onChooseTheme}>
            <BiNetworkChart className="welcome-path-icon" aria-hidden="true" />
            <span className="welcome-path-kicker">自分で構成を考えたい方へ</span><strong>設計課題に取り組む</strong>
            <span>題材を選び、自由に設計。すべての部品を使って、要件と構成を考えられます。</span>
            <span className="welcome-path-action">課題を選ぶ<BiChevronRight aria-hidden="true" /></span>
          </button>
        </div>
        </> : <div className="theme-selection-heading"><BiNetworkChart aria-hidden="true" /><p className="welcome-path-kicker">設計課題</p><h1 ref={heading} tabIndex={-1}>設計するテーマを選ぶ</h1><p>題材を選んで、要件を聞き、自由に部品を組み合わせてみましょう。</p></div>}
        <div className="welcome-load">
          <button className="ui-button" onClick={() => setHelpTopic('learning')}><FaLightbulb size={16} /> 設計のヒント</button>
          <input type="file" accept=".json" onChange={handleFileChange} hidden id="file-load-input-welcome" />
          <button className="ui-button" onClick={() => document.getElementById('file-load-input-welcome')?.click()}>
            <BiFolderOpen size={19} /> 既存プロジェクトを読み込む
          </button>
        </div>
        {choosingTheme && <div className="scenario-grid">
          {SCENARIOS.map(scenario => (
            <button key={scenario.id} className={`scenario-card${scenario.isCustom ? ' scenario-card-custom' : ''}`} onClick={() => onSelectScenario(scenario)}>
              <div><h2>{scenario.title}</h2><p>{scenario.description}</p></div>
              <span className="scenario-action">
                {scenario.isCustom ? <><FaCog size={13} /> 進め方を選ぶ</> : <><FaLightbulb size={13} /> 設計を開始</>}
              </span>
            </button>
          ))}
        </div>
        }
        {draftError && <p role="alert">{draftError}</p>}
        {drafts.length > 0 && <section className="local-drafts" aria-labelledby="drafts-title">
          <h2 id="drafts-title">このブラウザの作業を再開</h2>
          <p>送信済みの会話・要件メモ・構成図をこのブラウザに保存しています。共有端末では他の利用者も開けます。ブラウザのデータ削除に備え、JSONファイルにも保存してください。</p>
          <ul>{drafts.map(draft => <li key={draft.project.projectId}><button className="ui-button" onClick={() => onProjectLoad(draft.project, draft.evaluationKey)}>
            {draft.project.scenario.title}を再開 <small>{new Date(draft.project.timestamp).toLocaleString('ja-JP')}</small>
          </button>
            {deletingId === draft.project.projectId ? <div className="draft-delete-confirm">
              <p>このブラウザの作業を削除します。元に戻せません。続きから再開したい場合は、JSONファイルを保存し、ダウンロードを確認してから削除してください。</p>
              <div className="draft-confirm-actions">
                <button className="ui-button draft-export-button" onClick={() => exportDraft(draft)}><BiDownload size={18} aria-hidden="true" />JSONファイルを保存</button>
                <button className="ui-button" onClick={() => setDeletingId(null)}>キャンセル</button>
                <button className="ui-button draft-delete-button" onClick={() => void removeDraft(draft.project.projectId)}>ブラウザから削除する</button>
              </div>
              {draftExport?.id === draft.project.projectId && <p role={draftExport.error ? 'alert' : 'status'} className={draftExport.error ? 'draft-export-error' : undefined}>{draftExport.message}</p>}
            </div> : <button className="ui-button" aria-label={`${draft.project.scenario.title}の保存データを削除`} onClick={() => { setDeletingId(draft.project.projectId); setDraftExport(null); }}>削除</button>}
          </li>)}</ul>
        </section>}
      </main>
      <footer className="welcome-footer">
        <div>
          <a href="https://morimizu.dev/" target="_blank" rel="noopener noreferrer"><BiGlobe size={18} /> morimizu.dev</a>
          <a href="https://github.com/Morishita-mm/architecture-sandbox.git" target="_blank" rel="noopener noreferrer"><FaGithub size={18} /> Repository</a>
          <a href="https://qiita.com/gorilla_tech/items/af5cb63424ddd54ee585" target="_blank" rel="noopener noreferrer"><img src={qiitaIcon} alt="Qiita" width={18} height={18} /> Qiita Article</a>
        </div>
        <small>© 2025 Architecture Sandbox</small>
      </footer>
    </div>
  );
};
