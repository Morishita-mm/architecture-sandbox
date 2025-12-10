import React, { useState } from "react";
import { SCENARIOS } from "../scenarios";
import type { Scenario, ProjectSaveData } from "../types";
import { FaCog, FaLightbulb, FaGithub } from "react-icons/fa"; // FaGithubを追加
import { BiFolderOpen, BiHelpCircle, BiBookContent } from "react-icons/bi"; // BiHelpCircle, BiBookContentを追加
import { loadProjectFromLocalFile } from "../utils/fileHandler";
import { HelpModal } from "./HelpModal"; // ★追加

interface ScenarioSelectionScreenProps {
  onSelectScenario: (scenario: Scenario) => void;
  onProjectLoad: (loadedData: ProjectSaveData) => void;
}

export const ScenarioSelectionScreen: React.FC<
  ScenarioSelectionScreenProps
> = ({ onSelectScenario, onProjectLoad }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false); // ★追加

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
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minHeight: "100vh",
    padding: "20px",
    backgroundColor: "#f4f7f9",
    position: "relative", // ヘッダー配置用
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
    justifyContent: "space-between", // コンテンツを上下に分散
  };

  const footerStyle: React.CSSProperties = {
    marginTop: "auto", // 最下部に配置
    paddingTop: "40px",
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

  return (
    <div style={containerStyle}>
      {/* ★追加: 右上のヘルプボタン */}
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

      {/* メインコンテンツ */}
      <div style={{ marginTop: "60px", textAlign: "center" }}>
        <h1
          style={{
            marginBottom: "20px",
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
        <p style={{ color: "#666", marginBottom: "40px" }}>
          AIパートナーと対話しながら、システムアーキテクチャを設計・評価しよう
        </p>

        {/* ファイル読み込みボタン */}
        <div
          style={{
            marginBottom: "50px",
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
            <BiBookContent size={20} color="#55c500" />
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
