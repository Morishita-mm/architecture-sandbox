import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { AppNodeData } from "../types";
import { getNodeStyle } from "../utils/nodeStyles";
import { CiMemoPad } from "react-icons/ci";

// ベースのスタイル
const baseNodeStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: "8px",
  color: "#333",
  minWidth: "150px",
  textAlign: "center",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  position: "relative",
  transition: "all 0.2s",
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
  color: "#555",
  opacity: 0.7,
};

export const CustomNode = memo(({ data, selected }: NodeProps<AppNodeData>) => {
  const styleConfig = getNodeStyle(data.originalType, data.customColor);

  const containerStyle: React.CSSProperties = {
    ...baseNodeStyle,
    background: styleConfig.bg,
    border: `2px solid ${selected ? "#2196F3" : styleConfig.border}`,
    boxShadow: selected
      ? "0 0 0 4px rgba(33, 150, 243, 0.3)"
      : baseNodeStyle.boxShadow,
  };

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: "-10px",
    right: "10px",
    background: styleConfig.badge,
    color: "#333",
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    border: `1px solid ${styleConfig.border}`,
    fontWeight: "bold",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const isRenamed = data.label !== data.originalType;

  return (
    <div style={containerStyle}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555" }}
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
