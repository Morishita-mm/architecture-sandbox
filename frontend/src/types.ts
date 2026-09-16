export type ScenarioDifficulty = 'small' | 'medium' | 'large';
export type PartnerRole = 'cfo' | 'cto' | 'ceo';
export type CustomScenarioMode = 'guided' | 'self_defined';
export type ScenarioFamily = 'business' | 'content' | 'realtime' | 'transaction';

export interface Scenario {
  id: string;
  title: string;
  description: string;

  isCustom?: boolean;
  difficulty?: ScenarioDifficulty;
  partnerRole?: PartnerRole;
  customMode?: CustomScenarioMode;
  scenarioFamily?: ScenarioFamily;
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
  totalScore: number;
  details: DetailedScores;
  feedback: string;
  improvement: string;
  interview?: InterviewAssessment;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface InterviewEvidence {
  conditionId: string;
  label: string;
  question: string;
  answer: string;
  questionMessageIndex: number;
  answerMessageIndex: number;
}

export interface InterviewAssessment {
  confirmed: number;
  total: number;
  confirmedConditions: { id: string; label: string }[];
  missingConditions: { id: string; label: string }[];
}

export interface AppNodeData {
  label: string;
  originalType: string;
  description?: string;
  customColor?: string;
  design?: NodeDesign;
}

/** Optional learning annotations. Missing values mean unknown, never an implied default. */
export interface NodeDesign {
  implementation?: string;
  responsibility?: 'application' | 'authentication' | 'api' | 'notification' | 'payment';
  scope?: 'internal' | 'external';
  replicas?: number;
  redundancy?: string;
  backup?: string;
  recovery?: string;
  requirement?: string;
  evidence?: string;
  vpcId?: string;
  zoneId?: string;
  subnetId?: string;
  securityGroupIds?: string[];
  rules?: string;
}

export interface ConnectionDesign {
  payload?: string;
  protocol?: string;
  mode?: 'sync' | 'async';
  retry?: string;
}

// --- プロジェクト保存のための定義 ---
export interface SimpleNodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: AppNodeData;
  style?: Pick<React.CSSProperties, "width" | "height" | "zIndex">;
  parentNode?: string;
  extent?: "parent";
}

export interface SimpleEdgeData {
  id?: string;
  source: string;
  target: string;
  data?: ConnectionDesign;
}

/**
 * プロジェクトの保存ファイル全体の構造
 */
export interface ProjectSaveData {
  schemaVersion: 2 | 3;
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
  interviewEvidence: InterviewEvidence[];
  evaluation: EvaluationResult | null;
}
