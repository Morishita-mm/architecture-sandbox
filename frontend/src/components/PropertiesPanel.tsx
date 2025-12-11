import React, { useState, useEffect, useRef } from "react";
import type { Node } from "reactflow";
import { BiX, BiUnlink } from "react-icons/bi"; // アイコン追加
import type { AppNodeData } from "../types";

interface Props {
  selectedNode: Node<AppNodeData> | null;
  onChange: (id: string, newData: AppNodeData) => void;
  onClose: () => void;
  // ★追加: 親子関係解除関数
  onDetach?: (id: string) => void;
}

export const PropertiesPanel: React.FC<Props> = ({
  selectedNode,
  onChange,
  onClose,
  onDetach,
}) => {
  // ... (既存の state や useRef は変更なし) ...
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const parentOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  if (!selectedNode) return null;

  const { data, id } = selectedNode;

  // ... (handleLabelChange, handleDescriptionChange, ドラッグ処理などは変更なし) ...
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(id, { ...data, label: e.target.value });
  };

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    onChange(id, { ...data, description: e.target.value });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const parent = panelRef.current.offsetParent as HTMLElement;
      const pRect = parent
        ? parent.getBoundingClientRect()
        : { left: 0, top: 0 };

      parentOffset.current = { x: pRect.left, y: pRect.top };
      dragStartOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setPosition({
        x: rect.left - pRect.left,
        y: rect.top - pRect.top,
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX =
        e.clientX - parentOffset.current.x - dragStartOffset.current.x;
      const newY =
        e.clientY - parentOffset.current.y - dragStartOffset.current.y;
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const currentPanelStyle: React.CSSProperties = {
    // ... (既存スタイル)
    position: "absolute",
    top: 20,
    right: 20,
    width: 300,
    backgroundColor: "white",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    border: "1px solid #ddd",
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    ...(position ? { top: position.y, left: position.x, right: "auto" } : {}),
    cursor: isDragging ? "grabbing" : "auto",
  };

  // 親がいるかどうか
  const hasParent = !!selectedNode.parentNode;

  return (
    <div ref={panelRef} style={currentPanelStyle}>
      <div style={headerStyle} onMouseDown={handleMouseDown}>
        <span style={{ fontWeight: "bold", cursor: "grab" }}>
          プロパティ編集
        </span>
        <button
          onClick={onClose}
          style={closeButtonStyle}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <BiX size={20} />
        </button>
      </div>

      <div style={contentStyle}>
        {/* ... (既存のフィールド) ... */}
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

        {/* ★追加: 切り離しボタンエリア */}
        {hasParent && onDetach && (
          <div style={detachAreaStyle}>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
              このコンポーネントはグループに属しています
            </p>
            <button
              onClick={() => onDetach(selectedNode.id)}
              style={detachButtonStyle}
            >
              <BiUnlink size={16} /> グループから切り離す
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ... (Styles) ...
// 既存のスタイル定数はそのまま維持してください
const headerStyle: React.CSSProperties = {
  padding: "10px 15px",
  backgroundColor: "#f5f5f5",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "grab",
  userSelect: "none",
};
const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#666",
  padding: 0,
  display: "flex",
};
const contentStyle: React.CSSProperties = { padding: 15 };
const fieldStyle: React.CSSProperties = { marginBottom: 15 };
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

// ★追加スタイル
const detachAreaStyle: React.CSSProperties = {
  marginTop: "20px",
  paddingTop: "15px",
  borderTop: "1px solid #eee",
  textAlign: "center",
};

const detachButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  width: "100%",
  padding: "8px",
  backgroundColor: "#fff",
  border: "1px solid #ff4d4f",
  color: "#ff4d4f",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
  transition: "all 0.2s",
};
