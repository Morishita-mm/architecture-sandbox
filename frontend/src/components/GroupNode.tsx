import React, { memo } from "react";
import { NodeResizer, type NodeProps, useStore } from "reactflow";
import { getNodeStyle } from "../utils/nodeStyles";
import type { AppNodeData } from "../types";

export const GroupNode = memo(
  ({ id, data, selected }: NodeProps<AppNodeData>) => {
    const styleConfig = getNodeStyle(data.originalType, data.customColor);

    const [minWidth, minHeight] = useStore((store) => {
      let width = 100;
      let height = 100;
      for (const child of store.nodeInternals.values()) {
        if (child.parentNode !== id) continue;
        width = Math.max(width, child.position.x + (child.width || 0) + 20);
        height = Math.max(height, child.position.y + (child.height || 0) + 20);
      }
      return [width, height];
    }, (previous, next) => previous[0] === next[0] && previous[1] === next[1]);

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
          maxWidth={10000}
          maxHeight={10000}
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
