import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stageIds, componentStages } from '../src/constants/componentStages.ts';
import { newStageProgress, newAttempt, newBrowser, operateBrowser, operateAttempt, experienceComplete, stageUnlocked, submitPractice, practiceChecks, graduate, parseStages, readStages, STAGE_STORAGE_KEY } from '../src/utils/componentStages.ts';
import { COURSE_STORAGE_KEY, newCourse, runExperiment } from '../src/utils/learningCourse.ts';
import { connectParts, addPart, diagramSignature } from '../src/utils/courseDiagram.ts';
import { runLab } from '../src/utils/courseLabs.ts';
const act = (a, ...actions) => actions.reduce((s, action) => operateAttempt(s, action).attempt, a);
function verified(p, key, from, to, kind) { if (kind) p.diagrams[key] = addPart(p.diagrams[key], key.split('-')[0], kind); p.diagrams[key] = connectParts(p.diagrams[key], from, to); p.diagrams[key].checked = diagramSignature(p.diagrams[key]); }
function browserExperienced(p) { verified(p, 'browser-learn', 'browser-1', 'responder'); verified(p, 'browser-practice', 'browser-1', 'responder', 'browser'); p.browser = operateBrowser(newBrowser(), 'send').state; p.browserAnswer = 'display'; return p; }
function passBrowser() { return { ...act(newAttempt('browser'), 'send'), answer: 'display' }; }

test('a stage needs experience, an actual practice outcome and an explicitly submitted correct explanation', () => {
  let p = newStageProgress(); p.attempts.browser = passBrowser();
  assert.equal(submitPractice(p, 'browser'), p);
  p = browserExperienced(p);
  assert.equal(p.cleared.length, 0);
  p.attempts.browser.answer = 'store';
  p = submitPractice(p, 'browser'); assert.equal(p.cleared.length, 0);
  p.attempts.browser.answer = 'display';
  p = submitPractice(p, 'browser'); assert.deepEqual(p.cleared, ['browser']);
  assert.equal(stageUnlocked(p, 'app'), true); assert.equal(stageUnlocked(p, 'database'), false);
  assert.deepEqual(submitPractice(p, 'browser').cleared, ['browser']);
});

test('map opens stages in order, not by a correct answer in a later lesson, and keeps earned access during review', () => {
  const p = newStageProgress();
  assert.equal(stageUnlocked(p, 'browser'), true);
  for (const id of stageIds.slice(1)) assert.equal(stageUnlocked(p, id), false);
  assert.equal(stageUnlocked(p, 'graduation'), false);
  p.cleared = [...stageIds];
  p.attempts.app = newAttempt('app'); // Retrying never takes back earlier achievements.
  assert.equal(stageUnlocked(p, 'gateway'), true); assert.equal(stageUnlocked(p, 'graduation'), true);
});

test('browser automatically displays a received reply with one action', () => {
  let a = newAttempt('browser');
  assert.equal(practiceChecks('browser', a).some(c => c.done), false);
  a = act(a, 'send');
  assert.equal(practiceChecks('browser', a).every(c => c.done), true);
  assert.equal(a.model.displayed, 'ボールは貸出中です');
});

test('application practice needs a routed reply; storage practice needs a real write, restart, and DB read', () => {
  let a = act(newAttempt('app'), 'send'); assert.equal(practiceChecks('app', a)[0].done, false);
  a = act(a, 'toggle-app', 'send'); assert.equal(practiceChecks('app', a)[0].done, true);
  a = act(a, 'toggle-app'); assert.equal(practiceChecks('app', a)[0].done, false);
  let db = act(newAttempt('database'), 'save', 'restart', 'read'); assert.equal(practiceChecks('database', db)[0].done, false);
  db = act(db, 'toggle-database', 'save', 'read'); assert.equal(practiceChecks('database', db)[0].done, false);
  db = act(db, 'restart', 'read'); assert.equal(practiceChecks('database', db)[0].done, true);
});

test('balancer practice cannot pass by only adding a server or only enabling routing', () => {
  let a = newAttempt('balancer');
  a = act({ ...a, model: { ...a.model, servers: 2 } }, 'run'); assert.equal(practiceChecks('balancer', a)[0].done, false);
  a = { ...a, model: { ...a.model, balanced: true } }; assert.equal(practiceChecks('balancer', a)[0].done, false);
  a = act(a, 'run'); assert.equal(practiceChecks('balancer', a)[0].done, true);
});

test('cache repair needs both observing stale data and fetching the updated copy with the cache still enabled', () => {
  let a = act(newAttempt('cache'), 'invalidate', 'read'); assert.equal(practiceChecks('cache', a).every(c => c.done), false);
  a = act(newAttempt('cache'), 'read');
  a = act({ ...a, model: { ...a.model, enabled: false } }, 'read'); assert.equal(practiceChecks('cache', a).every(c => c.done), false);
  a = act({ ...a, model: { ...a.model, enabled: true } }, 'invalidate', 'read'); assert.equal(practiceChecks('cache', a).every(c => c.done), true);
});

test('queue acceptance and worker execution are separate stages; duplicate deliveries must be handled', () => {
  let a = act(newAttempt('queue'), 'submit'); assert.equal(practiceChecks('queue', a)[0].done, false);
  a = newAttempt('queue'); a = act({ ...a, model: { ...a.model, enabled: true } }, 'submit');
  assert.equal(practiceChecks('queue', a)[0].done, true); assert.equal(a.model.deliveries, 0);
  let w = act(newAttempt('worker'), 'work'); assert.equal(w.model.pending.length, 2);
  w = act({ ...w, model: { ...w.model, workerRunning: true } }, 'work', 'work');
  assert.equal(w.model.deliveries, 2); assert.equal(practiceChecks('worker', w).every(c => c.done), false);
  w = newAttempt('worker'); w = act({ ...w, model: { ...w.model, workerRunning: true, deduplicate: true } }, 'work', 'work');
  assert.equal(w.model.deliveries, 1); assert.equal(practiceChecks('worker', w).every(c => c.done), true);
});

test('gateway practice counts all seven completed requests and cannot pass by dropping the overflow', () => {
  let a = act(newAttempt('gateway'), 'run'); assert.equal(a.delivered, 3); assert.equal(a.model.retryWaiting, 0);
  assert.equal(practiceChecks('gateway', a).every(c => c.done), false);
  const blocked = act(a, 'run'); assert.equal(blocked.delivered, 3);
  a = newAttempt('gateway'); a = act({ ...a, model: { ...a.model, enabled: true } }, 'run', 'advance', 'retry');
  assert.equal(a.delivered, 5); assert.equal(practiceChecks('gateway', a).every(c => c.done), false);
  a = act(a, 'advance', 'retry'); assert.equal(a.delivered, 7); assert.equal(practiceChecks('gateway', a).every(c => c.done), true);
});

test('practice and learning stay isolated; pending duplicate work and all stage state survive reload', () => {
  const p = browserExperienced(newStageProgress());
  const learning = structuredClone(p.learning);
  for (const id of stageIds) { p.attempts[id] = { ...act(newAttempt(id), id === 'worker' ? 'work' : id === 'queue' ? 'submit' : id === 'cache' ? 'read' : 'send'), answer: componentStages[id].correct }; }
  assert.deepEqual(p.learning, learning);
  assert.deepEqual(parseStages(JSON.stringify(p)), p);
  assert.equal(experienceComplete(p, 'worker'), false);
  let q = p.learning.labs.queue;
  for (const a of ['submit']) q = runLab(q, a).state;
  q = runLab({ ...q, enabled: true, workerRunning: false }, 'submit').state;
  p.learning.labs.queue = { ...runLab(q, 'work').state, answer: 'retry' };
  verified(p, 'queue-learn', 'app-1', 'queue-1', 'queue');
  assert.equal(experienceComplete(p, 'queue'), true); assert.equal(experienceComplete(p, 'worker'), false);
});

test('graduation needs all eight stage clears and a sufficient, currently verified design', () => {
  let p = newStageProgress();
  let d = runLab(p.learning.labs.design, 'run').state;
  d = runLab({ ...d, cache: true, reason: '読み出しを減らす', tradeoff: '古いコピーへの対応', answer: 'requirements' }, 'run').state;
  p.learning.labs.design = d;
  assert.equal(graduate(p).graduated, false);
  verified(p, 'graduation', 'app-1', 'cache-1', 'cache');
  p.cleared = [...stageIds]; assert.equal(graduate(p).graduated, true);
  p.learning.labs.design = { ...d, servers: 2 }; assert.equal(graduate(p).graduated, false);
});

test('old course progress migrates without claiming new practice completion or modifying the old storage', () => {
  const old = newCourse(); old.current = 'cache';
  old.lessons.request = runExperiment('request', old.lessons.request, 'send').state;
  const raw = JSON.stringify(old), values = new Map([[COURSE_STORAGE_KEY, raw]]);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => values.get(k) ?? null } });
  try {
    const result = readStages(); assert.equal(result.error, ''); assert.equal(result.progress.migrated, true);
    assert.deepEqual(result.progress.learning, old); assert.deepEqual(result.progress.cleared, []);
    assert.equal(values.get(COURSE_STORAGE_KEY), raw); assert.equal(values.has(STAGE_STORAGE_KEY), false);
    values.set(STAGE_STORAGE_KEY, '{broken'); assert.ok(readStages().error);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; }
});

test('corrupt and future records are rejected; locked destinations and premature practice return to a valid view', () => {
  for (const edit of [p => p.version = 5, p => p.attempts.browser.model.kind = 'cache', p => p.cleared = ['unknown'], p => p.attempts.gateway.delivered = 8, p => p.browser.draft = 'x'.repeat(61), p => p.worker.pending = [1000]]) {
    const p = newStageProgress(); edit(p); assert.throws(() => parseStages(JSON.stringify(p)));
  }
  const p = newStageProgress(); p.current = 'gateway'; p.view = 'practice';
  const restored = parseStages(JSON.stringify(p)); assert.equal(restored.current, 'browser'); assert.equal(restored.view, 'map');
  p.current = 'browser'; assert.equal(parseStages(JSON.stringify(p)).view, 'learn');
});
