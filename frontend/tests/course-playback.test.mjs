import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newStageProgress } from '../src/utils/componentStages.ts';
import { connectParts, addPart, diagramStage } from '../src/utils/courseDiagram.ts';
import { runStudio, studioModel, setStudioDiagram } from '../src/utils/courseStudio.ts';
import { coursePlayback } from '../src/utils/coursePlayback.ts';

function play(p, key, action) {
  const original = structuredClone(p), r = runStudio(p, key, action);
  const steps = coursePlayback(p.diagrams[key], diagramStage(key), action, r.inputModel, studioModel(r.progress, key), r.trace, r.result.explanation);
  assert.deepEqual(p, original, 'playback must not mutate input or history');
  for (const step of steps.filter(s => s.wire)) assert.ok(p.diagrams[key].edges.some(e => e.id === step.wire.id), 'only real wires can carry packets');
  return { steps, next: r.progress };
}
const wires = steps => steps.filter(s => s.wire).map(s => [s.wire.id, s.wire.reverse]);

test('one action sends a request, returns over the same wire and displays the reply', () => {
  let p = newStageProgress();
  p = setStudioDiagram(p, 'browser-learn', connectParts(p.diagrams['browser-learn'], 'browser-1', 'responder'));
  const sent = play(p, 'browser-learn', 'send');
  assert.deepEqual(wires(sent.steps), [['browser-1--responder', false], ['browser-1--responder', true]]);
  assert.equal(sent.steps.at(-1).title, 'ブラウザに返事が表示される');
  assert.equal(sent.next.browser.displayed, '会場は体育館です');
  assert.equal(sent.steps.at(-1).detail, sent.next.browser.displayed);
});

test('disconnected requests never animate replies; legacy draft text is replaced only on a new run', () => {
  let p = newStageProgress();
  const blocked = play(p, 'app-learn', 'send');
  assert.deepEqual(wires(blocked.steps), []);
  assert.match(blocked.steps.at(-1).title, /経路がありません/);
  p = setStudioDiagram(p, 'app-learn', connectParts(p.diagrams['app-learn'], 'browser-1', 'app-1'));
  const sent = play(p, 'app-learn', 'send');
  assert.deepEqual(wires(sent.steps), [['browser-1--app-1', false], ['browser-1--app-1', true]]);
  assert.equal(sent.steps.at(-1).detail, '会場は体育館です');
  p.learning.lessons.request.draft = '  ';
  const fixed = play(p, 'app-learn', 'send');
  assert.equal(p.learning.lessons.request.draft, '  ');
  assert.equal(fixed.steps.at(-1).detail, '会場は体育館です');
  assert.equal(fixed.next.learning.lessons.request.draft, '会場を教えてください');
});

test('restart is local, while DB reads return through the app and then to the browser', () => {
  let p = newStageProgress(), g = addPart(p.diagrams['database-learn'], 'database', 'database');
  p = setStudioDiagram(p, 'database-learn', connectParts(g, 'app-1', 'database-1'));
  p = play(p, 'database-learn', 'save').next;
  const restarted = play(p, 'database-learn', 'restart');
  assert.deepEqual(wires(restarted.steps), []);
  const read = play(restarted.next, 'database-learn', 'read');
  assert.deepEqual(wires(read.steps), [['browser-1--app-1', false], ['app-1--database-1', false], ['app-1--database-1', true], ['browser-1--app-1', true]]);
});

test('cache miss checks DB and returns directly through the app; cache hit never contacts DB', () => {
  let p = newStageProgress(), g = addPart(p.diagrams['cache-learn'], 'cache', 'cache');
  p = setStudioDiagram(p, 'cache-learn', connectParts(g, 'app-1', 'cache-1'));
  const miss = play(p, 'cache-learn', 'read');
  assert.deepEqual(wires(miss.steps), [['browser-1--app-1', false], ['app-1--cache-1', false], ['app-1--cache-1', true], ['app-1--database-1', false], ['app-1--database-1', true], ['browser-1--app-1', true]]);
  const hit = play(miss.next, 'cache-learn', 'read');
  assert.equal(hit.steps.some(s => s.node === 'database-1'), false);
  hit.next.learning.labs.cache.draft = '新しい会場';
  const written = play(hit.next, 'cache-learn', 'write');
  assert.deepEqual(wires(written.steps), [['app-1--database-1', false], ['app-1--database-1', true]]);
  assert.equal(written.steps.find(s => s.node === 'database-1').detail, '集合は12時です');
  assert.equal(written.next.learning.labs.cache.displayed, hit.next.learning.labs.cache.displayed);
  written.next.learning.labs.cache.draft = ' ';
  assert.equal(play(written.next, 'cache-learn', 'write').next.learning.labs.cache.origin, '集合は12時です');
});

test('queue acknowledgement is not delivery, and a stopped worker never receives a moving job', () => {
  let p = newStageProgress();
  p = setStudioDiagram(p, 'queue-learn', connectParts(addPart(p.diagrams['queue-learn'], 'queue', 'queue'), 'app-1', 'queue-1'));
  const accepted = play(p, 'queue-learn', 'submit');
  assert.match(accepted.steps.at(-1).detail, /通知の完了はまだ/);
  p = setStudioDiagram(p, 'worker-learn', connectParts(addPart(p.diagrams['worker-learn'], 'worker', 'worker'), 'queue-1', 'worker-1'));
  assert.deepEqual(wires(play(p, 'worker-learn', 'work').steps), []);
  p = setStudioDiagram(p, 'worker-learn', { ...p.diagrams['worker-learn'], nodes: p.diagrams['worker-learn'].nodes.map(n => ({ ...n, stopped: false })) });
  const worked = play(p, 'worker-learn', 'work');
  assert.deepEqual(wires(worked.steps), [['queue-1--worker-1', false]]);
  assert.deepEqual(wires(play(worked.next, 'worker-learn', 'work').steps), []);
  assert.deepEqual(wires(play(worked.next, 'worker-learn', 'replay').steps), []);
});

test('requests rejected at an empty gateway return to the browser without reaching the app', () => {
  let p = newStageProgress(), g = addPart(p.diagrams['gateway-learn'], 'gateway', 'gateway');
  g = { ...g, edges: [] }; g = connectParts(connectParts(g, 'browser-1', 'gateway-1'), 'gateway-1', 'app-1');
  p = setStudioDiagram(p, 'gateway-learn', g); p.learning.labs.rate.tokens = 0;
  const result = play(p, 'gateway-learn', 'run');
  assert.deepEqual(wires(result.steps), [['browser-1--gateway-1', false], ['browser-1--gateway-1', true]]);
  assert.equal(result.steps.some(s => s.node === 'app-1'), false);
});

test('a stopped sole app does not process a request, contact DB or return a successful reply', () => {
  let p = newStageProgress();
  p = setStudioDiagram(p, 'balancer-learn', { ...p.diagrams['balancer-learn'], nodes: p.diagrams['balancer-learn'].nodes.map(n => ({ ...n, stopped: n.kind === 'app' })) });
  const stopped = play(p, 'balancer-learn', 'run');
  assert.deepEqual(wires(stopped.steps), [['browser-1--app-1', false]]);
  assert.match(stopped.steps.at(-1).title, /停止中/);
  p.learning.labs.design.objective = 'continuity';
  const simulated = play(p, 'graduation', 'run');
  assert.deepEqual(wires(simulated.steps), [['browser-1--app-1', false]]);
  assert.match(simulated.steps.at(-1).title, /停止中/);
});
