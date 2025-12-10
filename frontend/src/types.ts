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

export interface DetailedScores {
  availability: number;
  scalability: number;
  security: number;
  maintainability: number;
  costEfficiency: number;
  feasibility: number;
}

export interface EvaluationResult {
  score: number;
  totalScore: number;
  details: DetailedScores;
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

export interface AppNodeData {
  label: string;
  originalType: string;
  description?: string;
  customColor?: string;
}

// --- プロジェクト保存のための定義 ---
export interface SimpleNodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: AppNodeData;
  style?: React.CSSProperties;
}

export interface SimpleEdgeData {
  id?: string;
  source: string;
  target: string;
}

/**
 * プロジェクトの保存ファイル全体の構造
 */
export interface ProjectSaveData {
  version: string;
  timestamp: string;
  projectId: string;
  scenario: Scenario;
  memo: string;
  diagram: {
    nodes: SimpleNodeData[];
    edges: SimpleEdgeData[];
  };
  chatHistory: ChatMessage[];
  evaluation: EvaluationResult | null;
}