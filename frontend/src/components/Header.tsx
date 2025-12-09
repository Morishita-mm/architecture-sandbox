import React from "react";
import { SCENARIOS } from "../scenarios";
import { BiSave } from "react-icons/bi";

interface HeaderProps {
  selectedScenarioId: string;
  onScenarioChange: (id: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectedScenarioId,
  onScenarioChange,
  onSave,
  isSaving,
}) => {
  return (
    <header style={headerStyle}>
      <div style={titleGroupStyle}>
        <h1 style={appTitleStyle}>Architecture Sandbox</h1>
      </div>

      <div style={controlsStyle}>
        <div style={selectorGroupStyle}>
          <label style={labelStyle}>お題:</label>
          <select
            value={selectedScenarioId}
            onChange={(e) => onScenarioChange(e.target.value)}
            style={selectStyle}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* ▼ 追加: 保存ボタン ▼ */}
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            ...saveButtonStyle,
            opacity: isSaving ? 0.7 : 1,
            cursor: isSaving ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {isSaving ? (
            "保存中..."
          ) : (
            <>
              <BiSave size={16} />
              プロジェクトを保存
            </>
          )}
        </button>
      </div>
    </header>
  );
};

// --- Styles ---
const saveButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  backgroundColor: "#238636", // GitHub Green
  color: "white",
  border: "1px solid rgba(240,246,252,0.1)",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "bold",
};

const headerStyle: React.CSSProperties = {
  height: "60px",
  backgroundColor: "#24292e", // GitHubっぽいダークヘッダー
  color: "white",
  display: "flex",
  alignItems: "center",
  padding: "0 20px",
  justifyContent: "space-between",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  zIndex: 10,
};

const titleGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const appTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "bold",
  margin: 0,
  marginRight: "20px",
};

const controlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
};

const selectorGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#ccc",
};

const selectStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "4px",
  border: "1px solid #555",
  backgroundColor: "#333",
  color: "white",
  fontSize: "14px",
};
