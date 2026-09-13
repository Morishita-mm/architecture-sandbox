import React from "react";
import { BiHelpCircle, BiArrowBack, BiSave } from "react-icons/bi";

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
      {/* 左側: 戻るボタン */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={onBack}
          style={backButtonStyle}
          title="シナリオ選択画面に戻る"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#f0f0f0")
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
        >
          <BiArrowBack size={20} />
        </button>
        <img src="/icons/01-open-a-small.svg" alt="Architecture Sandbox" width={32} height={32} />
      </div>

      {/* 中央: タイトル */}
      <div style={titleWrapperStyle}>
        <h1 style={titleStyle}>{title}</h1>
      </div>

      {/* 右側: アクションボタン群 */}
      <div style={actionsGroupStyle}>
        <button
          onClick={onOpenHelp}
          style={actionButtonStyle}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#f0f0f0")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "white")
          }
        >
          <BiHelpCircle size={20} color="#2196F3" />
          <span style={buttonTextStyle}>操作ガイド</span>
        </button>

        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            ...saveButtonStyle,
            backgroundColor: isSaving ? "#ccc" : "#28a745",
            cursor: isSaving ? "wait" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!isSaving) e.currentTarget.style.transform = "translateY(-1px)";
            if (!isSaving)
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            if (!isSaving) e.currentTarget.style.transform = "none";
            if (!isSaving)
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
          }}
        >
          {isSaving ? (
            "保存中..."
          ) : (
            <>
              <BiSave size={18} />
              <span style={buttonTextStyle}>プロジェクト保存</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

// --- Styles ---

const headerContainerStyle: React.CSSProperties = {
  height: "64px",
  padding: "0 24px",
  backgroundColor: "white",
  borderBottom: "1px solid #eaeaea",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  boxShadow: "0 2px 10px rgba(0,0,0,0.03)", // ほんのり影をつけて浮遊感を出す
  zIndex: 100,
  position: "relative",
};

const titleWrapperStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  textAlign: "center",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.4em",
  margin: 0,
  fontFamily: "'Montserrat', sans-serif", // リッチなフォント
  fontWeight: 800,
  color: "#24292e",
  letterSpacing: "-0.5px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "400px",
  // タイトルにも少し影をつけて立体感を
  textShadow: "1px 1px 0px rgba(0,0,0,0.05)",
};

const backButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  border: "1px solid #eaeaea",
  borderRadius: "50%", // 完全な丸ボタン
  backgroundColor: "white",
  color: "#555",
  cursor: "pointer",
  transition: "all 0.2s",
  boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
};

const actionsGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

// 共通のアクションボタン（白背景）
const actionButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  border: "1px solid #eaeaea",
  borderRadius: "20px", // Pill shape
  backgroundColor: "white",
  color: "#555",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "14px",
  transition: "all 0.2s",
  boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
};

// 保存ボタン（色付き）
const saveButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 20px",
  border: "none",
  borderRadius: "20px", // Pill shape
  color: "white",
  fontWeight: "bold",
  fontSize: "14px",
  transition: "all 0.2s",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
};

const buttonTextStyle: React.CSSProperties = {
  // モバイル対応などで必要ならここで display: none 等を制御可能
};
