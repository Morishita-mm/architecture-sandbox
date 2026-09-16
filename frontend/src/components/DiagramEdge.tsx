import { BaseEdge, getSmoothStepPath, useStore, type EdgeProps } from 'reactflow';
import { returnWire, roundedWire } from '../utils/diagramRouting';
import { NODE_CARD_WIDTH, NODE_CARD_MIN_HEIGHT } from '../utils/nodeStyles';
import { useContext } from 'react';
import { EdgePacketContext } from './edgePresentation';

/** The white casing separates crossing wires without adding another hit target. */
export function DiagramEdge(props: EdgeProps) {
  const packet = useContext(EdgePacketContext);
  const nodes = useStore(state => state.nodeInternals);
  const [path, labelX, labelY] = props.targetY <= props.sourceY
    ? roundedWire(returnWire({ x: props.sourceX, y: props.sourceY }, { x: props.targetX, y: props.targetY },
      [...nodes.values()].filter(n => n.type !== 'group' && !n.hidden).map(n => ({ ...(n.positionAbsolute ?? n.position), width: n.width ?? NODE_CARD_WIDTH, height: n.height ?? NODE_CARD_MIN_HEIGHT }))))
    : getSmoothStepPath({
    sourceX: props.sourceX, sourceY: props.sourceY, sourcePosition: props.sourcePosition,
    targetX: props.targetX, targetY: props.targetY, targetPosition: props.targetPosition,
    // Overlapping endpoint offsets make a short path double back on itself.
    borderRadius: 12, offset: Math.min(28, (props.targetY - props.sourceY) / 2),
    });
  return <>
    <path d={path} className="diagram-edge-casing" aria-hidden="true" />
    <BaseEdge id={props.id} path={path} labelX={labelX} labelY={labelY}
      label={props.label} labelStyle={props.labelStyle} labelBgStyle={props.labelBgStyle}
      labelBgPadding={[7, 4]} labelBgBorderRadius={5} interactionWidth={24}
      markerEnd={props.markerEnd} markerStart={props.markerStart} style={props.style} />
    {packet?.edgeId === props.id && <g key={packet.key} className={`diagram-packet${packet.reverse ? ' is-reverse' : ''}`} aria-hidden="true" data-direction={packet.reverse ? 'reverse' : 'forward'} data-kind={packet.response ? 'response' : 'request'} style={{ offsetPath: `path('${path}')`, animationPlayState: packet.playing ? 'running' : 'paused', color: packet.response ? '#087f70' : '#2563eb' }}>
      <circle r={10} fill="currentColor" stroke="white" strokeWidth={2} />
      <path className="diagram-packet-arrow" d="M -3 -4 L 2 0 L -3 4" transform={packet.reverse ? 'rotate(180)' : undefined} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </g>}
  </>;
}
