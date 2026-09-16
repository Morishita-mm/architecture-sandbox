import type { Node, Edge } from 'reactflow';
import type { AppNodeData } from '../types.ts';

export interface Diagram<D extends AppNodeData = AppNodeData> { nodes: Node<D>[]; edges: Edge[] }
export interface DiagramHistory<D extends AppNodeData = AppNodeData> { present: Diagram<D>; past: Diagram<D>[]; future: Diagram<D>[]; group: string | null }
export type DiagramAction<D extends AppNodeData = AppNodeData> = { type: 'change'; update: (graph: Diagram<D>) => Diagram<D>; group?: string; finish?: boolean } | { type: 'undo' } | { type: 'redo' } | { type: 'finish' };

// Ignore selection and React Flow's measured/transient fields, but retain actual group sizes.
export function diagramKey(graph: Diagram) {
  return JSON.stringify({ nodes: graph.nodes.map(n => ({ id: n.id, type: n.type, data: n.data,
    position: n.position, parentNode: n.parentNode, extent: n.extent,
    style: n.type === 'group' ? { width: n.width ?? n.style?.width, height: n.height ?? n.style?.height } : undefined,
  })), edges: graph.edges.map(e => ({ id: e.id, source: e.source, target: e.target, data: e.data })) });
}
export function diagramReducer<D extends AppNodeData>(state: DiagramHistory<D>, action: DiagramAction<D>): DiagramHistory<D> {
  if (action.type === 'finish') return { ...state, group: null };
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    return previous ? { present: previous, past: state.past.slice(0, -1), future: [state.present, ...state.future].slice(0, 50), group: null } : state;
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    return next ? { present: next, past: [...state.past, state.present].slice(-50), future: state.future.slice(1), group: null } : state;
  }
  const updated = action.update(state.present);
  const ids = new Set(updated.nodes.map(n => n.id));
  const present = { ...updated, edges: updated.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
  const changed = diagramKey(present) !== diagramKey(state.present);
  const group = action.group ?? state.group;
  return { present,
    past: changed && (!group || group !== state.group) ? [...state.past, state.present].slice(-50) : state.past,
    future: changed ? [] : state.future,
    group: action.finish ? null : changed ? group : state.group,
  };
}
