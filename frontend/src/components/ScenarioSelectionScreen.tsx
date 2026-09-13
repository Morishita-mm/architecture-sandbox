import React, { useState, useEffect } from "react";
import { SCENARIOS } from "../scenarios";
import type { Scenario, ProjectSaveData } from "../types";
import { FaCog, FaLightbulb, FaGithub, FaFire } from "react-icons/fa";
import { BiFolderOpen, BiHelpCircle, BiRocket, BiGlobe } from "react-icons/bi";
import { loadProjectFromLocalFile } from "../utils/fileHandler";
import { HelpModal } from "./HelpModal";

import { parseChallenge } from "../utils/projectFormat";

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

interface ScenarioSelectionScreenProps {
  onSelectScenario: (scenario: Scenario) => void;
  onProjectLoad: (loadedData: ProjectSaveData) => void;
}

export const ScenarioSelectionScreen: React.FC<
  ScenarioSelectionScreenProps
> = ({ onSelectScenario, onProjectLoad }) => {
  const [loadError, setLoadError] = useState("");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
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
        <button className="ui-button" onClick={() => setIsHelpOpen(true)}>
          <BiHelpCircle size={18} /> 操作ガイド
        </button>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
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
                    <li>
                      <strong>難易度: </strong>
                      {
                        difficultyLabels[
                          pendingChallenge.difficulty || "medium"
                        ]
                      }
                    </li>
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
        <img className="welcome-icon" src="/icons/01-open-a.svg" alt="" width={64} height={64} />
        <h1>Architecture Sandbox</h1>
        <p className="welcome-description">AIパートナーと対話しながら、システムアーキテクチャを設計・評価しよう</p>
        <div className="welcome-load">
          <input type="file" accept=".json" onChange={handleFileChange} hidden id="file-load-input-welcome" />
          <button className="ui-button" onClick={() => document.getElementById('file-load-input-welcome')?.click()}>
            <BiFolderOpen size={19} /> 既存プロジェクトを読み込む
          </button>
        </div>
        <div className="scenario-grid">
          {SCENARIOS.map(scenario => (
            <button key={scenario.id} className={`scenario-card${scenario.isCustom ? ' scenario-card-custom' : ''}`} onClick={() => onSelectScenario(scenario)}>
              <div><h2>{scenario.title}</h2><p>{scenario.description}</p></div>
              <span className="scenario-action">
                {scenario.isCustom ? <><FaCog size={13} /> カスタム定義へ</> : <><FaLightbulb size={13} /> 設計を開始</>}
              </span>
            </button>
          ))}
        </div>
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
