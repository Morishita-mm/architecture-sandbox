import React, { useState, useEffect } from "react";
import { SCENARIOS } from "../scenarios";
import type { Scenario, ProjectSaveData } from "../types";
import { FaCog, FaLightbulb, FaGithub, FaFire } from "react-icons/fa";
import { BiFolderOpen, BiHelpCircle, BiRocket } from "react-icons/bi";
import { loadProjectFromLocalFile } from "../utils/fileHandler";
import { HelpModal } from "./HelpModal";

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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState<Scenario | null>(
    null
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const challengeData = params.get("challenge");

    if (challengeData) {
      try {
        // スペースを+に戻す（フェイルセーフ）
        const fixedBase64 = challengeData.replace(/ /g, "+");

        const jsonString = decodeURIComponent(escape(atob(fixedBase64)));
        const scenario = JSON.parse(jsonString);

        if (scenario && scenario.title && scenario.requirements) {
          setPendingChallenge(scenario);
          window.history.replaceState({}, "", window.location.pathname);
        }
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
      alert(
        error instanceof Error
          ? error.message
          : "ファイルの読み込みに失敗しました。"
      );
    } finally {
      event.target.value = ""; // リセット
    }
  };

  // --- レイアウト ---
  // (既存のスタイル定義は変更なし。そのまま使用してください)
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minHeight: "100vh",
    padding: "20px",
    backgroundColor: "#f4f7f9",
    position: "relative",
    boxSizing: "border-box",
  };

  const headerBarStyle: React.CSSProperties = {
    position: "absolute",
    top: "20px",
    right: "30px",
    display: "flex",
    gap: "15px",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "white",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "20px",
    width: "300px",
    cursor: "pointer",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const footerStyle: React.CSSProperties = {
    marginTop: "auto",
    paddingTop: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    color: "#666",
    fontSize: "14px",
  };

  const linkGroupStyle: React.CSSProperties = {
    display: "flex",
    gap: "20px",
  };

  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#555",
    textDecoration: "none",
    padding: "8px 16px",
    borderRadius: "20px",
    backgroundColor: "white",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    transition: "all 0.2s",
    border: "1px solid #eee",
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
    backgroundColor: "#f9f9f9",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #eee",
    marginTop: "10px",
  };

  const challengeFooterStyle: React.CSSProperties = {
    padding: "15px 20px",
    backgroundColor: "#f5f5f5",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    borderTop: "1px solid #eee",
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: "10px 20px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    backgroundColor: "white",
    cursor: "pointer",
    fontWeight: "bold",
    color: "#666",
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

  // アニメーション用Styleタグ
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
  @keyframes popIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  `;
  if (!document.getElementById("challenge-modal-style")) {
    styleSheet.id = "challenge-modal-style";
    document.head.appendChild(styleSheet);
  }

  return (
    <div style={containerStyle}>
      <div style={headerBarStyle}>
        <button
          onClick={() => setIsHelpOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "20px",
            border: "none",
            backgroundColor: "white",
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            cursor: "pointer",
            color: "#555",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          <BiHelpCircle size={20} color="#2196F3" /> 操作ガイド
        </button>
      </div>

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
              <p style={{ color: "#555", marginBottom: "15px" }}>
                以下の設定でアーキテクチャ設計を開始しますか？
              </p>
              <div style={challengeInfoStyle}>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "18px" }}>
                  {pendingChallenge.title}
                </h3>
                <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                  {pendingChallenge.description}
                </p>

                <div
                  style={{
                    marginTop: "15px",
                    fontSize: "13px",
                    color: "#444",
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

      {/* メインコンテンツ */}
      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <h1
          style={{
            marginBottom: "10px",
            fontSize: "3.5em",
            color: "#24292e",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            letterSpacing: "-1px",
            textShadow: "2px 2px 0px rgba(0,0,0,0.1)",
          }}
        >
          Architecture Sandbox
        </h1>
        <p style={{ color: "#666", marginBottom: "30px", fontSize: "1.1em" }}>
          AIパートナーと対話しながら、システムアーキテクチャを設計・評価しよう
        </p>

        {/* ファイル読み込みボタン */}
        <div
          style={{
            marginBottom: "40px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="file-load-input-welcome"
          />
          <label
            htmlFor="file-load-input-welcome"
            style={{
              padding: "12px 25px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#6c757d",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
            }}
          >
            <BiFolderOpen size={20} /> 既存プロジェクトを読み込む
          </label>
        </div>

        {/* シナリオカード一覧 */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            maxWidth: "1000px",
            justifyContent: "center",
          }}
        >
          {SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              style={cardStyle}
              onClick={() => onSelectScenario(scenario)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 8px 12px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow =
                  "0 4px 6px rgba(0, 0, 0, 0.1)";
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "1.2em",
                    marginBottom: "10px",
                    color: scenario.isCustom ? "#ffc107" : "#007bff",
                  }}
                >
                  {scenario.title}
                </h2>
                <p style={{ fontSize: "0.9em", color: "#666" }}>
                  {scenario.description}
                </p>
              </div>
              <div
                style={{
                  marginTop: "15px",
                  padding: "5px 10px",
                  backgroundColor: scenario.isCustom ? "#fff3cd" : "#e9ecef",
                  borderRadius: "4px",
                  alignSelf: "flex-start",
                  fontSize: "0.85em",
                  color: "#444",
                  fontWeight: "bold",
                }}
              >
                {scenario.isCustom ? (
                  <>
                    <FaCog
                      style={{
                        marginRight: "5px",
                        verticalAlign: "middle",
                        color: "#f57c00",
                      }}
                    />
                    カスタム定義へ
                  </>
                ) : (
                  <>
                    <FaLightbulb
                      style={{ marginRight: "5px", verticalAlign: "middle" }}
                    />
                    設計を開始
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* フッターリンクエリア */}
      <footer style={footerStyle}>
        <div style={linkGroupStyle}>
          {/* GitHubリンク */}
          <a
            href="https://github.com/Morishita-mm/architecture-sandbox.git"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#f0f0f0")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "white")
            }
          >
            <FaGithub size={20} />
            <span>Repository</span>
          </a>

          {/* Qiitaリンク */}
          <a
            href="https://qiita.com/gorilla_tech/items/af5cb63424ddd54ee585"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#55c50011")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "white")
            }
          >
            <img
              src={qiitaIcon}
              alt="Qiita"
              style={{ width: "20px", height: "20px", objectFit: "contain" }}
            />
            <span>Qiita Article</span>
          </a>
        </div>
        <div style={{ fontSize: "12px", color: "#999", marginTop: "10px" }}>
          © 2025 Architecture Sandbox
        </div>
      </footer>
    </div>
  );
};
