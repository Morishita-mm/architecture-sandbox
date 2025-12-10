import React from "react";
import { BiHelpCircle } from "react-icons/bi";

interface HeaderProps {
  title: string;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  onSave,
  isSaving,
  onOpenHelp,
}) => {
  return (
    <header style={headerContainerStyle}>
      <button onClick={onBack} style={backButtonStyle}>
        ⬅ シナリオ選択に戻る
      </button>

      <h1 style={{ fontSize: "1.2em", margin: 0 }}>{title}</h1>

      <button
        onClick={onOpenHelp}
        style={helpButtonStyle}
        title="操作ガイドを見る"
      >
        <BiHelpCircle size={20} />
        ガイド
      </button>

      <button
        onClick={onSave}
        disabled={isSaving}
        style={{
          ...saveButtonStyle,
          backgroundColor: isSaving ? "#ccc" : "#28a745",
          cursor: isSaving ? "wait" : "pointer",
        }}
      >
        {isSaving ? "保存中..." : "プロジェクト保存（ローカル）"}
      </button>
    </header>
  );
};

// --- Styles ---
const headerContainerStyle: React.CSSProperties = {
  padding: "10px 20px",
  backgroundColor: "#f5f5f5",
  borderBottom: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  gap: "20px",
  flexShrink: 0,
};

const backButtonStyle: React.CSSProperties = {
  padding: "8px 15px",
  border: "1px solid #007bff",
  borderRadius: "4px",
  backgroundColor: "white",
  cursor: "pointer",
  color: "#007bff",
};

const helpButtonStyle: React.CSSProperties = {
  marginLeft: "auto", // 右寄せ
  marginRight: "10px",
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  backgroundColor: "white",
  cursor: "pointer",
  color: "#555",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "14px",
};

const saveButtonStyle: React.CSSProperties = {
  padding: "8px 15px",
  borderRadius: "4px",
  border: "none",
  color: "white",
};
