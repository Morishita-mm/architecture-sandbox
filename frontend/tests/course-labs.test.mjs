import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labIds, labLessons } from '../src/constants/courseCurriculum.ts';
import { newLab, runLab, estimateLoad, routeLoad, evaluateDesign, labComplete, parseLab } from '../src/utils/courseLabs.ts';
import { COURSE_STORAGE_KEY, LEGACY_COURSE_STORAGE_KEY, newCourse, parseCourse, readCourse, courseLessonComplete } from '../src/utils/learningCourse.ts';
import { createCourseProject } from '../src/utils/courseProject.ts';
import { parseProject, serializeProject } from '../src/utils/projectFormat.ts';
const act = (state, ...actions) => actions.reduce((s, action) => runLab(s, action).state, state);

test('daily demand is converted to seconds before applying a peak factor; controls alone do not complete observations', () => {
  let s = { ...newLab('estimate'), users: 10000, requestsPerDay: 20, peakFactor: 1 };
  assert.equal(estimateLoad(s).daily, 200000);
  assert.equal(estimateLoad(s).average, 200000 / 86400);
  s = act(s, 'run');
  s = { ...s, peakFactor: 10, answer: 'peak' };
  assert.equal(estimateLoad(s).peak, 200000 / 86400 * 10);
  assert.equal(labComplete(s), false);
  assert.equal(labComplete(act(s, 'run')), true);
});

test('more servers only help with routing; a detected failure reduces capacity, and the DB can bottleneck', () => {
  const initial = newLab('balance');
  assert.equal(routeLoad(initial).completed, 6);
  assert.equal(routeLoad({ ...initial, servers: 2 }).completed, 6);
  assert.equal(routeLoad({ ...initial, servers: 2, balanced: true }).completed, 12);
  assert.equal(routeLoad({ ...initial, servers: 2, stopped: true }).completed, 0);
  const failed = routeLoad({ ...initial, servers: 2, balanced: true, stopped: true });
  assert.equal(failed.completed, 6); assert.equal(failed.unprocessed, 6);
  const db = routeLoad({ ...initial, servers: 2, balanced: true, dbCapacity: 8 });
  assert.equal(db.completed, 8); assert.equal(db.dbLimited, true);
  let s = act(initial, 'run');
  s = act({ ...s, servers: 2, balanced: true }, 'run');
  s = act({ ...s, stopped: true, load: 6, answer: 'route' }, 'run');
  assert.equal(labComplete(s), true);
});

test('cache hits skip DB reads; DB writes keep a stale copy until invalidation and re-read', () => {
  let s = act(newLab('cache'), 'read');
  assert.equal(s.dbReads, 1);
  s = act({ ...s, enabled: true }, 'read', 'read');
  assert.equal(s.dbReads, 2); assert.equal(s.hits, 1);
  s = act(s, 'write', 'read');
  assert.equal(s.origin, '集合は12時です'); assert.equal(s.displayed, '集合は10時です');
  const original = structuredClone(s);
  s = act(s, 'invalidate');
  assert.equal(s.origin, original.origin); assert.equal(s.cached, null);
  assert.equal(s.displayed, '集合は10時です');
  assert.equal(labComplete({ ...s, answer: 'freshness' }), false);
  s = act(s, 'read');
  assert.equal(s.displayed, s.origin); assert.equal(s.dbReads, 3);
  assert.equal(labComplete({ ...s, answer: 'freshness' }), true);
  assert.equal(original.cached, '集合は10時です');
});

test('queue acceptance is separate from completion and stopped workers retain work', () => {
  let s = act(newLab('queue'), 'submit');
  assert.equal(s.deliveries, 1);
  s = act({ ...s, enabled: true, workerRunning: false }, 'submit', 'work');
  assert.deepEqual(s.pending, [2]); assert.equal(s.deliveries, 1);
  s = act({ ...s, workerRunning: true }, 'work', 'replay', 'work');
  assert.equal(s.deliveries, 3); assert.deepEqual(s.completed, [1, 2]);
  s = act({ ...s, deduplicate: true }, 'replay', 'work');
  assert.equal(s.deliveries, 3); assert.equal(s.pending.length, 0);
  assert.equal(labComplete({ ...s, answer: 'retry' }), true);
  const disabled = act({ ...s, enabled: true }, 'submit');
  assert.equal(act({ ...disabled, enabled: false }, 'work').pending.length, 0);
});

test('queue capacity preserves accepted work and IDs; restored pending jobs can be processed once', () => {
  let s = { ...newLab('queue'), enabled: true };
  for (let i = 0; i < 25; i++) s = act(s, 'submit');
  assert.equal(s.pending.length, 20); assert.equal(s.nextId, 21);
  s = parseLab('queue', s);
  s = act(s, 'work');
  assert.equal(s.pending.length, 19); assert.deepEqual(s.completed, [1]);
  s = act(s, 'submit'); assert.equal(s.pending.at(-1), 21);
  assert.throws(() => parseLab('queue', { ...s, completed: [1, 1] }));
  assert.throws(() => parseLab('queue', { ...s, pending: [s.nextId] }));
});

test('rate tokens are consumed across requests, refill with time, and are capped; rejected requests remain client-side', () => {
  let s = act(newLab('rate'), 'run');
  assert.equal(s.appRemaining, 0); assert.equal(s.retryWaiting, 0);
  s = act({ ...s, enabled: true }, 'advance', 'run');
  assert.equal(s.tokens, 0); assert.equal(s.retryWaiting, 2);
  s = act(s, 'retry');
  assert.equal(s.retryWaiting, 2); assert.equal(s.tokens, 0);
  s = act(s, 'advance', 'retry');
  assert.equal(s.retryWaiting, 0); assert.equal(s.tokens, 0); assert.equal(s.appRemaining, 1);
  assert.equal(labComplete({ ...s, answer: 'client' }), true);
  s = act(s, 'advance', 'advance', 'advance'); assert.equal(s.tokens, 3);
  s = act({ ...s, batch: 2 }, 'run'); assert.equal(s.tokens, 1);
  const sameTick = act(s, 'run'); assert.equal(sameTick.tokens, 0); assert.equal(sameTick.retryWaiting, 1);
  assert.equal(sameTick.appRemaining, 0);
});

test('capstone accepts multiple sufficient designs but requires comparison, reflection, and current verified configuration', () => {
  let s = { ...newLab('design'), reason: '利用量が小さいため', tradeoff: 'DBの停止には未対応', answer: 'requirements' };
  assert.equal(evaluateDesign(s).meets, true);
  s = act(s, 'run'); assert.equal(labComplete(s), false);
  s = act({ ...s, cache: true }, 'run'); assert.equal(labComplete(s), true);
  assert.equal(evaluateDesign(s).dbReads, 2);
  assert.equal(labComplete({ ...s, reason: ' ' }), false);
  assert.equal(labComplete({ ...s, cache: false }), false);
  s = act({ ...s, cache: false }, 'run'); assert.equal(labComplete(s), true);
  s = act({ ...s, objective: 'peak' }, 'run'); assert.equal(labComplete(s), false);
  s = act({ ...s, servers: 2, balanced: true }, 'run'); assert.equal(labComplete(s), true);
  assert.equal(evaluateDesign({ ...s, queue: true }).completed, 12);
  assert.equal(evaluateDesign({ ...s, limit: true }).meets, false);
  assert.equal(evaluateDesign({ ...s, objective: 'continuity' }).completed, 4);
  assert.equal(evaluateDesign({ ...s, objective: 'continuity', balanced: false }).completed, 0);
});

test('capstone export retains design reasons, uses parallel branches and real known components, and round trips project JSON', () => {
  const s = { ...newLab('design'), servers: 2, balanced: true, cache: true, queue: true, limit: true, reason: '試した理由', tradeoff: '残る問題' };
  const before = structuredClone(s);
  const p = createCourseProject(s, 'independent-new-project', '2026-09-15T00:00:00.000Z');
  const restored = parseProject(serializeProject(p));
  assert.equal(restored.projectId, 'independent-new-project');
  assert.match(restored.memo, /試した理由/); assert.match(restored.memo, /残る問題/);
  assert.equal(restored.diagram.nodes.length, evaluateDesign(s).components);
  assert.ok(restored.diagram.edges.some(e => e.source === 'balancer' && e.target === 'app-b'));
  assert.ok(!restored.diagram.edges.some(e => e.source === 'app-a' && e.target === 'app-b'));
  assert.ok(restored.diagram.edges.some(e => e.source === 'queue' && e.target === 'worker' && e.data.mode === 'async'));
  assert.deepEqual(s, before);
  assert.equal(restored.evaluation, null); assert.deepEqual(restored.chatHistory, []);
  const unrouted = createCourseProject({ ...s, balanced: false }, 'new-project-2', p.timestamp);
  assert.ok(unrouted.diagram.nodes.some(n => n.id === 'app-b'));
  assert.ok(!unrouted.diagram.edges.some(e => e.target === 'app-b'));
});

test('v1 migration retains both lessons and starts six new chapters without overwriting the old record', () => {
  const source = newCourse();
  source.lessons.request = { ...source.lessons.request, draft: '以前の入力', sawDelivered: true, sawBlocked: true, answer: 'process' };
  const legacy = JSON.stringify({ version: 1, current: 'storage', lessons: source.lessons });
  const oldStorage = globalThis.localStorage;
  const values = new Map([[LEGACY_COURSE_STORAGE_KEY, legacy]]);
  globalThis.localStorage = { getItem: key => values.get(key) ?? null };
  try {
    const restored = readCourse();
    assert.equal(restored.error, ''); assert.equal(restored.progress.version, 2);
    assert.equal(restored.progress.current, 'storage');
    assert.deepEqual(restored.progress.lessons, source.lessons);
    assert.equal(courseLessonComplete(restored.progress, 'request'), true);
    for (const id of labIds) assert.deepEqual(restored.progress.labs[id], newLab(id));
    assert.equal(values.get(LEGACY_COURSE_STORAGE_KEY), legacy); assert.equal(values.has(COURSE_STORAGE_KEY), false);
    values.set(COURSE_STORAGE_KEY, '{broken');
    assert.ok(readCourse().error); // Never silently prefer an older backup over a corrupt new record.
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});

test('all labs round trip bounded state, discard unknown fields, and reject corrupt or future versions', () => {
  const p = newCourse();
  for (const id of labIds) {
    p.labs[id] = act(newLab(id), id === 'queue' ? 'submit' : id === 'cache' ? 'read' : 'run');
    p.labs[id].answer = labLessons[id].correct;
    p.current = id;
    assert.deepEqual(parseCourse(JSON.stringify(p)), p);
    const unknown = { ...p.labs[id], unknown: 'ignore' };
    assert.equal(parseLab(id, unknown).unknown, undefined);
    assert.throws(() => parseLab(id, { ...unknown, observed: ['invented-achievement'] }));
  }
  for (const [id, field, value] of [['estimate', 'users', 1e10], ['balance', 'servers', 3], ['cache', 'cached', 'x'.repeat(61)], ['queue', 'pending', Array(21).fill(1)], ['rate', 'tokens', 4], ['design', 'reason', 'x'.repeat(501)]]) assert.throws(() => parseLab(id, { ...newLab(id), [field]: value }));
  assert.throws(() => parseCourse(JSON.stringify({ ...p, labs: {} })));
  assert.throws(() => parseCourse(JSON.stringify({ ...p, version: 3 })));
});
