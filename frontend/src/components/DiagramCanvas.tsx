import ReactFlow, { Background, Controls, MiniMap, MarkerType, ConnectionLineType } from 'reactflow';
import { useRef } from 'react';
import type { ReactFlowProps } from 'reactflow';
import { nodeTypes } from '../constants/nodeTypes';
import { connectionLabel } from '../utils/designModel';
import { NodePresentationContext } from './nodePresentation';
import type { NodePresentation } from './nodePresentation';
import 'reactflow/dist/style.css';
import './DiagramCanvas.css';
import { DiagramEdge } from './DiagramEdge';
import { EdgePacketContext, type EdgePacket } from './edgePresentation';

const emptyPresentation: Record<string, NodePresentation> = {};
const edgeTypes = { default: DiagramEdge };

interface Props extends ReactFlowProps {
  miniMap?: boolean;
  presentation?: Record<string, NodePresentation>;
  packet?: EdgePacket;
}
export function DiagramCanvas({ nodes = [], edges = [], miniMap = false, presentation = emptyPresentation, packet, children, onPaneClick, onNodesDelete, fitViewOptions, ...props }: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const fitOptions = { padding: .25, maxZoom: 1, ...fitViewOptions };
  return <NodePresentationContext.Provider value={presentation}><EdgePacketContext.Provider value={packet}><ReactFlow
    ref={canvas} tabIndex={0}
    nodes={nodes}
    edges={edges.map(edge => {
      const travelling = packet?.edgeId === edge.id;
      const emphasized = travelling || edge.selected;
      const color = travelling && packet.response ? '#087f70' : emphasized ? '#2563eb' : '#71839b';
      return { ...edge, label: edge.data ? connectionLabel(edge.data) : undefined,
        labelStyle: { fontSize: 11, fontWeight: 500, fill: emphasized ? '#1e4db7' : '#4b5e76' },
        labelBgStyle: { fill: '#ffffff', stroke: emphasized ? '#afc8f7' : '#dce4ee', strokeWidth: 1 },
        animated: false,
        style: { ...edge.style, stroke: color, strokeWidth: emphasized ? 2.5 : 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' },
        markerEnd: travelling && packet.reverse ? undefined : { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        markerStart: travelling && packet.reverse ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18, orient: 'auto-start-reverse' } : undefined,
        ariaLabel: `${nodes.find(n => n.id === edge.source)?.data.label ?? '部品'}から${nodes.find(n => n.id === edge.target)?.data.label ?? '部品'}への接続` };
    })}
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
    connectionLineType={ConnectionLineType.SmoothStep}
    connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 2 }}
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
    fitView fitViewOptions={fitOptions}
    {...props}
    onPaneClick={event => { canvas.current?.focus({ preventScroll: true }); onPaneClick?.(event); }}
    onNodesDelete={deleted => {
      // Keep keyboard editing available after the focused node disappears.
      if (document.activeElement === document.body || canvas.current?.contains(document.activeElement)) canvas.current?.focus({ preventScroll: true });
      onNodesDelete?.(deleted);
    }}
  >
    <Background color="#d4dce6" gap={20} size={1} />
    <Controls fitViewOptions={fitOptions} />
    {miniMap && <MiniMap />}
    {children}
  </ReactFlow></EdgePacketContext.Provider></NodePresentationContext.Provider>;
}
