import React from "react";
import type { Node } from "reactflow";
import { BiX } from "react-icons/bi";
import type { AppNodeData } from "../types";

interface Props {
  selectedNode: Node<AppNodeData> | null;
  onChange: (id: string, newData: AppNodeData) => void;
  onClose: () => void;
}

export const PropertiesPanel: React.FC<Props> = ({ selectedNode, onChange, onClose }) => {
  if (!selectedNode) return null;

  const { data, id } = selectedNode;

  // 入力変更ハンドラ
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(id, { ...data, label: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(id, { ...data, description: e.target.value });
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: "bold" }}>プロパティ編集</span>
        <button onClick={onClose} style={closeButtonStyle}>
          <BiX size={20} />
        </button>
      </div>

      <div style={contentStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>種別 (Original Type)</label>
          <div style={readOnlyValueStyle}>{data.originalType}</div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>表示名 (Label)</label>
          <input
            type="text"
            value={data.label}
            onChange={handleLabelChange}
            style={inputStyle}
            placeholder="名前を入力..."
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>詳細・メモ (Description)</label>
          <textarea
            value={data.description || ""}
            onChange={handleDescriptionChange}
            style={textareaStyle}
            placeholder="役割や詳細設定などを記述..."
            rows={5}
          />
        </div>
      </div>
    </div>
  );
};

// --- Styles ---
const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 20,
  right: 20,
  width: 300,
  backgroundColor: "white",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  border: "1px solid #ddd",
  zIndex: 10,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  padding: "10px 15px",
  backgroundColor: "#f5f5f5",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#666",
  padding: 0,
  display: "flex",
};

const contentStyle: React.CSSProperties = {
  padding: 15,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 15,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: "bold",
  color: "#666",
  marginBottom: 5,
};

const readOnlyValueStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#333",
  padding: "8px",
  backgroundColor: "#f9f9f9",
  borderRadius: 4,
  border: "1px solid #eee",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  fontSize: "14px",
  borderRadius: 4,
  border: "1px solid #ddd",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};