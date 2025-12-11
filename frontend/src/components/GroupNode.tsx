import React, { memo } from "react";
import { NodeResizer, type NodeProps } from "reactflow";
import { getNodeStyle } from "../utils/nodeStyles";
import type { AppNodeData } from "../types";

export const GroupNode = memo(({ data, selected }: NodeProps<AppNodeData>) => {
  // 定義ファイルから色を取得 (VPCやSubnetごとの色)
  const styleConfig = getNodeStyle(data.originalType, data.customColor);

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: styleConfig.bg,
    border: `2px dashed ${selected ? "#2196F3" : styleConfig.border}`, // 点線にして「枠」っぽさを出す
    borderRadius: "4px",
    position: "relative",
    transition: "all 0.2s",
    // グループは背面に回ることが多いため、少し透明度を持たせても良い
  };

  const labelStyle: React.CSSProperties = {
    position: "absolute",
    top: "-24px", // 枠の外側（上）にラベルを出す
    left: "0",
    fontSize: "12px",
    fontWeight: "bold",
    color: styleConfig.border,
    backgroundColor: "transparent",
    padding: "2px 0",
    whiteSpace: "nowrap",
  };

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: "4px",
    right: "4px",
    fontSize: "10px",
    color: "rgba(0,0,0,0.4)",
    pointerEvents: "none",
  };

  return (
    <>
      {/* 選択時のみリサイズハンドルを表示 */}
      <NodeResizer 
        color="#2196F3" 
        isVisible={selected} 
        minWidth={100} 
        minHeight={100} 
      />

      <div style={containerStyle}>
        {/* ラベル (VPC, Subnetなどの名前) */}
        <div style={labelStyle}>{data.label}</div>
        
        {/* 種別バッジ (任意) */}
        {data.label !== data.originalType && (
          <div style={badgeStyle}>{data.originalType}</div>
        )}
      </div>
    </>
  );
});