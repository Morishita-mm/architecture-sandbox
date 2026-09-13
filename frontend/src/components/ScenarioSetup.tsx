import React, { useState } from "react";
import { BiRocket, BiServer, BiWallet, BiSlider } from "react-icons/bi";

import type { Scenario, ScenarioDifficulty, PartnerRole } from "../types";

interface Props {
  initialScenario: Scenario;
  onConfirm: (updatedScenario: Scenario) => void;
  onCancel: () => void;
}

export const ScenarioSetup: React.FC<Props> = ({
  initialScenario,
  onConfirm,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialScenario.title);
  const [description, setDescription] = useState(initialScenario.description);
  const [difficulty, setDifficulty] = useState<ScenarioDifficulty>(initialScenario.difficulty ?? "medium");
  const [partnerRole, setPartnerRole] = useState<PartnerRole>(initialScenario.partnerRole ?? "ceo");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      ...initialScenario,
      title,
      description,
      difficulty,
      partnerRole,
    });
  };

  return (
    <div style={containerStyle}>
      <div className="setup-card" style={cardStyle}>
        <h2 style={titleStyle}>
          <BiSlider style={{ marginRight: '10px', color: 'var(--app-muted)' }} />
          テーマ設定</h2>
        <p style={descStyle}>
          あなたが設計したいシステム（ゲーム、EC、SNSなど）を定義してください。
          <br />
          <strong>
            具体的な数値（トラフィックなど）は、クライアント役のAIとの会話で探る必要があります。
          </strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>タイトル (Title)</label>
            <input
              style={inputStyle}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: フリマアプリ、MMORPGのサーバー"
              required
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>概要 (Description)</label>
            <textarea
              style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: ユーザー同士がアイテムを売買する。画像のやり取りが多い。"
              required
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>規模感・難易度 (Difficulty)</label>
            <div style={radioGroupStyle}>
              <label style={radioLabelStyle(difficulty === "small")}>
                <input
                  type="radio"
                  name="difficulty"
                  value="small"
                  checked={difficulty === "small"}
                  onChange={() => setDifficulty("small")}
                  style={{ marginRight: "8px" }}
                />
                <div>
                  <div style={{ fontWeight: "bold" }}>★☆☆ 小規模</div>
                  <div style={{ fontSize: "12px", color: "var(--app-muted)" }}>
                    社内ツール・個人開発レベル
                  </div>
                </div>
              </label>

              <label style={radioLabelStyle(difficulty === "medium")}>
                <input
                  type="radio"
                  name="difficulty"
                  value="medium"
                  checked={difficulty === "medium"}
                  onChange={() => setDifficulty("medium")}
                  style={{ marginRight: "8px" }}
                />
                <div>
                  <div style={{ fontWeight: "bold" }}>★★☆ 中規模</div>
                  <div style={{ fontSize: "12px", color: "var(--app-muted)" }}>
                    急成長中のスタートアップ
                  </div>
                </div>
              </label>

              <label style={radioLabelStyle(difficulty === "large")}>
                <input
                  type="radio"
                  name="difficulty"
                  value="large"
                  checked={difficulty === "large"}
                  onChange={() => setDifficulty("large")}
                  style={{ marginRight: "8px" }}
                />
                <div>
                  <div style={{ fontWeight: "bold" }}>★★★ 大規模</div>
                  <div style={{ fontSize: "12px", color: "var(--app-muted)" }}>
                    Global・ミッションクリティカル
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>相談相手 (Partner)</label>
            <div style={radioGroupStyle}>
              <label style={radioLabelStyle(partnerRole === "ceo")}>
                <input
                  type="radio"
                  name="partner"
                  value="ceo"
                  checked={partnerRole === "ceo"}
                  onChange={() => setPartnerRole("ceo")}
                  style={{ marginRight: "8px" }}
                />
                <div>
                  <div style={{ fontWeight: "bold" }}>
                    <BiRocket style={{ marginRight: '8px', color: '#E91E63' }} />
                    非技術系CEO</div>
                  <div style={{ fontSize: "12px", color: "var(--app-muted)" }}>
                    夢を語る・要件がふわっとしている
                  </div>
                </div>
              </label>

              <label style={radioLabelStyle(partnerRole === "cto")}>
                <input
                  type="radio"
                  name="partner"
                  value="cto"
                  checked={partnerRole === "cto"}
                  onChange={() => setPartnerRole("cto")}
                  style={{ marginRight: "8px" }}
                />
                <div>
                  <div style={{ fontWeight: "bold" }}>
                    <BiServer style={{ marginRight: '8px', color: 'var(--app-primary)' }} />
                    技術責任者 (CTO)</div>
                  <div style={{ fontSize: "12px", color: "var(--app-muted)" }}>
                    品質・堅牢性重視・SPOF許さない
                  </div>
                </div>
              </label>

              <label style={radioLabelStyle(partnerRole === "cfo")}>
                <input
                  type="radio"
                  name="partner"
                  value="cfo"
                  checked={partnerRole === "cfo"}
                  onChange={() => setPartnerRole("cfo")}
                  style={{ marginRight: "8px" }}
                />
                <div>
                  <div style={{ fontWeight: "bold" }}>
                    <BiWallet style={{ marginRight: '8px', color: 'var(--app-success)' }} />
                    財務担当 (CFO)</div>
                  <div style={{ fontSize: "12px", color: "var(--app-muted)" }}>
                    コスト重視・高額な構成に厳しい
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div style={buttonGroupStyle}>
            <button type="button" onClick={onCancel} style={cancelButtonStyle}>
              戻る
            </button>
            <button type="submit" style={confirmButtonStyle}>
              決定してクライアントと話す →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Styles ---
const containerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  padding: "20px",
  backgroundColor: "var(--app-bg)",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "600px",
  backgroundColor: "white",
  borderRadius: "10px",
  border: "1px solid var(--app-border)",
  boxShadow: "var(--app-shadow)",
};

const titleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: "10px",
  color: "var(--app-text)",
  textAlign: "center",
};

const descStyle: React.CSSProperties = {
  marginBottom: "30px",
  color: "var(--app-muted)",
  textAlign: "center",
  lineHeight: "1.5",
  fontSize: "14px",
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: "20px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontWeight: "bold",
  color: "var(--app-text)",
  fontSize: "14px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  fontSize: "14px",
  borderRadius: "6px",
  border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-subtle)",
  fontFamily: "inherit",
};

const radioGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const radioLabelStyle = (isActive: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  padding: "12px",
  borderRadius: "6px",
  border: `1px solid ${isActive ? "var(--app-primary)" : "var(--app-border)"}`,
  backgroundColor: isActive ? "var(--app-primary-soft)" : "white",
  cursor: "pointer",
  transition: "border-color 0.15s, background-color 0.15s",
});

const buttonGroupStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "40px",
  gap: "10px",
};

const confirmButtonStyle: React.CSSProperties = {
  flex: 2,
  padding: "12px",
  backgroundColor: "var(--app-success)",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontWeight: "bold",
  fontSize: "14px",
  cursor: "pointer",
};

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  backgroundColor: "#f6f8fa",
  color: "var(--app-text)",
  border: "1px solid #d1d5da",
  borderRadius: "6px",
  fontWeight: "bold",
  fontSize: "14px",
  cursor: "pointer",
};
