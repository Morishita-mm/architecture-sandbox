import { useCallback, useReducer } from 'react';
import type { DragEvent, KeyboardEvent, SetStateAction } from 'react';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from 'reactflow';
import type { AppNodeData } from '../types';
import { diagramReducer } from './diagramHistory';
import type { Diagram, DiagramAction, DiagramHistory } from './diagramHistory';
import { connectDiagram, insertDiagramNode } from './diagramEditing';
import type { ConnectionRules } from './diagramEditing';

export const COMPONENT_DRAG_TYPE = 'application/reactflow/label';
export function startComponentDrag(event: DragEvent, component: string) {
  event.dataTransfer.setData(COMPONENT_DRAG_TYPE, component);
  event.dataTransfer.effectAllowed = 'copy';
}
export function diagramHistoryShortcut(event: KeyboardEvent, undo: () => void, redo: () => void) {
  if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable=true]') || event.altKey || !(event.metaKey || event.ctrlKey)) return;
  if (event.key.toLowerCase() === 'z') { event.preventDefault(); (event.shiftKey ? redo : undo)(); }
  if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
}
export function useDiagramEditor<D extends AppNodeData>(initial: Diagram<D>, rules?: ConnectionRules) {
  const [history, dispatch] = useReducer((state: DiagramHistory<D>, action: DiagramAction<D>) => diagramReducer(state, action), { present: initial, past: [], future: [], group: null });
  const setNodes = useCallback((update: SetStateAction<Node<D>[]>) => dispatch({ type: 'change', update: g => ({ ...g, nodes: typeof update === 'function' ? update(g.nodes) : update }) }), []);
  const setEdges = useCallback((update: SetStateAction<Edge[]>) => dispatch({ type: 'change', update: g => ({ ...g, edges: typeof update === 'function' ? update(g.edges) : update }) }), []);
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const removing = changes.some(c => c.type === 'remove');
    dispatch({ type: 'change', group: removing ? 'delete' : changes.some(c => c.type === 'position' && c.dragging) ? 'drag' : changes.some(c => c.type === 'dimensions' && c.resizing) ? 'resize' : undefined,
      finish: changes.some(c => c.type === 'dimensions' && c.resizing === false),
      update: g => ({ ...g, nodes: applyNodeChanges<D>(changes, g.nodes) }) });
    if (removing) queueMicrotask(() => dispatch({ type: 'finish' }));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removing = changes.some(c => c.type === 'remove');
    // React Flow reports connected edges and their deleted nodes separately, in one operation.
    dispatch({ type: 'change', group: removing ? 'delete' : undefined, update: g => ({ ...g, edges: applyEdgeChanges(changes, g.edges) }) });
    if (removing) queueMicrotask(() => dispatch({ type: 'finish' }));
  }, []);
  const onConnect = useCallback((c: Connection) => dispatch({ type: 'change', update: g => connectDiagram(g, c, rules) }), [rules]);
  const addNode = useCallback((node: Node<D>) => dispatch({ type: 'change', update: g => insertDiagramNode(g, node) }), []);
  const finish = useCallback(() => dispatch({ type: 'finish' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  return { history, dispatch, setNodes, setEdges, onNodesChange, onEdgesChange, onConnect, addNode, finish, undo, redo };
}
