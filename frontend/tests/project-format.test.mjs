import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { normalizeProject, parseProject, serializeProject, parseChallenge, createChallengeUrl, parseEvaluation, chatContext, MAX_FILE_BYTES } from '../src/utils/projectFormat.ts';
import { SCENARIOS, startFixedScenario } from '../src/scenarios.ts';

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
  ['unknown schema', p => { p.schemaVersion = 5; }],
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
test('new fixed attempts choose one stable case and preserve agreed specification revisions', () => {
  const base = SCENARIOS.find(item => item.id === 'internal_tool');
  assert.deepEqual([0, 1, 2].map(index => startFixedScenario(base, index).profileId), ['attendance-office', 'attendance-shift', 'attendance-field']);
  const scenario = { ...startFixedScenario(base, 1), acceptedNegotiationIds: ['attendance-shift-report-8am'], specificationVersion: 2 };
  const p = project();
  p.scenario = scenario;
  p.requirementRevisions = [{
    version: 2, acceptedAt: '2026-09-16T05:00:00Z', optionId: 'attendance-shift-report-8am', conditionId: 'response', label: '応答時間',
    currentValue: '日次集計は翌朝6時まで', proposedValue: '日次集計は翌朝8時まで',
  }];
  const normalized = normalizeProject(p);
  assert.equal(normalized.schemaVersion, 4);
  assert.deepEqual(parseProject(serializeProject(normalized)), normalized);
  assert.deepEqual(parseChallenge(new URL(createChallengeUrl(scenario, 'https://sandbox.morimizu.dev')).searchParams.get('challenge')), scenario);
  for (const invalid of [
    { ...scenario, profileId: 'sns-live-event' },
    { ...scenario, acceptedNegotiationIds: ['attendance-field-sync-15m'] },
    { ...scenario, specificationVersion: 1 },
  ]) assert.throws(() => normalizeProject({ ...p, scenario: invalid }));
  assert.throws(() => normalizeProject({ ...p, requirementRevisions: [] }));
});
test('custom and legacy challenge links retain difficulty/role, recover preset shares', () => {
  const custom = project().scenario;
  assert.deepEqual(parseChallenge(new URL(createChallengeUrl(custom, 'https://sandbox.morimizu.dev')).searchParams.get('challenge')), custom);
  const old = { ...custom, id: 'challenge_123', requirements: { users: 'SECRET' } };
  assert.deepEqual(parseChallenge(Buffer.from(JSON.stringify(old)).toString('base64')), custom);
  assert.equal(parseChallenge(Buffer.from(JSON.stringify({ ...old, title: '社内勤怠管理システム' })).toString('base64')).id, 'internal_tool');
});
test('guided and self-defined custom modes round trip without mixing their fields', () => {
  const guided = { id: 'custom', title: 'フリマ', description: '利用者が商品を売買する', isCustom: true, difficulty: 'large', partnerRole: 'cto', customMode: 'guided', scenarioFamily: 'transaction' };
  const selfDefined = { id: 'custom', title: '社内検索', description: '社員が資料を検索する。保存期間は未定。', isCustom: true, partnerRole: 'ceo', customMode: 'self_defined' };
  for (const scenario of [guided, selfDefined]) {
    const p = project(); p.scenario = scenario;
    const normalized = normalizeProject(p);
    assert.equal(normalized.schemaVersion, 3);
    assert.deepEqual(normalized.scenario, scenario);
    assert.deepEqual(parseChallenge(new URL(createChallengeUrl(scenario, 'https://sandbox.morimizu.dev')).searchParams.get('challenge')), scenario);
  }
  for (const scenario of [
    { ...guided, scenarioFamily: undefined },
    { ...guided, scenarioFamily: '__proto__' },
    { ...selfDefined, scenarioFamily: 'business' },
    { ...guided, customMode: 'invented' },
  ]) assert.throws(() => normalizeProject({ ...project(), scenario }));
});
test('interview evidence round trips with its exact question and answer and changes evaluation identity', async () => {
  const p = project();
  p.interviewEvidence = [{ conditionId: 'users', label: '利用者と利用時間', question: p.chatHistory[0].content, answer: p.chatHistory[1].content, questionMessageIndex: 0, answerMessageIndex: 1 }];
  const normalized = normalizeProject(p);
  assert.equal(normalized.schemaVersion, 3);
  assert.deepEqual(parseProject(serializeProject(normalized)).interviewEvidence, p.interviewEvidence);
  for (const invalid of [
    { ...p.interviewEvidence[0], conditionId: '' },
    { ...p.interviewEvidence[0], question: '別の質問' },
    { ...p.interviewEvidence[0], questionMessageIndex: 1 },
    { ...p.interviewEvidence[0], answerMessageIndex: 0 },
  ]) assert.throws(() => normalizeProject({ ...p, interviewEvidence: [invalid] }));
});
test('invalid and out-of-range AI scores cannot reach the report', () => {
  for (const value of [null, { score: 0 }, { ...result, totalScore: 101 }, { ...result, totalScore: 0.5 }, { ...result, details: [] }]) assert.throws(() => parseEvaluation(value));
});
test('interview assessment counts must match their condition lists', () => {
  const interview = { confirmed: 1, total: 2, confirmedConditions: [{ id: 'users', label: '利用者' }], missingConditions: [{ id: 'traffic', label: '利用量' }] };
  assert.deepEqual(parseEvaluation({ ...result, interview }).interview, interview);
  assert.throws(() => parseEvaluation({ ...result, interview: { ...interview, confirmed: 2 } }));
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


test('all accepted history fits a save, including multibyte text past the old 2MiB limit', () => {
  const p = project();
  p.chatHistory = Array.from({ length: 1000 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', content: 'あ'.repeat(4000) }));
  const json = serializeProject(p);
  assert.ok(Buffer.byteLength(json) > 2 * 1024 * 1024);
  assert.ok(Buffer.byteLength(json) < MAX_FILE_BYTES);
  assert.deepEqual(parseProject(json), normalizeProject(p));
  p.chatHistory.push({ role: 'user', content: '上限超過' });
  assert.throws(() => serializeProject(p));
});

test('the file bound covers worst-case JSON escaping at all large schema limits', () => {
  const p = project();
  const escaped = '\u0001';
  p.chatHistory = Array.from({ length: 1000 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', content: escaped.repeat(4000) }));
  p.memo = escaped.repeat(100000);
  p.diagram.nodes = Array.from({ length: 200 }, (_, i) => ({ ...structuredClone(node), id: String(i).padEnd(100, escaped), data: { ...node.data, label: escaped.repeat(120), description: escaped.repeat(2000) } }));
  p.diagram.edges = Array.from({ length: 400 }, (_, i) => ({ id: String(i).padEnd(250, escaped), source: p.diagram.nodes[i % 200].id, target: p.diagram.nodes[(i + 1) % 200].id }));
  p.evaluation.feedback = p.evaluation.improvement = escaped.repeat(12000);
  const json = serializeProject(p);
  assert.ok(Buffer.byteLength(json) < MAX_FILE_BYTES);
  assert.deepEqual(parseProject(json), normalizeProject(p));
});
