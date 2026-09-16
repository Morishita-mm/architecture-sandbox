import { memo, useContext, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { BiNote, BiPauseCircle } from 'react-icons/bi';
import type { AppNodeData } from '../types';
import { getNodeStyle, NODE_CARD_WIDTH, NODE_CARD_MIN_HEIGHT } from '../utils/nodeStyles';
import { NodePresentationContext } from './nodePresentation';
import { responsibilities } from '../utils/designModel';
import { componentGuides } from '../constants/componentGuides';
import { ComponentIcon } from './ComponentIcon';

export const CustomNode = memo(({ id, data, selected }: NodeProps<AppNodeData>) => {
  const presentation = useContext(NodePresentationContext)[id];
  const style = getNodeStyle(data.originalType, data.customColor);
  const subtitle = data.label !== data.originalType ? data.originalType : componentGuides[data.originalType]?.name;
  return <div className={`canvas-node${selected ? ' is-selected' : ''}${presentation?.step ? ' is-traced' : ''}${presentation?.status ? ' is-stopped' : ''}`}
    style={{ '--node-accent': data.customColor ?? style.border, width: NODE_CARD_WIDTH, minHeight: NODE_CARD_MIN_HEIGHT } as CSSProperties}>
    <Handle aria-label={`${data.label}への入力接続点`} type="target" position={Position.Top} />
    {!presentation?.fixed && <Handle aria-label={`${data.label}からの出力接続点`} type="source" position={Position.Bottom} />}
    {presentation?.step && <span className="canvas-node-step">{presentation.step}</span>}
    <div className="canvas-node-heading">
      <span className="canvas-node-icon"><ComponentIcon type={data.originalType} category={style.category} /></span>
      <div className="canvas-node-copy"><div className="canvas-node-name">{data.label}</div>{presentation?.screen ? <div className={`canvas-node-screen is-${presentation.screen.state}`} aria-label="利用者の画面" role="status">{presentation.screen.text}</div> : subtitle && <div className="canvas-node-subtitle">{subtitle}</div>}</div>
      {data.description && !presentation?.action && <span className="canvas-node-note" title={data.description}><BiNote aria-hidden="true" /></span>}
    </div>
    {presentation?.action && <button type="button" className="canvas-node-action nodrag nopan" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }} onClick={e => { e.stopPropagation(); presentation.action!.onClick(); }}>{presentation.action.label}</button>}
    {(data.design?.scope === 'external' || data.design?.responsibility || data.design?.replicas) && <div className="node-design-badges">
      {data.design?.scope === 'external' && <span>外部サービス</span>}
      {data.design?.responsibility && <span>{responsibilities[data.design.responsibility]}</span>}
      {data.design?.replicas && <span>{data.design.replicas}台・実行単位</span>}
    </div>}
    {presentation?.status && <div className="canvas-node-status"><BiPauseCircle aria-hidden="true" />{presentation.status}</div>}
    {presentation?.fixed && <div className="canvas-node-fixed">教材側の相手・追加対象外</div>}
  </div>;
});
