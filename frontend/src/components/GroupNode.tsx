import React, { memo } from "react";
import { NodeResizer, type NodeProps, useStore } from "reactflow";
import { getNodeStyle } from "../utils/nodeStyles";
import type { AppNodeData } from "../types";

// React Flowのストア型定義
type ReactFlowStore = {
  nodeInternals: Map<string, any>;
};

export const GroupNode = memo(
  ({ id, data, selected }: NodeProps<AppNodeData>) => {
    const styleConfig = getNodeStyle(data.originalType, data.customColor);

    // --- 子ノードの配置に基づいて最小サイズを計算 ---

    // 最小幅の計算
    const minWidth = useStore((store: ReactFlowStore) => {
      const childNodes = Array.from(store.nodeInternals.values()).filter(
        (n) => n.parentNode === id
      );
      if (childNodes.length === 0) return 100;

      let maxX = 0;
      childNodes.forEach((child) => {
        // 子ノードの右端座標 = 相対X + 幅 + 余白(20px)
        const childRight = child.position.x + (child.width || 0) + 20;
        if (childRight > maxX) maxX = childRight;
      });
      // 今の幅より小さい値にならないようにmaxをとる（または最低100）
      return Math.max(100, maxX);
    });

    // 最小高さの計算
    const minHeight = useStore((store: ReactFlowStore) => {
      const childNodes = Array.from(store.nodeInternals.values()).filter(
        (n) => n.parentNode === id
      );
      if (childNodes.length === 0) return 100;

      let maxY = 0;
      childNodes.forEach((child) => {
        // 子ノードの下端座標 = 相対Y + 高さ + 余白(20px)
        const childBottom = child.position.y + (child.height || 0) + 20;
        if (childBottom > maxY) maxY = childBottom;
      });
      return Math.max(100, maxY);
    });

    const containerStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      backgroundColor: styleConfig.bg,
      border: `2px dashed ${selected ? "#2196F3" : styleConfig.border}`,
      borderRadius: "4px",
      position: "relative",
      transition: "all 0.2s",
    };

    const labelStyle: React.CSSProperties = {
      position: "absolute",
      top: "-24px",
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
        <NodeResizer
          color="#2196F3"
          isVisible={selected}
          minWidth={minWidth}
          minHeight={minHeight}
        />

        <div style={containerStyle}>
          <div style={labelStyle}>{data.label}</div>
          {data.label !== data.originalType && (
            <div style={badgeStyle}>{data.originalType}</div>
          )}
        </div>
      </>
    );
  }
);
