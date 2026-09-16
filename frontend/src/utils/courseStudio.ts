import type { StageProgress, PracticeModel } from './componentStages.ts';
import { operateAttempt, operateBrowser, newAttempt, newBrowser, newWorker } from './componentStages.ts';
import { runExperiment, newLesson } from './learningCourse.ts';
import type { ExperimentAction } from './learningCourse.ts';
import { runLab, newLab } from './courseLabs.ts';
import type { LabResult, LabAction, QueueLab } from './courseLabs.ts';
import type { LabId } from '../constants/courseCurriculum.ts';
import type { StageId } from '../constants/componentStages.ts';
import { diagramStage, diagramSignature, diagramProblem, diagramTrace, inspectDiagram, syncLabDiagram, syncLessonDiagram, newDiagram } from './courseDiagram.ts';
import type { CourseDiagram, DiagramKey } from './courseDiagram.ts';
import { introScenario, storageRecord, updatedAnnouncement } from '../constants/courseScenarios.ts';

export function labIdFor(key: DiagramKey): LabId {
  const id = diagramStage(key);
  return (id === 'balancer' ? 'balance' : id === 'gateway' ? 'rate' : id === 'graduation' ? 'design' : id === 'worker' ? 'queue' : id) as LabId;
}
export function studioModel(p: StageProgress, key: DiagramKey): PracticeModel {
  const id = diagramStage(key);
  if (key.endsWith('practice')) return p.attempts[id as StageId].model;
  if (id === 'browser') return p.browser;
  if (id === 'app' || id === 'database') { const kind = id === 'app' ? 'request' : 'storage'; return { kind, value: p.learning.lessons[kind] }; }
  if (id === 'worker') return p.worker;
  return p.learning.labs[labIdFor(key)];
}
export function setStudioModel(p: StageProgress, key: DiagramKey, model: PracticeModel): StageProgress {
  const id = diagramStage(key);
  if (key.endsWith('practice')) return { ...p, attempts: { ...p.attempts, [id]: { ...p.attempts[id as StageId], model, submitted: false } } };
  if (model.kind === 'browser') return { ...p, browser: model };
  if (model.kind === 'request' || model.kind === 'storage') return { ...p, learning: { ...p.learning, lessons: { ...p.learning.lessons, [model.kind]: model.value } } };
  if (id === 'worker') return { ...p, worker: model as QueueLab };
  return { ...p, learning: { ...p.learning, labs: { ...p.learning.labs, [model.kind]: model } } };
}
function syncModel(model: PracticeModel, g: CourseDiagram): PracticeModel {
  if (model.kind === 'browser') return model;
  if (model.kind === 'request' || model.kind === 'storage') return { ...model, value: syncLessonDiagram(model.value, g) };
  return syncLabDiagram(model, g);
}
export function setStudioDiagram(p: StageProgress, key: DiagramKey, diagram: CourseDiagram): StageProgress {
  const changed = diagramSignature(p.diagrams[key]) !== diagramSignature(diagram);
  let model = syncModel(studioModel(p, key), diagram);
  if (changed && model.kind === 'browser') model = { ...model, sent: null, reply: null, displayed: null };
  const next = changed ? setStudioModel(p, key, model) : p;
  // The verified signature belongs to a run, not to the editor's undo stack.
  return { ...next, diagrams: { ...next.diagrams, [key]: { ...diagram, checked: p.diagrams[key].checked } } };
}
export function resetStudio(p: StageProgress, key: DiagramKey): StageProgress {
  const id = diagramStage(key);
  let next: StageProgress;
  if (key.endsWith('practice')) next = { ...p, attempts: { ...p.attempts, [id]: newAttempt(id as StageId) } };
  else if (id === 'browser') next = { ...p, browser: newBrowser(), browserAnswer: '' };
  else if (id === 'app' || id === 'database') { const kind = id === 'app' ? 'request' : 'storage'; next = setStudioModel(p, key, { kind, value: newLesson(kind) }); }
  else next = setStudioModel(p, key, id === 'worker' ? newWorker() : newLab(labIdFor(key)));
  return { ...next, diagrams: { ...next.diagrams, [key]: newDiagram(key) } };
}
export function runStudio(p: StageProgress, key: DiagramKey, action: string): { progress: StageProgress; result: LabResult; trace: string[]; inputModel: PracticeModel } {
  const id = diagramStage(key), g = p.diagrams[key], practice = key.endsWith('practice');
  let model = syncModel(studioModel(p, key), g);
  // Apply fixed content only when an experiment runs. Opening a saved lesson never rewrites it.
  if (model.kind === 'browser' && action === 'send') model = { ...model, draft: introScenario('browser', practice).request };
  if (model.kind === 'request' && action === 'send') model = { ...model, value: { ...model.value, draft: introScenario('app', practice).request } };
  if (model.kind === 'storage' && action === 'save') model = { ...model, value: { ...model.value, draft: storageRecord(practice) } };
  if (model.kind === 'cache' && action === 'write') model = { ...model, draft: updatedAnnouncement };
  let next = setStudioModel(p, key, model);
  const issue = diagramProblem(id, g, action);
  const notice = (title: string, explanation: string): LabResult => ({ tone: 'notice', title, explanation, steps: [], metrics: [] });
  const cacheHit = model.kind === 'cache' && model.enabled && model.cached !== null;
  let trace = diagramTrace(model.kind === 'design' && model.objective === 'continuity' ? { ...g, nodes: g.nodes.map(n => n.id === 'app-1' ? { ...n, stopped: true } : n) } : g, id, action, cacheHit);
  if (model.kind === 'rate' && model.enabled && model.tokens === 0 && ['run', 'retry'].includes(action)) trace = trace.slice(0, trace.indexOf('gateway-1') + 1);
  if (issue && !(model.kind === 'request' || model.kind === 'storage')) {
    if (model.kind === 'browser') next = setStudioModel(next, key, { ...model, sent: model.draft, reply: null, displayed: null });
    return { progress: { ...next, diagrams: { ...next.diagrams, [key]: { ...g, checked: null } } }, result: notice('図の経路を確かめましょう', issue), trace, inputModel: model };
  }
  let result: LabResult;
  if (key.endsWith('practice')) {
    const attempt = next.attempts[id as StageId];
    const r = operateAttempt(attempt, action);
    next = { ...next, attempts: { ...next.attempts, [id]: r.attempt } };
    result = notice('この図で試した結果', r.message);
  } else if (model.kind === 'browser') {
    const r = operateBrowser(model, action); next = setStudioModel(next, key, r.state); result = notice('ブラウザの動き', r.message);
  } else if (model.kind === 'request' || model.kind === 'storage') {
    const r = runExperiment(model.kind, model.value, action as ExperimentAction); next = setStudioModel(next, key, { ...model, value: r.state }); result = { ...r.result, metrics: [] };
  } else {
    const r = runLab(model, action as LabAction); next = setStudioModel(next, key, r.state); result = r.result;
  }
  const verifiedActions: Record<string, string[]> = { browser: ['send'], app: ['send'], database: ['read'], balancer: ['run'], estimate: ['run'], cache: ['read'], queue: ['submit', 'work'], worker: ['work'], gateway: ['run', 'retry'], graduation: ['run'] };
  const hasWork = !((model.kind === 'request' || model.kind === 'storage') && ['send', 'save'].includes(action) && !model.value.draft.trim()) && !(model.kind === 'queue' && ['work', 'replay'].includes(action) && !model.pending.length) && !(model.kind === 'rate' && action === 'retry' && !model.retryWaiting);
  if (verifiedActions[id].includes(action) && hasWork) next = { ...next, diagrams: { ...next.diagrams, [key]: { ...g, checked: issue ? null : diagramSignature(g) } } };
  const topology = inspectDiagram(g);
  if ((id === 'gateway' || id === 'graduation') && g.nodes.some(n => n.kind === 'gateway') && !topology.limited) result = { ...result, explanation: `${result.explanation} Gatewayを通らない経路があるため、入口の制限を適用できません。` };
  return { progress: next, result, trace, inputModel: model };
}
