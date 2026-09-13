import React, { useState } from "react";
import { NODE_CATEGORIES, type NodeCategory } from "../constants/nodeTypes";
import { BiChevronLeft } from "react-icons/bi";

export const Sidebar = ({ onClose }: { onClose: () => void }) => {
  // アコーディオンの開閉状態管理 (初期値として主要なカテゴリを開いておく)
  const [openCategories, setOpenCategories] = useState<string[]>([
    "client",
    "traffic",
    "compute",
    "database",
  ]);

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // ドラッグ開始時の処理
  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    label: string,
    color: string,
    bgColor: string
  ) => {
    // ReactFlowのノードタイプとしては 'default' を使用し、
    // ラベルで論理的な種類を区別します
    event.dataTransfer.setData("application/reactflow/type", nodeType);
    event.dataTransfer.setData("application/reactflow/label", label);
    // スタイル適用のため色情報を渡す
    event.dataTransfer.setData("application/reactflow/color", color);
    event.dataTransfer.setData("application/reactflow/bgcolor", bgColor);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="component-sidebar" style={sidebarStyle} aria-label="コンポーネント">
      <div className="side-panel-heading" style={descriptionStyle}><span>コンポーネント</span><button className="panel-close-button" onClick={onClose} aria-label="コンポーネントを閉じる" title="コンポーネントを閉じる"><BiChevronLeft size={20} /></button></div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {NODE_CATEGORIES.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            isOpen={openCategories.includes(category.id)}
            onToggle={() => toggleCategory(category.id)}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </aside>
  );
};

// --- サブコンポーネント: カテゴリセクション ---
const CategorySection = ({
  category,
  isOpen,
  onToggle,
  onDragStart,
}: {
  category: NodeCategory;
  isOpen: boolean;
  onToggle: () => void;
  onDragStart: (
    e: React.DragEvent,
    type: string,
    label: string,
    color: string,
    bgColor: string
  ) => void;
}) => {
  return (
    <div style={{ marginBottom: "10px" }}>
      <button
        aria-expanded={isOpen}
        onClick={onToggle}
        style={{
          ...headerStyle,
          borderLeft: `3px solid ${category.color}`,
          backgroundColor: isOpen ? "var(--app-subtle)" : "transparent",
        }}
      >
        <span style={{ fontWeight: "bold", color: "var(--app-text)" }}>
          {category.label}
        </span>
        <span style={{ fontSize: "12px", color: "#888" }}>
          {isOpen ? "▼" : "▶"}
        </span>
      </button>

      {isOpen && (
        <div style={listStyle}>
          {category.items.map((item) => (
            <div
              key={item.type}
              className="dndnode"
              onDragStart={(event) =>
                onDragStart(
                  event,
                  "default",
                  item.label,
                  category.color,
                  category.bgColor
                )
              }
              draggable
              style={{
                ...nodeStyle,
                borderColor: "var(--app-border)",
                // サイドバー上の見た目は白背景でスッキリさせる
                backgroundColor: "var(--component-background, white)",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: category.color,
                  marginRight: "8px",
                }}
              ></div>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Styles ---
const sidebarStyle: React.CSSProperties = {
  width: "100%",
  borderRight: "1px solid var(--app-border)",
  padding: "8px 12px 16px",
  backgroundColor: "#fff",
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

const descriptionStyle: React.CSSProperties = {
  marginBottom: "15px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "var(--app-muted)",
};

const headerStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  padding: "9px 10px",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "12px",
  borderRadius: "0 4px 4px 0",
  marginBottom: "5px",
  transition: "background-color 0.2s",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  paddingLeft: "8px",
  paddingBottom: "10px",
};

const nodeStyle: React.CSSProperties = {
  minHeight: "36px",
  padding: "7px 10px",
  border: "1px solid var(--app-border)",
  borderRadius: "6px",
  cursor: "grab",
  fontSize: "13px",
  display: "flex",
  alignItems: "center",
  color: "var(--app-text)",
};
