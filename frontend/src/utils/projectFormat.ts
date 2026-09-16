import type { Scenario, ProjectSaveData, EvaluationResult, SimpleNodeData, ChatMessage } from '../types';
import { SCENARIOS } from '../scenarios.ts';
import definitions from '../constants/architecture_defs.json' with { type: 'json' };
import { normalizeNodeDesign, normalizeConnectionDesign } from './designModel.ts';

// Covers the worst-case escaped JSON for every field at its schema limit.
// Keep the byte cap independent of provider request/context limits.
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
const componentTypes = new Set(definitions.categories.flatMap(c => c.items.map(i => i.type)));
const groupTypes = new Set(definitions.categories.find(c => c.id === 'group')!.items.map(i => i.type));
function invalid(): never { throw new Error('データの形式またはサイズが不正です。対応するプロジェクトファイルを選んでください。'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || [...value].length > max || (required && !value.trim())) invalid();
  return value;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value;
}
function finite(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid();
  return value;
}
function score(value: unknown): number { const n = finite(value, 0, 100); if (!Number.isInteger(n)) invalid(); return n; }

export function publicScenario(value: unknown): Scenario {
  const v = object(value);
  const id = text(v.id, 100, true);
  const partnerRole = v.partnerRole ?? 'ceo';
  if (partnerRole !== 'ceo' && partnerRole !== 'cto' && partnerRole !== 'cfo') invalid();
  const preset = SCENARIOS.find(s => !s.isCustom && s.id === id);
  if (preset) return { ...preset, partnerRole };
  // Legacy share links assigned a challenge_* ID even to presets.
  const legacyPreset = id.startsWith('challenge_') && SCENARIOS.find(s => !s.isCustom && s.title === v.title);
  if (legacyPreset) return { ...legacyPreset, partnerRole };
  if (id !== 'custom' && !(id.startsWith('challenge_') && v.isCustom === true)) invalid();
  const difficulty = v.difficulty ?? 'medium';
  if (difficulty !== 'small' && difficulty !== 'medium' && difficulty !== 'large') invalid();
  const customMode = v.customMode;
  if (customMode !== undefined && customMode !== 'guided' && customMode !== 'self_defined') invalid();
  if (customMode === 'guided') {
    const scenarioFamily = v.scenarioFamily;
    if (scenarioFamily !== 'business' && scenarioFamily !== 'content' && scenarioFamily !== 'realtime' && scenarioFamily !== 'transaction') invalid();
    return { id: 'custom', title: text(v.title, 120, true), description: text(v.description, 2000, true), isCustom: true, difficulty, partnerRole, customMode, scenarioFamily };
  }
  if (customMode === 'self_defined') {
    if (v.scenarioFamily !== undefined) invalid();
    return { id: 'custom', title: text(v.title, 120, true), description: text(v.description, 2000, true), isCustom: true, partnerRole, customMode };
  }
  // Legacy custom projects used only difficulty and role. Keep their original behavior.
  return { id: 'custom', title: text(v.title, 120, true), description: text(v.description, 2000, true), isCustom: true, difficulty, partnerRole };
}

export function parseEvaluation(value: unknown): EvaluationResult {
  const v = object(value); const d = object(v.details);
  let interview;
  if (v.interview !== undefined) {
    const item = object(v.interview);
    const confirmed = finite(item.confirmed, 0, 100);
    const total = finite(item.total, 0, 100);
    if (!Number.isInteger(confirmed) || !Number.isInteger(total) || confirmed > total) invalid();
    const conditions = (value: unknown) => list(value, 100).map(entry => { const condition = object(entry); return { id: text(condition.id, 40, true), label: text(condition.label, 80, true) }; });
    const confirmedConditions = conditions(item.confirmedConditions);
    const missingConditions = conditions(item.missingConditions);
    if (confirmedConditions.length !== confirmed || confirmedConditions.length + missingConditions.length !== total) invalid();
    interview = { confirmed, total, confirmedConditions, missingConditions };
  }
  return { totalScore: score(v.totalScore ?? v.score), details: {
    availability: score(d.availability), scalability: score(d.scalability), security: score(d.security),
    maintainability: score(d.maintainability), costEfficiency: score(d.costEfficiency), feasibility: score(d.feasibility),
  }, feedback: text(v.feedback, 12000, true), improvement: text(v.improvement, 12000, true), ...(interview ? { interview } : {}) };
}

export function normalizeProject(value: unknown): ProjectSaveData {
  const v = object(value);
  if (v.schemaVersion !== undefined && v.schemaVersion !== 2 && v.schemaVersion !== 3) invalid();
  const diagram = object(v.diagram);
  const nodes: SimpleNodeData[] = list(diagram.nodes, 200).map(value => {
    const n = object(value); const d = object(n.data); const p = object(n.position);
    const originalType = text(d.originalType, 120, true);
    if (!componentTypes.has(originalType)) invalid();
    const type = groupTypes.has(originalType) ? 'group' : 'custom';
    if (n.type !== type) invalid();
    const style = n.style === undefined ? {} : object(n.style);
    const node: SimpleNodeData = {
      id: text(n.id, 100, true), type,
      position: { x: finite(p.x, -1e6, 1e6), y: finite(p.y, -1e6, 1e6) },
      data: { label: text(d.label, 120, true), originalType, description: text(d.description ?? '', 2000) },
      style: { zIndex: type === 'group' ? -1 : 10 },
    };
    // Allow only dimensions and colors used by the editor; never arbitrary CSS/HTML.
    if (style.width !== undefined) node.style!.width = finite(style.width, 20, 10000);
    if (style.height !== undefined) node.style!.height = finite(style.height, 20, 10000);
    if (d.customColor !== undefined) {
      const color = text(d.customColor, 7);
      if (!/^#[0-9a-f]{6}$/i.test(color)) invalid();
      node.data.customColor = color;
    }
    if (d.design !== undefined) node.data.design = normalizeNodeDesign(d.design);
    if (n.parentNode !== undefined) { node.parentNode = text(n.parentNode, 100, true); node.extent = 'parent'; }
    return node;
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  if (byId.size !== nodes.length) invalid();
  const ordered: SimpleNodeData[] = [];
  const visited = new Set<string>();
  function visit(node: SimpleNodeData, ancestors = new Set<string>()) {
    if (ancestors.has(node.id)) invalid();
    if (visited.has(node.id)) return;
    ancestors.add(node.id);
    if (node.parentNode) {
      const parent = byId.get(node.parentNode);
      if (!parent || parent.type !== 'group') invalid();
      visit(parent, ancestors);
    }
    visited.add(node.id); ordered.push(node);
  }
  nodes.forEach(n => visit(n));
  const edgeIds = new Set<string>();
  const edges = list(diagram.edges, 400).map((value, index) => {
    const e = object(value); const source = text(e.source, 100, true); const target = text(e.target, 100, true);
    if (!byId.has(source) || !byId.has(target)) invalid();
    const id = text(e.id ?? `import-edge-${index}`, 250, true);
    if (edgeIds.has(id)) invalid(); edgeIds.add(id);
    return { id, source, target, ...(e.data === undefined ? {} : { data: normalizeConnectionDesign(e.data) }) };
  });
  const chatHistory: ChatMessage[] = list(v.chatHistory, 1000).flatMap(value => {
    const m = object(value);
    if (m.role === 'system') return []; // Remove legacy browser-held system prompts.
    if (m.role !== 'user' && m.role !== 'model') invalid();
    return [{ role: m.role, content: text(m.content, 4000, true) }];
  });
  const interviewEvidence = list(v.interviewEvidence ?? [], 100).map(value => {
    const item = object(value);
    const questionMessageIndex = finite(item.questionMessageIndex, 0, 999);
    const answerMessageIndex = finite(item.answerMessageIndex, 0, 999);
    if (!Number.isInteger(questionMessageIndex) || !Number.isInteger(answerMessageIndex)) invalid();
    const question = text(item.question, 4000, true);
    const answer = text(item.answer, 4000, true);
    if (chatHistory[questionMessageIndex]?.role !== 'user' || chatHistory[questionMessageIndex]?.content !== question
      || chatHistory[answerMessageIndex]?.role !== 'model' || chatHistory[answerMessageIndex]?.content !== answer) invalid();
    return { conditionId: text(item.conditionId, 40, true), label: text(item.label, 80, true), question, answer, questionMessageIndex, answerMessageIndex };
  });
  if (new Set(interviewEvidence.map(item => item.conditionId)).size !== interviewEvidence.length) invalid();
  const version = text(v.version, 20, true);
  if (!/^\d{1,8}\.\d$/.test(version)) invalid();
  const timestamp = text(v.timestamp, 40, true);
  if (!Number.isFinite(Date.parse(timestamp))) invalid();
  // Old partial-success responses had no scores. Preserve the project, discard that unusable report.
  let evaluation = null;
  if (v.evaluation != null) {
    try { evaluation = parseEvaluation(v.evaluation); }
    catch (error) { if (v.schemaVersion !== undefined) throw error; }
  }
  // Old readers reject v3 instead of silently dropping these new annotations.
  const scenario = publicScenario(v.scenario);
  const extended = nodes.some(n => n.data.design !== undefined) || edges.some(e => e.data !== undefined) || scenario.customMode !== undefined || interviewEvidence.length > 0;
  return { schemaVersion: extended || v.schemaVersion === 3 ? 3 : 2, version, timestamp, projectId: text(v.projectId, 100, true),
    scenario, memo: text(v.memo ?? '', 100000),
    diagram: { nodes: ordered, edges }, chatHistory, interviewEvidence, evaluation };
}

function decodeJsonOrLegacyBase64(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const bytes = Uint8Array.from(atob(trimmed.replace(/ /g, '+')), char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function parseProject(content: string): ProjectSaveData {
  if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) invalid();
  return normalizeProject(decodeJsonOrLegacyBase64(content));
}
export function serializeProject(data: ProjectSaveData): string {
  const content = JSON.stringify(normalizeProject(data), null, 2);
  if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) invalid();
  return content;
}
export function parseChallenge(content: string): Scenario {
  if (content.length > 24000) invalid();
  return publicScenario(decodeJsonOrLegacyBase64(content));
}
export function createChallengeUrl(scenario: Scenario, base: string): string {
  const url = new URL(base);
  url.pathname = '/'; url.search = ''; url.hash = '';
  url.searchParams.set('challenge', JSON.stringify(publicScenario(scenario)));
  return url.toString();
}

// Limit only the provider context; retain the complete conversation in the local save.
export function chatContext(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []; let length = 0;
  for (const message of messages.slice(-100).reverse()) {
    if (length + message.content.length > 24000) break;
    result.unshift(message); length += message.content.length;
  }
  return result;
}
