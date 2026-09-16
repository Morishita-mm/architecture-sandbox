import type { Node } from 'reactflow';
import type { AppNodeData } from '../types.ts';
import type { Diagram } from './diagramHistory.ts';
import { componentStages } from '../constants/componentStages.ts';
import { partName, partRole } from './courseDiagram.ts';
import type { CourseDiagram, CoursePart, PartType } from './courseDiagram.ts';

/** Editor-only metadata. The v4 adapter below stores only the existing course fields. */
export interface CourseEditorData extends AppNodeData { courseKind: PartType; stopped: boolean }
export function courseNodeData(part: CoursePart): AppNodeData {
  return { label: partName(part), originalType: part.kind === 'responder' ? '教材の応答先' : componentStages[part.kind].component, description: partRole(part.kind) };
}
export function courseEditorNode(part: CoursePart): Node<CourseEditorData> {
  return { id: part.id, type: 'custom', position: { x: part.x, y: part.y }, data: { ...courseNodeData(part), courseKind: part.kind, stopped: part.stopped },
    ariaLabel: partName(part), deletable: part.kind !== 'responder', draggable: part.kind !== 'responder' };
}
export function toCourseEditor(g: CourseDiagram): Diagram<CourseEditorData> {
  return { nodes: g.nodes.map(courseEditorNode), edges: g.edges.map(e => ({ ...e })) };
}
export function fromCourseEditor(g: Diagram<CourseEditorData>, checked: string | null): CourseDiagram {
  return { nodes: g.nodes.map(n => ({ id: n.id, kind: n.data.courseKind, x: n.position.x, y: n.position.y, stopped: n.data.stopped })),
    edges: g.edges.map(e => ({ id: e.id, source: e.source, target: e.target })), checked };
}
