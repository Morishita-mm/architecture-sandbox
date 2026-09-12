import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { normalizeProject, parseProject, serializeProject, parseChallenge, createChallengeUrl, parseEvaluation, chatContext, MAX_FILE_BYTES } from '../src/utils/projectFormat.ts';

const result = { totalScore: 0, details: { availability: 0, scalability: 10, security: 20, maintainability: 30, costEfficiency: 40, feasibility: 50 }, feedback: '説明', improvement: '改善' };
const node = { id: 'dndnode_0', type: 'custom', position: { x: 10, y: 20 }, data: { label: 'ブラウザ', originalType: 'Web Browser', description: '日本語の説明' } };
const project = () => ({ schemaVersion: 2, version: '1.0', timestamp: '2026-09-13T00:00:00.000Z', projectId: 'existing-project-id', scenario: { id: 'custom', title: '注文サイト', description: '画像付き商品の売買', isCustom: true, difficulty: 'small', partnerRole: 'cto' }, memo: '検証メモ', diagram: { nodes: [structuredClone(node)], edges: [] }, chatHistory: [{ role: 'user', content: '必要な条件は？' }, { role: 'model', content: 'ご相談ください' }], evaluation: structuredClone(result) });

test('readable JSON round trip preserves identity, Japanese content, diagram and zero scores', () => {
  const normalized = normalizeProject(project());
  const json = serializeProject(normalized);
  assert.match(json, /^\{/); assert.match(json, /注文サイト/);
  assert.deepEqual(parseProject(json), normalized);
  assert.equal(parseProject(json).evaluation.totalScore, 0);
});
test('legacy Base64 import removes hidden fields and system prompts; new saves never reintroduce them', () => {
  const old = project(); delete old.schemaVersion;
  old.scenario.requirements = { users: 'SECRET_USERS' };
  old.chatHistory.unshift({ role: 'system', content: 'SECRET_PROMPT' });
  old.extra = 'SECRET_OTHER';
  const imported = parseProject(Buffer.from(JSON.stringify(old)).toString('base64'));
  const saved = serializeProject(imported);
  assert.doesNotMatch(saved, /SECRET_|requirements|"system"/);
  assert.equal(imported.projectId, old.projectId);
  assert.equal(imported.chatHistory.length, 2);
});
test('legacy partial evaluations do not prevent recovering a project', () => {
  const old = project(); delete old.schemaVersion;
  old.evaluation = { score: 0, feedback: 'partial response' };
  assert.equal(normalizeProject(old).evaluation, null);
  assert.throws(() => normalizeProject({ ...old, schemaVersion: 2 }));
});
test('group hierarchy is ordered and saved, arbitrary style and extra fields are discarded', () => {
  const p = project(); p.diagram.nodes[0].parentNode = 'group';
  p.diagram.nodes[0].data.html = '<script>alert(1)</script>';
  p.diagram.nodes.push({ id: 'group', type: 'group', position: { x: 40, y: 60 }, data: { label: 'VPC', originalType: 'VPC (Network)' }, style: { width: 400, height: 300, backgroundImage: 'url(https://tracker.example)', position: 'fixed' } });
  const loaded = normalizeProject(p);
  assert.equal(loaded.diagram.nodes[0].id, 'group');
  assert.equal(loaded.diagram.nodes[1].parentNode, 'group');
  assert.equal(loaded.diagram.nodes[1].extent, 'parent');
  assert.doesNotMatch(JSON.stringify(loaded), /tracker|<script>|fixed/);
  assert.deepEqual(parseProject(serializeProject(loaded)), loaded);
});
for (const [name, mutate] of [
  ['unknown schema', p => { p.schemaVersion = 3; }],
  ['duplicate node id', p => { p.diagram.nodes.push(structuredClone(p.diagram.nodes[0])); }],
  ['dangling parent', p => { p.diagram.nodes[0].parentNode = 'missing'; }],
  ['parent cycle', p => { p.diagram.nodes[0].type = 'group'; p.diagram.nodes[0].data.originalType = 'Subnet'; p.diagram.nodes[0].parentNode = p.diagram.nodes[0].id; }],
  ['dangling edge', p => { p.diagram.edges.push({ source: 'dndnode_0', target: 'missing' }); }],
  ['invalid position', p => { p.diagram.nodes[0].position.x = NaN; }],
  ['unknown component', p => { p.diagram.nodes[0].data.originalType = '__proto__'; }],
  ['unsafe color', p => { p.diagram.nodes[0].data.customColor = 'url(https://tracker.example)'; }],
  ['negative dimension', p => { p.diagram.nodes[0].style = { width: -10 }; }],
  ['invalid chat role', p => { p.chatHistory[0].role = 'assistant'; }],
  ['oversized message', p => { p.chatHistory[0].content = 'x'.repeat(4001); }],
  ['invalid difficulty', p => { p.scenario.difficulty = '__proto__'; }],
  ['invalid role', p => { p.scenario.partnerRole = '__proto__'; }],
  ['oversized graph', p => { p.diagram.nodes = Array(201).fill(node); }],
]) test(`rejects ${name}`, () => { const p = project(); mutate(p); assert.throws(() => normalizeProject(p)); });

test('oversized and malformed files/links are rejected', () => {
  for (const text of ['null', '{}', 'not base64', 'x'.repeat(MAX_FILE_BYTES + 1)]) assert.throws(() => parseProject(text));
  assert.throws(() => parseChallenge('x'.repeat(24001)));
});
test('public challenge round trips maintain preset identity and remove hidden requirements', () => {
  const scenario = { id: 'internal_tool', title: 'forged', description: 'forged', requirements: { users: 'SECRET' } };
  const url = new URL(createChallengeUrl(scenario, 'https://sandbox.morimizu.dev'));
  const decoded = parseChallenge(url.searchParams.get('challenge'));
  assert.equal(decoded.id, 'internal_tool'); assert.equal(decoded.isCustom, undefined);
  assert.doesNotMatch(url.toString(), /SECRET|requirements|forged/);
  assert.match(url.searchParams.get('challenge'), /^\{/);
});
test('custom and legacy challenge links retain difficulty/role, recover preset shares', () => {
  const custom = project().scenario;
  assert.deepEqual(parseChallenge(new URL(createChallengeUrl(custom, 'https://sandbox.morimizu.dev')).searchParams.get('challenge')), custom);
  const old = { ...custom, id: 'challenge_123', requirements: { users: 'SECRET' } };
  assert.deepEqual(parseChallenge(Buffer.from(JSON.stringify(old)).toString('base64')), custom);
  assert.equal(parseChallenge(Buffer.from(JSON.stringify({ ...old, title: '社内勤怠管理システム' })).toString('base64')).id, 'internal_tool');
});
test('invalid and out-of-range AI scores cannot reach the report', () => {
  for (const value of [null, { score: 0 }, { ...result, totalScore: 101 }, { ...result, totalScore: 0.5 }, { ...result, details: [] }]) assert.throws(() => parseEvaluation(value));
});
test('bounded AI context retains the latest user turn without mutating saved history', () => {
  const messages = Array.from({ length: 200 }, (_, i) => ({ role: i === 199 ? 'user' : 'model', content: String(i).padEnd(4000, 'a') }));
  const context = chatContext(messages);
  assert.equal(context.length, 6); assert.equal(context.at(-1), messages.at(-1)); assert.equal(messages.length, 200);
});
test('frontend source no longer embeds hidden requirements or client system prompts', async () => {
  const source = await readFile(new URL('../src/scenarios.ts', import.meta.url), 'utf8') + await readFile(new URL('../src/components/ArchitectureCanvas.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Hidden_Context|difficultySpecs|role: "system"|1000万|50万円|5,000円|1 Million DAU/);
});
