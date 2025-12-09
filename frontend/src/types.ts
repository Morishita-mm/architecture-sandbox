export type ScenarioDifficulty = 'small' | 'medium' | 'large';
export type PartnerRole = 'cfo' | 'cto' | 'ceo';

export interface ScenarioRequirements {
  users: string;
  traffic: string;
  availability: string;
  budget: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  requirements: ScenarioRequirements;

  isCustom?: boolean;
  difficulty?: ScenarioDifficulty;
  partnerRole?: PartnerRole;
}

export interface EvaluationResult {
  scenarioId: string;
  score: number;
  feedback: string;
  improvement: string;
}

export interface NodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
}

export interface EdgeData {
  source: string;
  target: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}