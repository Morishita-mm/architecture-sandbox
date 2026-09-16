import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagramReducer, diagramKey } from '../src/utils/diagramHistory.ts';
import { evaluationKey } from '../src/utils/designSnapshot.ts';
import { componentGuides, basicComponents } from '../src/constants/componentGuides.ts';
import { componentExamples } from '../src/constants/componentExamples.ts';
import defs from '../src/constants/architecture_defs.json' with { type: 'json' };

const node = (id, parentNode) => ({ id, type: 'custom', position: { x: 0, y: 0 }, data: { originalType: 'App Server', label: id }, ...(parentNode ? { parentNode } : {}) });
const initial = () => ({ present: { nodes: [node('app'), node('db')], edges: [{ id: 'link', source: 'app', target: 'db' }] }, past: [], future: [], group: null });

test('undo restores a deleted node and its connections together, redo removes both', () => {
  const start = initial();
  const removed = diagramReducer(start, { type: 'change', update: graph => ({ ...graph, nodes: graph.nodes.filter(n => n.id !== 'db') }) });
  assert.deepEqual(removed.present.edges, []);
  const undone = diagramReducer(removed, { type: 'undo' });
  assert.deepEqual(undone.present, start.present);
  assert.equal(diagramReducer(undone, { type: 'redo' }).present.nodes.length, 1);
  assert.equal(start.present.edges.length, 1, 'the earlier graph is never mutated');
});

test('edges-first deletion callbacks form one undo step and the next deletion is separate', () => {
  const start = initial();
  let state = diagramReducer(start, { type: 'change', group: 'delete', update: graph => ({ ...graph, edges: [] }) });
  state = diagramReducer(state, { type: 'change', group: 'delete', update: graph => ({ ...graph, nodes: graph.nodes.filter(n => n.id !== 'db') }) });
  state = diagramReducer(state, { type: 'finish' });
  assert.equal(state.past.length, 1);
  assert.deepEqual(diagramReducer(state, { type: 'undo' }).present, start.present);
  state = diagramReducer(state, { type: 'change', group: 'delete', update: graph => ({ ...graph, nodes: [] }) });
  state = diagramReducer(state, { type: 'finish' });
  assert.equal(state.past.length, 2);
  assert.equal(diagramReducer(state, { type: 'undo' }).present.nodes.length, 1);
});

test('a drag is one undo step, selection does not create a step or discard redo', () => {
  let state = initial();
  for (const x of [10, 20, 30]) state = diagramReducer(state, { type: 'change', group: 'drag', update: graph => ({ ...graph, nodes: graph.nodes.map(n => ({ ...n, position: { x, y: 0 } })) }) });
  state = diagramReducer(state, { type: 'finish' });
  assert.equal(state.past.length, 1);
  state = diagramReducer(state, { type: 'undo' });
  state = diagramReducer(state, { type: 'change', update: graph => ({ ...graph, nodes: graph.nodes.map(n => ({ ...n, selected: true })) }) });
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 1);
  assert.equal(diagramReducer(state, { type: 'redo' }).present.nodes[0].position.x, 30);
});

test('editing after undo discards redo, and independent operations are capped at 50', () => {
  let state = initial();
  for (let x = 1; x <= 60; x++) state = diagramReducer(state, { type: 'change', update: graph => ({ ...graph, nodes: graph.nodes.map(n => ({ ...n, position: { x, y: 0 } })) }) });
  assert.equal(state.past.length, 50);
  state = diagramReducer(state, { type: 'undo' });
  state = diagramReducer(state, { type: 'change', update: graph => ({ ...graph, edges: [] }) });
  assert.equal(state.future.length, 0);
});

test('group resizing and parent changes are undoable but measured regular-node sizes are not', () => {
  const graph = initial().present;
  assert.equal(diagramKey(graph), diagramKey({ ...graph, nodes: graph.nodes.map(n => ({ ...n, width: 150, height: 60 })) }));
  const group = { ...node('group'), type: 'group', style: { width: 300, height: 200 } };
  assert.notEqual(diagramKey({ nodes: [group], edges: [] }), diagramKey({ nodes: [{ ...group, width: 400 }], edges: [] }));
});

test('evaluation provenance ignores layout and order, but detects data, topology and containment edits', () => {
  const scenario = { id: 'internal_tool', title: '勤怠', description: '' };
  const graph = initial().present;
  const original = evaluationKey(scenario, graph);
  assert.equal(original, evaluationKey(scenario, { ...graph, nodes: graph.nodes.toReversed().map(n => ({ ...n, position: { x: 99, y: 20 }, selected: true })) }));
  for (const edited of [
    { ...graph, edges: [] },
    { ...graph, nodes: graph.nodes.map(n => ({ ...n, data: { ...n.data, description: 'バックアップを保存する' } })) },
    { ...graph, nodes: graph.nodes.map(n => ({ ...n, parentNode: 'zone' })) },
  ]) assert.notEqual(original, evaluationKey(scenario, edited));
});

test('every allowed component has teaching material and every basic item is supported', () => {
  const types = defs.categories.flatMap(category => category.items.map(item => item.type));
  assert.deepEqual(Object.keys(componentGuides).sort(), [...types].sort());
  for (const guide of Object.values(componentGuides)) for (const field of ['name', 'role', 'when', 'caution', 'question']) assert.ok(guide[field].trim());
  assert.equal(basicComponents.size, 8);
  for (const type of basicComponents) assert.ok(types.includes(type));
});

test('every component has an example with supported nodes and labelled relationships', () => {
  const types = defs.categories.flatMap(category => category.items.map(item => item.type));
  assert.deepEqual(Object.keys(componentExamples).sort(), [...types].sort());
  for (const [type, example] of Object.entries(componentExamples)) {
    assert.ok(example.caption.trim(), type);
    assert.ok(example.stages.length > 0, type);
    assert.equal(example.links.length, example.stages.length - 1, type);
    for (const link of example.links) assert.ok(link.trim(), type);
    for (const stage of example.stages) {
      assert.ok(stage.length > 0, type);
      for (const node of stage) assert.ok(types.includes(node), `${type}: ${node}`);
    }
    assert.ok(example.stages.flat().includes(type) || example.scope === type, type);
    if (example.scope) assert.ok(types.includes(example.scope), type);
  }
  assert.equal(componentExamples['Security Group'].association, true);
  assert.equal(componentExamples['WAF (Firewall)'].association, true);
  assert.deepEqual(componentExamples['DNS (Route53)'].stages.flat(), ['Web Browser', 'DNS (Route53)']);
  assert.equal(componentExamples['Load Balancer'].stages.at(-1).length, 2);
  assert.equal(componentExamples['Pub/Sub'].stages.at(-1).length, 2);
});
