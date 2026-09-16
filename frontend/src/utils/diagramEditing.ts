import type { Connection, Edge, Node } from 'reactflow';
import type { AppNodeData } from '../types.ts';
import type { Diagram } from './diagramHistory.ts';

export interface ConnectionRules {
  maxEdges?: number;
  allowSelf?: boolean;
  edgeId?: (connection: Connection) => string;
}
export function connectDiagram<D extends AppNodeData>(graph: Diagram<D>, connection: Connection, rules: ConnectionRules = {}): Diagram<D> {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target || graph.edges.length >= (rules.maxEdges ?? 400) || rules.allowSelf === false && source === target) return graph;
  if (!graph.nodes.some(n => n.id === source && n.connectable !== false) || !graph.nodes.some(n => n.id === target && n.connectable !== false)) return graph;
  if (graph.edges.some(e => e.source === source && e.target === target && (e.sourceHandle ?? null) === (sourceHandle ?? null) && (e.targetHandle ?? null) === (targetHandle ?? null))) return graph;
  const edge: Edge = { ...connection, source, target, id: rules.edgeId?.(connection) ?? `reactflow__edge-${source}${sourceHandle ?? ''}-${target}${targetHandle ?? ''}` };
  return { ...graph, edges: [...graph.edges, edge] };
}
export function insertDiagramNode<D extends AppNodeData>(graph: Diagram<D>, node: Node<D>): Diagram<D> {
  if (graph.nodes.some(n => n.id === node.id)) return graph;
  return { nodes: [...graph.nodes.map(n => ({ ...n, selected: false })), { ...node, selected: true }], edges: graph.edges.map(e => ({ ...e, selected: false })) };
}
export function connectionTargets<D extends AppNodeData>(graph: Diagram<D>, source: string) {
  return graph.nodes.filter(n => n.id !== source && n.type !== 'group' && n.connectable !== false && !graph.edges.some(e => e.source === source && e.target === n.id));
}
