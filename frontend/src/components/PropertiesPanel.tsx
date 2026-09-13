import React, { useState, useEffect, useRef } from "react";
import type { Node } from "reactflow";
import { BiX, BiUnlink, BiTrash } from "react-icons/bi";
import type { AppNodeData } from "../types";

interface Props {
  selectedNode: Node<AppNodeData> | null;
  onChange: (id: string, newData: AppNodeData) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  // ★追加: 親子関係解除関数
  onDetach?: (id: string) => void;
}

export const PropertiesPanel: React.FC<Props> = ({
  selectedNode,
  onChange,
  onClose,
  onDelete,
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

  const currentPanelStyle: React.CSSProperties = {
    // ... (既存スタイル)
    position: "absolute",
    top: 68,
    right: 16,
    width: "min(280px, calc(100% - 24px))",
    maxHeight: "calc(100% - 84px)",
    backgroundColor: "white",
    borderRadius: 8,
    boxShadow: "0 6px 24px rgba(36,54,75,0.12)",
    border: "1px solid var(--app-border)",
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
          aria-label="プロパティを閉じる"
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
            maxLength={120}
            value={data.label}
            onChange={handleLabelChange}
            style={inputStyle}
            placeholder="名前を入力..."
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>詳細・メモ (Description)</label>
          <textarea
            maxLength={2000}
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
            <p style={{ fontSize: "12px", color: "var(--app-muted)", marginBottom: "8px" }}>
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
        <div style={detachAreaStyle}>
          {selectedNode.type === "group" && (
            <p style={{ fontSize: "12px", color: "var(--app-muted)", marginBottom: "8px" }}>
              グループ内のコンポーネントと接続線も削除されます。
            </p>
          )}
          <button onClick={() => onDelete(id)} style={detachButtonStyle}>
            <BiTrash size={16} />
            {selectedNode.type === "group" ? "グループを削除" : "コンポーネントを削除"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ... (Styles) ...
// 既存のスタイル定数はそのまま維持してください
const headerStyle: React.CSSProperties = {
  padding: "10px 15px",
  backgroundColor: "var(--app-subtle)",
  borderBottom: "1px solid var(--app-border)",
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
  color: "var(--app-muted)",
  padding: 0,
  display: "flex",
};
const contentStyle: React.CSSProperties = { padding: 16, overflowY: "auto" };
const fieldStyle: React.CSSProperties = { marginBottom: 15 };
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: "bold",
  color: "var(--app-muted)",
  marginBottom: 5,
};
const readOnlyValueStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--app-text)",
  padding: "8px",
  backgroundColor: "var(--app-subtle)",
  borderRadius: 6,
  border: "1px solid var(--app-border)",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  fontSize: "14px",
  borderRadius: 6,
  border: "1px solid var(--app-border)",
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
  borderTop: "1px solid var(--app-border)",
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
  border: "1px solid var(--app-danger)",
  color: "var(--app-danger)",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
  transition: "all 0.2s",
};
