import type { Scenario, SimpleNodeData, SimpleEdgeData, InterviewEvidence } from '../types';
import { publicScenario } from './projectFormat.ts';
import { nodeDesignSummary, connectionSummary } from './designModel.ts';

// Exactly the information sent to the evaluator. Layout/selection is not a design change.
type EvaluatedNode = Pick<SimpleNodeData, 'id' | 'data' | 'parentNode'>;
export function evaluationInput(scenario: Scenario, nodes: EvaluatedNode[], edges: SimpleEdgeData[], interviewEvidence: InterviewEvidence[] = []) {
  return { scenario: publicScenario(scenario), nodes: nodes.map(n => ({
    id: n.id, type: n.data.originalType, label: n.data.label,
    description: [n.data.description || '', n.data.design && nodeDesignSummary(n.data.design), ...edges.filter(e => e.source === n.id && e.data).map(e => `接続先ID ${e.target}: ${connectionSummary(e.data!)}`).sort()].filter(Boolean).join('\n'), parentNode: n.parentNode,
  })), edges: edges.map(e => ({ source: e.source, target: e.target })), interviewEvidence };
}

// Preserve the current public API. Never silently truncate user evidence to fit it.
export function checkEvaluationSize(input: ReturnType<typeof evaluationInput>) {
  const tooLong = input.nodes.find(n => [...n.description].length > 2000);
  if (tooLong) throw new Error(`「${tooLong.label}」の詳細と接続の説明が合計2,000文字を超えています。短くしてから評価してください。保存はできます。`);
  if (input.nodes.reduce((sum, n) => sum + [...n.description, ...n.label].length, 0) > 24000 || new TextEncoder().encode(JSON.stringify(input)).length > 128 * 1024) {
    throw new Error('評価に送る設計の説明が上限を超えています。詳細を短くしてから評価してください。保存はできます。');
  }
}

export function evaluationKey(scenario: Scenario, diagram: { nodes: EvaluatedNode[]; edges: SimpleEdgeData[] }, interviewEvidence: InterviewEvidence[] = []) {
  const input = evaluationInput(scenario, diagram.nodes, diagram.edges, interviewEvidence);
  input.nodes.sort((a, b) => a.id.localeCompare(b.id));
  input.edges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  input.interviewEvidence.sort((a, b) => a.conditionId.localeCompare(b.conditionId));
  return JSON.stringify(input);
}
