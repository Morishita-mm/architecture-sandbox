import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectDiagram, insertDiagramNode, connectionTargets } from '../src/utils/diagramEditing.ts';
import { diagramReducer } from '../src/utils/diagramHistory.ts';
import { toCourseEditor, fromCourseEditor } from '../src/utils/courseEditor.ts';
import { newDiagram, addPart } from '../src/utils/courseDiagram.ts';
import { newStageProgress } from '../src/utils/componentStages.ts';
import { createCourseProject } from '../src/utils/courseProject.ts';

const node = (id, extra = {}) => ({ id, type: 'custom', position: { x: 0, y: 0 }, data: { label: id, originalType: 'App Server' }, ...extra });
const connection = (source, target, extra = {}) => ({ source, target, sourceHandle: null, targetHandle: null, ...extra });
const history = present => ({ present, past: [], future: [], group: null });

test('shared connections reject absent endpoints, duplicates and limits while keeping course rules local', () => {
  const g = { nodes: [node('a'), node('b'), node('group', { type: 'group', connectable: false })], edges: [] };
  for (const c of [connection(null, 'b'), connection('a', 'missing'), connection('a', 'group')]) assert.equal(connectDiagram(g, c), g);
  const connected = connectDiagram(g, connection('a', 'b'));
  assert.equal(connected.edges[0].id, 'reactflow__edge-a-b');
  assert.equal(connectDiagram(connected, connection('a', 'b', { sourceHandle: undefined })), connected);
  assert.equal(connectDiagram(connected, connection('b', 'a'), { maxEdges: 1 }), connected);
  assert.equal(connectDiagram(g, connection('a', 'a'), { allowSelf: false }), g);
  assert.equal(connectDiagram(g, connection('a', 'a')).edges.length, 1);
  const course = connectDiagram(g, connection('a', 'b'), { edgeId: c => `${c.source}--${c.target}` });
  assert.equal(course.edges[0].id, 'a--b');
  assert.equal(g.edges.length, 0);
});

test('adding a part changes selection once and can be undone without deleting the old selection', () => {
  const g = { nodes: [node('a', { selected: true }), node('b')], edges: [{ id: 'ab', source: 'a', target: 'b', selected: true }] };
  const next = diagramReducer(history(g), { type: 'change', update: g => insertDiagramNode(g, node('c')) });
  assert.deepEqual(next.present.nodes.filter(n => n.selected).map(n => n.id), ['c']);
  assert.equal(next.present.edges[0].selected, false);
  assert.equal(next.past.length, 1);
  assert.deepEqual(diagramReducer(next, { type: 'undo' }).present, g);
  assert.equal(g.nodes[0].selected, true);
  assert.equal(insertDiagramNode(g, node('a')), g);
});

test('connection forms share targets that exclude source, groups, locked parts and existing routes', () => {
  const g = { nodes: [node('a'), node('b'), node('c'), node('group', { type: 'group' }), node('locked', { connectable: false })], edges: [{ id: 'ab', source: 'a', target: 'b' }] };
  assert.deepEqual(connectionTargets(g, 'a').map(n => n.id), ['c']);
});

test('course adapters preserve v4 positions, stops, edge identity and checks without saving editor metadata', () => {
  const g = addPart(newDiagram('worker-practice'), 'worker', 'worker', { x: -327, y: 140 });
  g.checked = 'previous-check';
  const editor = toCourseEditor(g);
  editor.nodes[0] = { ...editor.nodes[0], selected: true, width: 180, height: 70, dragging: false };
  editor.edges = editor.edges.map(e => ({ ...e, selected: true, animated: true, sourceHandle: null, targetHandle: null }));
  assert.deepEqual(fromCourseEditor(editor, g.checked), g);
  assert.ok(editor.nodes.every(n => n.type === 'custom'));
  assert.equal(editor.nodes.find(n => n.id === 'worker-1').data.stopped, true);
  const fixture = toCourseEditor(newDiagram('browser-learn')).nodes.find(n => n.id === 'responder');
  assert.equal(fixture.deletable, false); assert.equal(fixture.draggable, false);
});

test('stopping a course part uses the shared history and round trips through undo and redo', () => {
  const g = toCourseEditor(addPart(newDiagram('worker-practice'), 'worker', 'worker'));
  const changed = diagramReducer(history(g), { type: 'change', update: g => ({ ...g, nodes: g.nodes.map(n => n.id === 'worker-1' ? { ...n, data: { ...n.data, stopped: false } } : n) }) });
  assert.equal(changed.present.nodes.at(-1).data.stopped, false);
  const undone = diagramReducer(changed, { type: 'undo' });
  assert.equal(undone.present.nodes.at(-1).data.stopped, true);
  assert.deepEqual(diagramReducer(undone, { type: 'redo' }).present, changed.present);
});

test('graduation exports the same shared node data without course-only flags or fixtures', () => {
  const g = newDiagram('browser-learn');
  const p = createCourseProject(newStageProgress().learning.labs.design, 'test', '2026-09-15T00:00:00Z', g);
  assert.equal(p.diagram.nodes.length, 1);
  const editorData = { ...toCourseEditor(g).nodes[0].data };
  delete editorData.courseKind; delete editorData.stopped;
  assert.deepEqual(p.diagram.nodes[0].data, editorData);
  assert.equal(p.schemaVersion, 3);
});
