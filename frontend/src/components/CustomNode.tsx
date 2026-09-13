import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { AppNodeData } from "../types";
import { getNodeStyle } from "../utils/nodeStyles";
import { CiMemoPad } from "react-icons/ci";

// ベースのスタイル
const baseNodeStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "8px",
  color: "var(--app-text)",
  minWidth: "150px",
  textAlign: "center",
  boxShadow: "var(--app-shadow)",
  position: "relative",
  transition: "box-shadow 0.15s, border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "bold",
  margin: 0,
  pointerEvents: "none",
};

const descIconStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "5px",
  right: "5px",
  fontSize: "10px",
  color: "var(--app-muted)",
  opacity: 0.7,
};

export const CustomNode = memo(({ data, selected }: NodeProps<AppNodeData>) => {
  const styleConfig = getNodeStyle(data.originalType, data.customColor);

  const containerStyle: React.CSSProperties = {
    ...baseNodeStyle,
    background: styleConfig.bg,
    border: `2px solid ${selected ? "var(--app-primary)" : styleConfig.border}`,
    boxShadow: selected
      ? "0 0 0 3px rgba(33, 100, 232, 0.16)"
      : baseNodeStyle.boxShadow,
  };

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    right: "10px",
    background: styleConfig.badge,
    color: "var(--app-text)",
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    border: `1px solid ${styleConfig.border}`,
    fontWeight: "bold",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };

  const isRenamed = data.label !== data.originalType;

  return (
    <div className="canvas-node" style={containerStyle}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "var(--app-muted)" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "var(--app-muted)" }}
      />

      {isRenamed && <div style={badgeStyle}>{data.originalType}</div>}

      <div style={labelStyle}>{data.label}</div>

      {data.description && (
        <div style={descIconStyle} title={data.description}>
          <CiMemoPad />
        </div>
      )}
    </div>
  );
});
