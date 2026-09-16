import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stageIds } from '../src/constants/componentStages.ts';
import { allowedParts, newDiagram, addPart, connectParts, removePart, parseDiagram, diagramSignature, inspectDiagram, diagramReady, arrangeCourseDiagram, diagramKeys, diagramStage } from '../src/utils/courseDiagram.ts';
import { runStudio, setStudioDiagram, studioModel, resetStudio } from '../src/utils/courseStudio.ts';
import { newStageProgress, parseStages, submitPractice } from '../src/utils/componentStages.ts';
import { createCourseProject } from '../src/utils/courseProject.ts';
const link = (g, s, t) => connectParts(g, `${s}-1`, `${t}-1`);
const change = (p, key, g) => setStudioDiagram(p, key, g);
const run = (p, key, ...actions) => actions.reduce((p, a) => runStudio(p, key, a).progress, p);
function balanced() {
  let g = newDiagram('balancer-learn'); g = addPart(addPart(g, 'balancer', 'app'), 'balancer', 'balancer');
  g = { ...g, edges: g.edges.filter(e => e.id !== 'browser-1--app-1') };
  for (const [a,b] of [['browser-1','balancer-1'],['balancer-1','app-1'],['balancer-1','app-2'],['app-2','database-1']]) g = connectParts(g,a,b);
  return g;
}
test('starter diagrams and lesson additions flow downward, with parallel apps at the same height', () => {
  for (const key of diagramKeys) {
    const stage = diagramStage(key);
    let g = newDiagram(key);
    if (stage !== 'estimate' && stage !== 'graduation') g = addPart(g, stage, stage);
    for (const e of g.edges) assert.ok(g.nodes.find(n => n.id === e.target).y - g.nodes.find(n => n.id === e.source).y >= 120, key);
    assert.deepEqual(parseDiagram(g, key), g);
  }
  const g = balanced(), get = id => g.nodes.find(n => n.id === id);
  assert.equal(get('app-1').y, get('app-2').y);
  assert.ok(Math.abs(get('app-1').x - get('app-2').x) >= 260);
  assert.equal((get('app-1').x + get('app-2').x) / 2, get('balancer-1').x);
  for (const e of g.edges) assert.ok(get(e.target).y > get(e.source).y);
});
test('arranging old diagrams changes only positions, preserves a fixed responder, and is idempotent', () => {
  const old = balanced(); old.nodes.forEach((n,i) => { n.x = i * 240; n.y = 90; }); old.nodes[1].stopped = true; old.checked = diagramSignature(old);
  const before = structuredClone(old), arranged = arrangeCourseDiagram(old, 'balancer');
  assert.deepEqual(old, before); assert.deepEqual(arranged.edges, old.edges); assert.equal(arranged.checked, old.checked);
  assert.equal(diagramSignature(arranged), diagramSignature(old));
  assert.deepEqual(arrangeCourseDiagram(arranged, 'balancer'), arranged);
  const browser = newDiagram('browser-learn'); browser.nodes[1].x = 420; browser.nodes[1].y = 150;
  const fixed = arrangeCourseDiagram(browser, 'browser');
  assert.deepEqual(fixed.nodes[1], browser.nodes[1]); assert.equal(fixed.nodes[0].x, fixed.nodes[1].x); assert.ok(fixed.nodes[0].y < fixed.nodes[1].y);
});
test('adding to a moved diagram keeps existing positions and avoids occupied slots; explicit drops stay explicit', () => {
  const g = newDiagram('balancer-practice'); g.nodes[0].x += 45;
  const slot = arrangeCourseDiagram(addPart(g, 'balancer', 'balancer', { x: 0, y: 0 }), 'balancer').nodes.at(-1);
  g.nodes[1].x = slot.x; g.nodes[1].y = slot.y;
  const added = addPart(g, 'balancer', 'balancer');
  assert.deepEqual(added.nodes.slice(0,-1), g.nodes);
  assert.ok(added.nodes.slice(0,-1).every(n => Math.abs(n.x - added.nodes.at(-1).x) >= 260 || Math.abs(n.y - added.nodes.at(-1).y) >= 110));
  const dropped = addPart(g, 'balancer', 'balancer', { x: -200, y: 300 });
  assert.deepEqual(dropped.nodes.slice(0,-1), g.nodes); assert.equal(dropped.nodes.at(-1).x, -200); assert.equal(dropped.nodes.at(-1).y, 300);
  const boundary = newDiagram('browser-practice'); boundary.nodes[0].x = 5000; boundary.nodes[0].y = -5000;
  assert.doesNotThrow(() => parseDiagram(addPart(boundary, 'browser', 'browser'), 'browser-practice'));
});
test('every stage unlocks only its learned palette; future or duplicate parts cannot enter restored diagrams', () => {
  for (const [i, stage] of stageIds.entries()) {
    assert.deepEqual(allowedParts(stage), stageIds.slice(0, i+1));
    for (const kind of stageIds.slice(i+1)) {
      const g = newDiagram(`${stage}-practice`); assert.equal(addPart(g, stage, kind), g);
      assert.throws(() => parseDiagram({ ...g, nodes: [...g.nodes, { id: `${kind}-1`, kind, x: 0, y: 0, stopped: false }] }, `${stage}-practice`));
    }
  }
  const g = newDiagram('app-learn');
  for (const n of [{ id: 'app-2', kind: 'app', x: 0, y: 0, stopped: false }, { id: 'browser-2', kind: 'browser', x: 0, y: 0, stopped: false }, null]) assert.throws(() => parseDiagram({ ...g, nodes: [n] }, 'app-learn'));
  assert.equal(removePart(newDiagram('browser-learn'), 'responder').nodes.length, 2);
  for (const edges of [[{id:'bad', source:'browser-1', target:'missing'}], [{id:'browser-1--browser-1',source:'browser-1',target:'browser-1'}]]) assert.throws(() => parseDiagram({...g,edges}, 'app-learn'));
});
test('placement, wrong-way wires and a disconnected DB do not act like a working route', () => {
  let p = newStageProgress(), g = newDiagram('app-learn');
  g = link(g, 'app', 'browser'); p = run(change(p,'app-learn',g),'app-learn','send'); assert.equal(p.learning.lessons.request.sawDelivered, false);
  g = link(g,'browser','app'); p = run(change(p,'app-learn',g),'app-learn','send'); assert.equal(p.learning.lessons.request.sawDelivered, true);
  let d = addPart(newDiagram('database-practice'), 'database', 'database');
  p = run(change(p,'database-practice',d),'database-practice','save','restart','read'); assert.equal(p.attempts.database.model.value.screen,null);
  d = link(d,'app','database'); p = run(change(p,'database-practice',d),'database-practice','save','restart','read');
  assert.equal(p.attempts.database.model.value.screen,'Aさんがボールを借りた'); assert.equal(diagramReady('database',p.diagrams['database-practice']),true);
  p = change(p,'database-practice',{ ...d,edges:[] }); assert.equal(diagramReady('database',p.diagrams['database-practice']),false);
});
test('a stopped B sends no work to B, single directly connected B is identified correctly, and bypassing a balancer changes capacity', () => {
  let p = newStageProgress(), g = balanced();
  p = run(change(p,'balancer-learn',g),'balancer-learn','run'); assert.ok(studioModel(p,'balancer-learn').observed.includes('spread'));
  g = { ...g,nodes:g.nodes.map(n => n.id==='app-2'?{...n,stopped:true}:n) };
  const result = runStudio(change(p,'balancer-learn',g),'balancer-learn','run');
  assert.equal(result.result.metrics.find(m=>m.label==='アプリBの処理').value,'0件'); assert.equal(result.result.metrics.find(m=>m.label==='アプリAの処理').value,'6件');
  assert.equal(result.trace.includes('app-2'),false);
  g = {...g,nodes:g.nodes.map(n=>({...n,stopped:false}))}; g = link(g,'browser','app');
  assert.equal(inspectDiagram(g).balanced,false);
  const bypass = runStudio(change(p,'balancer-learn',g),'balancer-learn','run'); assert.equal(bypass.result.metrics.find(m=>m.label==='完了').value,'6件');
  g = removePart(g,'app-1'); g = connectParts(g,'browser-1','app-2');
  const onlyB=runStudio(change(p,'balancer-learn',g),'balancer-learn','run'); assert.equal(onlyB.result.metrics.find(m=>m.label==='アプリAの処理').value,'0件'); assert.equal(onlyB.result.metrics.find(m=>m.label==='アプリBの処理').value,'6件');
});
test('cache must be connected to read its stale copy; worker must be connected and running to drain duplicate jobs', () => {
  let p = run(newStageProgress(),'cache-practice','read'); assert.equal(p.attempts.cache.model.displayed,'体育館'); assert.equal(p.attempts.cache.model.hits,0);
  p = resetStudio(p,'cache-practice'); p = change(p,'cache-practice',link(p.diagrams['cache-practice'],'app','cache'));
  p = run(p,'cache-practice','read'); assert.equal(p.attempts.cache.model.displayed,'公園');
  p = run(p,'cache-practice','invalidate','read'); assert.equal(p.attempts.cache.model.displayed,'体育館'); assert.equal(diagramReady('cache',p.diagrams['cache-practice']),true);
  let g=addPart(p.diagrams['worker-practice'],'worker','worker'); p=run(change(p,'worker-practice',g),'worker-practice','work'); assert.equal(p.attempts.worker.model.pending.length,2);
  g=link(g,'queue','worker'); p=run(change(p,'worker-practice',g),'worker-practice','work'); assert.equal(p.attempts.worker.model.pending.length,2);
  g={...g,nodes:g.nodes.map(n=>({...n,stopped:false}))}; p=change(p,'worker-practice',g); p.attempts.worker.model.deduplicate=true;
  p=run(p,'worker-practice','work','work'); assert.equal(p.attempts.worker.model.deliveries,1); assert.equal(p.attempts.worker.model.pending.length,0);
});
test('gateway bypasses cannot earn a limited outcome; rejection traces stop at the gateway and all seven requests can be retried', () => {
  let p=newStageProgress(),g=addPart(newDiagram('gateway-practice'),'gateway','gateway'); g=link(link(g,'browser','gateway'),'gateway','app');
  p=run(change(p,'gateway-practice',g),'gateway-practice','run'); assert.equal(p.attempts.gateway.delivered,3); assert.equal(p.attempts.gateway.model.retryWaiting,0); assert.equal(diagramReady('gateway',p.diagrams['gateway-practice']),false);
  p=resetStudio(p,'gateway-practice'); g={...g,edges:g.edges.filter(e=>e.id!=='browser-1--app-1')};
  p=run(change(p,'gateway-practice',g),'gateway-practice','run'); const denied=runStudio(p,'gateway-practice','retry'); assert.deepEqual(denied.trace,['browser-1','gateway-1']);
  p=run(denied.progress,'gateway-practice','advance','retry','advance','retry'); assert.equal(p.attempts.gateway.delivered,7); assert.equal(p.attempts.gateway.model.retryWaiting,0);
});
test('moving or reloading keeps an experiment and independent diagrams, while changing its route requires another run', () => {
  let p=newStageProgress(); p.browserAnswer='display'; p=run(change(p,'browser-learn',connectParts(p.diagrams['browser-learn'],'browser-1','responder')),'browser-learn','send');
  const learning=structuredClone(p.diagrams['browser-learn']); let g=addPart(p.diagrams['browser-practice'],'browser','browser'); g=connectParts(g,'browser-1','responder');
  p=run(change(p,'browser-practice',g),'browser-practice','send'); p.attempts.browser.answer='display';
  assert.equal(submitPractice(p,'browser').cleared.length,1);
  g={...p.diagrams['browser-practice'],nodes:p.diagrams['browser-practice'].nodes.map(n=>({...n,x:n.x+88,y:n.y-37}))}; p=change(p,'browser-practice',g);
  assert.equal(diagramReady('browser',g),true); assert.deepEqual(parseStages(JSON.stringify(p)),p); assert.deepEqual(p.diagrams['browser-learn'],learning);
  p=change(p,'browser-practice',{...g,edges:[]}); assert.equal(submitPractice(p,'browser').cleared.length,0);
  p=change(p,'browser-practice',g); p=run(p,'browser-practice','send'); assert.equal(submitPractice(p,'browser').cleared.length,1);
});
test('v3 preserves achievements and experiments without certifying untried canvases or changing old records', () => {
  const old=newStageProgress(); old.version=3; delete old.diagrams; old.cleared=[...stageIds]; old.graduated=true; old.attempts.browser.submitted=true; old.learning.lessons.storage.draft='以前のメモ';
  const raw=JSON.stringify(old), p=parseStages(raw); assert.equal(p.version,4); assert.deepEqual(p.cleared,stageIds); assert.equal(p.graduated,true); assert.equal(p.learning.lessons.storage.draft,'以前のメモ'); assert.equal(p.attempts.browser.submitted,false); assert.equal(p.migrated,true); assert.equal(diagramReady('graduation',p.diagrams.graduation),false); assert.equal(JSON.stringify(old),raw);
});
test('graduation exports actual node identities, extra unconnected parts, coordinates and edges', () => {
  let p=newStageProgress(), g=balanced(); g=addPart(g,'graduation','gateway',{x:-110,y:370}); g.nodes[0].x=-321; g.nodes[0].y=240;
  p=change(p,'graduation',g); p=run(p,'graduation','run'); const d=p.learning.labs.design;
  assert.equal(d.last.components,g.nodes.length);
  const project=createCourseProject(d,'course-project','2026-09-15T00:00:00Z',g);
  assert.deepEqual(project.diagram.nodes.map(n=>[n.id,n.position]),g.nodes.map(n=>[n.id,{x:n.x,y:n.y}]));
  assert.deepEqual(project.diagram.edges.map(e=>[e.source,e.target]),g.edges.map(e=>[e.source,e.target]));
  assert.equal(project.memo.includes('卒業課題'),true);
});


test('fixed intro scenarios preserve saved drafts until the next action and never replay stale replies after disconnect', () => {
  let p = newStageProgress();
  p.browser.draft = '以前の自由入力';
  p = change(p, 'browser-learn', connectParts(p.diagrams['browser-learn'], 'browser-1', 'responder'));
  const saved = JSON.stringify(p);
  const restored = parseStages(saved);
  assert.equal(restored.browser.draft, '以前の自由入力');
  p = run(restored, 'browser-learn', 'send');
  assert.equal(JSON.stringify(restored), saved);
  assert.equal(p.browser.sent, '会場を教えてください');
  assert.equal(p.browser.displayed, '会場は体育館です');
  assert.equal(diagramReady('browser', p.diagrams['browser-learn']), true);
  p = change(p, 'browser-learn', { ...p.diagrams['browser-learn'], edges: [] });
  p = run(p, 'browser-learn', 'send');
  assert.equal(p.browser.reply, null);
  assert.equal(p.browser.displayed, null);
  assert.equal(diagramReady('browser', p.diagrams['browser-learn']), false);
});

test('app practice uses a distinct authored response and a storage save uses the fixed record', () => {
  let p = newStageProgress();
  let g = addPart(p.diagrams['app-practice'], 'app', 'app', undefined, true);
  p = run(change(p, 'app-practice', connectParts(g, 'browser-1', 'app-1')), 'app-practice', 'send');
  assert.equal(p.attempts.app.model.value.screen, 'ラケットを借りられます');
  p.learning.lessons.storage.memory = '以前の記録';
  p.learning.lessons.storage.draft = '以前の自由入力';
  const restored = parseStages(JSON.stringify(p));
  p = run(restored, 'database-learn', 'read');
  assert.equal(p.learning.lessons.storage.screen, '以前の記録');
  assert.equal(p.learning.lessons.storage.draft, '以前の自由入力');
  p = run(p, 'database-learn', 'save');
  assert.equal(p.learning.lessons.storage.memory, '会場は体育館です');
  assert.equal(restored.learning.lessons.storage.memory, '以前の記録');
});


test('templates reserve visible travel lanes below interactive cards and between parallel branches', () => {
  for (const key of diagramKeys) {
    const stage = diagramStage(key);
    let g = newDiagram(key);
    if (stage !== 'estimate' && stage !== 'graduation') g = addPart(g, stage, stage);
    for (const a of g.nodes) for (const b of g.nodes) {
      if (a.id === b.id) continue;
      if (a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= 320, key);
      if (b.y > a.y) {
        const height = a.kind === 'browser' && ['app', 'browser'].includes(stage) ? 100 : 70;
        assert.ok(b.y - a.y - height >= 120, key);
      }
    }
  }
});

test('restoring an old template updates only spacing; custom placements, topology and achievements stay intact', () => {
  const p = newStageProgress(); p.cleared = ['browser', 'app'];
  const g = connectParts(p.diagrams['app-learn'], 'browser-1', 'app-1');
  g.nodes[0].y = 40; g.nodes[1].y = 160; g.checked = diagramSignature(g);
  p.diagrams['app-learn'] = g;
  p.learning.lessons.request.draft = '過去の記録';
  const original = JSON.stringify(p), updated = parseStages(original);
  assert.deepEqual({ ...updated, diagrams: { ...updated.diagrams, 'app-learn': g } }, p);
  assert.equal(updated.diagrams['app-learn'].nodes[1].y - updated.diagrams['app-learn'].nodes[0].y, 240);
  assert.equal(updated.diagrams['app-learn'].checked, g.checked);
  assert.equal(JSON.stringify(p), original);
  assert.deepEqual(parseStages(JSON.stringify(updated)), updated);
  g.nodes[1].x += 1;
  assert.deepEqual(parseStages(JSON.stringify(p)).diagrams['app-learn'], g);
});
