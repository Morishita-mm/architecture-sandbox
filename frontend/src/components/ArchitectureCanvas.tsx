import { useCallback, useRef, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  type Node,
} from "reactflow";

import "reactflow/dist/style.css";
import { Sidebar } from "./Sidebar";
import { EvaluationModal } from "./EvaluationModal";
import { BiChat, BiNetworkChart, BiBarChart } from "react-icons/bi";
import type { EvaluationResult, ChatMessage, Scenario } from "../types";
import { SCENARIOS } from "../scenarios";
import { Header } from "./Header";
import { ChatInterface } from "./ChatInterface";
import { MemoPad } from "./MemoPad";
import { ScenarioSetup } from "./ScenarioSetup"; // 新規作成したコンポーネントをインポート
import { EvaluationPanel } from "./EvaluationPanel";
import { v4 as uuidv4 } from "uuid";

// ▼ API_BASE_URLの定義
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let id = 0;
const getId = () => `dndnode_${id++}`;

const onDragOver = (event: React.DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

// カスタムシナリオのデフォルトテンプレート（scenarios.tsに未定義の場合のフォールバック）
const DEFAULT_CUSTOM_SCENARIO: Scenario = {
  id: "custom",
  title: "カスタム設計（フリーモード）",
  description: "独自の要件を入力して、ゼロからアーキテクチャを設計します。",
  isCustom: true,
  requirements: {
    users: "",
    traffic: "",
    availability: "",
    budget: "",
  },
};

function ArchitectureFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();

  // --- アプリケーションの状態 ---
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    SCENARIOS[0].id
  );

  // カスタムシナリオの状態管理
  const [customScenario, setCustomScenario] = useState<Scenario>(
    SCENARIOS.find((s) => s.id === "custom") || DEFAULT_CUSTOM_SCENARIO
  );

  // カスタム設定が完了しているかどうかのフラグ
  // 初期状態: 選択中のシナリオがカスタムでなければ完了扱い(true)、カスタムなら未完了(false)
  const [isCustomSetupDone, setIsCustomSetupDone] = useState(true);

  const [activeTab, setActiveTab] = useState<"chat" | "design" | "evaluate">("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [memo, setMemo] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const projectIdRef = useRef<string>(uuidv4());
  const [isSaving, setIsSaving] = useState(false);

  // 現在のシナリオオブジェクト（カスタム選択時はStateの値を使用）
  const currentScenario =
    selectedScenarioId === "custom"
      ? customScenario
      : SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  const handleCustomSetupComplete = (setupScenario: Scenario) => {
    setCustomScenario(setupScenario);
    setIsCustomSetupDone(true);

    // 難易度に応じたパラメータの定義（ここで具体的な値を決定してしまう）
    const difficultySpecs = {
      small: {
        scale: "小規模（個人開発・社内ツール）",
        users: "50〜100人程度",
        budget: "月額5,000円以内 (可能な限り安く)",
        constraint: "運用コストをかけられないため、メンテナンスフリーな構成を好む"
      },
      medium: {
        scale: "中規模（急成長スタートアップ）",
        users: "10万DAU, ピーク時秒間100リクエスト",
        budget: "月額50万円〜100万円",
        constraint: "急激なアクセス増に耐えられるスケーラビリティが必須"
      },
      large: {
        scale: "大規模（ミッションクリティカル）",
        users: "1000万ユーザー, グローバル展開",
        budget: "無制限（可用性とレイテンシが最優先）",
        constraint: "単一障害点(SPOF)の完全排除と、データロス発生時の法的リスク回避"
      }
    };

    const spec = difficultySpecs[setupScenario.difficulty || 'medium'];

    // ★YAML形式でのシステムプロンプト構築
    const hiddenSystemPrompt = `
---
Role: System Client
Task: Simulate a client for system architecture design.

Scenario:
  Title: "${setupScenario.title}"
  Description: "${setupScenario.description}"
  Scale: "${spec.scale}"

Hidden_Context:
  # DO NOT reveal these values unless explicitly asked.
  Users: "${spec.users}"
  Budget: "${spec.budget}"
  Critical_Constraint: "${spec.constraint}"
  Domain_Specific_Constraint: "Please invent one technical constraint specific to '${setupScenario.title}' (e.g., real-time requirement, legacy system integration)."

Behavior_Rules:
  - Act as a non-technical stakeholder initially.
  - Reveal "Hidden_Context" information ONLY when the user asks specifically about relevant topics (e.g., "How many users?", "What is the budget?").
  - If the user presents a design without uncovering the "Critical_Constraint", point out the flaw in the evaluation phase, not during the chat.
  - Be professional but demanding.

Evaluation_Criteria:
  - Did the user ask about the scale/users?
  - Did the user ask about the budget?
  - Does the proposed architecture solve the Critical_Constraint?
---

Please start the conversation by acknowledging the request for "${setupScenario.title}" and waiting for the user to interview you.
`.trim();

    setChatMessages([
      // 1. システムプロンプト（YAML形式）
      { role: "system", content: hiddenSystemPrompt },
      // 2. AIからの最初の挨拶
      {
        role: "model",
        content: `ご依頼ありがとうございます。「${setupScenario.title}」のシステム構築ですね。\n\n今回のプロジェクトについて、どのような点から詳細を詰めていきましょうか？`,
      },
    ]);
  };

  // シナリオ変更時の処理
  const handleScenarioChange = (newId: string) => {
    setSelectedScenarioId(newId);

    // チャット履歴とメモをリセット
    setChatMessages([]);
    setMemo("");

    if (newId === "custom") {
      // カスタムモード: 設定画面へ遷移
      setIsCustomSetupDone(false);
    } else {
      // 既存シナリオ: 即座に開始＆挨拶メッセージ
      setIsCustomSetupDone(true);
      const targetScenario =
        SCENARIOS.find((s) => s.id === newId) || SCENARIOS[0];
      setChatMessages([
        {
          role: "model",
          content: `こんにちは。「${targetScenario.title}」の件についてですね。どのようなシステムをご提案いただけますか？`,
        },
      ]);
    }
  };

  // キャンセル時の処理（デフォルトに戻す）
  const handleCustomSetupCancel = () => {
    handleScenarioChange(SCENARIOS[0].id);
  };

  // 初回起動時の挨拶（カスタム以外の初期シナリオ用）
  useEffect(() => {
    if (chatMessages.length === 0 && selectedScenarioId !== "custom") {
      setChatMessages([
        {
          role: "model",
          content: `こんにちは。「${currentScenario.title}」の件についてですね。どのようなシステムをご提案いただけますか？`,
        },
      ]);
    }
  }, []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow/type");
      const label = event.dataTransfer.getData("application/reactflow/label");
      const color = event.dataTransfer.getData("application/reactflow/color");
      const bgColor = event.dataTransfer.getData(
        "application/reactflow/bgcolor"
      );

      if (!reactFlowWrapper.current) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: label },
        style: {
          border: `2px solid ${color || "#777"}`,
          backgroundColor: bgColor || "#fff",
          borderRadius: "8px",
          padding: "10px",
          fontWeight: "bold",
          minWidth: "150px",
          textAlign: "center",
          fontSize: "14px",
          color: "#333",
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  const onEvaluate = useCallback(async () => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    if (currentNodes.length === 0) {
      alert("コンポーネントを配置してください");
      return;
    }

    setIsLoading(true);

    const designData = {
      scenario: currentScenario, // 動的に更新されたシナリオが送信されます
      nodes: currentNodes.map((n) => ({
        id: n.id,
        type: n.data.label,
        position: n.position,
      })),
      edges: currentEdges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(designData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: EvaluationResult = await response.json();
      setEvaluationResult(result);
      setActiveTab("evaluate");
    } catch (error) {
      console.error("API Error:", error);
      alert("評価中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }, [getNodes, getEdges, currentScenario]);

  const onSaveProject = useCallback(async () => {
    setIsSaving(true);
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const payload = {
      id: projectIdRef.current,
      title: `${currentScenario.title}の設計`,
      scenario_id: currentScenario.id,
      diagram_data: {
        nodes: currentNodes,
        edges: currentEdges,
      },
      chat_history: chatMessages,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save");

      const result = await response.json();
      console.log("Save result:", result);
      alert("プロジェクトを保存しました！");
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }, [getNodes, getEdges, currentScenario, chatMessages]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100vh",
      }}
    >
      <Header
        selectedScenarioId={selectedScenarioId}
        onScenarioChange={handleScenarioChange}
        onSave={onSaveProject}
        isSaving={isSaving}
      />

      {/* フロー制御: 設定未完了の場合はセットアップ画面を表示 */}
      {!isCustomSetupDone ? (
        <ScenarioSetup
          initialScenario={customScenario}
          onConfirm={handleCustomSetupComplete}
          onCancel={handleCustomSetupCancel}
        />
      ) : (
        <>
          <div style={tabBarStyle}>
            <button
              style={activeTab === "chat" ? activeTabStyle : tabStyle}
              onClick={() => setActiveTab("chat")}
            >
              <BiChat style={{ marginRight: "6px", verticalAlign: "middle" }} />
              要件定義・交渉
            </button>
            <button
              style={activeTab === "design" ? activeTabStyle : tabStyle}
              onClick={() => setActiveTab("design")}
            >
              <BiNetworkChart style={{ marginRight: "6px", verticalAlign: "middle" }} />
              アーキテクチャ設計
            </button>
            <button
              style={activeTab === "evaluate" ? activeTabStyle : tabStyle}
              onClick={() => setActiveTab("evaluate")}
            >
              <BiBarChart style={{ marginRight: "6px", verticalAlign: "middle" }} />
              評価結果
            </button>
          </div>

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {activeTab === "chat" && (
                <div style={{ width: "100%", height: "100%" }}>
                  <ChatInterface
                    scenario={currentScenario}
                    messages={chatMessages}
                    onSendMessage={setChatMessages}
                  />
                </div>
              )}

              {activeTab === "evaluate" && (
                <div style={{ width: "100%", height: "100%" }}>
                  <EvaluationPanel
                    result={evaluationResult}
                    onEvaluate={onEvaluate}
                    isLoading={isLoading}
                  />
                </div>
              )}

              <div
                style={{
                  display: activeTab === "design" ? "flex" : "none",
                  width: "100%",
                  height: "100%",
                }}
              >
                <Sidebar />
                <div
                  className="reactflow-wrapper"
                  ref={reactFlowWrapper}
                  style={{ flex: 1, height: "100%", position: "relative" }}
                >
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    fitView
                  >
                    <Background />
                    <Controls />
                    <MiniMap />
                    <Panel position="top-right">
                      <button
                        onClick={onEvaluate}
                        disabled={isLoading}
                        style={{
                          padding: "10px 20px",
                          fontSize: "16px",
                          backgroundColor: isLoading ? "#ccc" : "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "5px",
                          cursor: isLoading ? "wait" : "pointer",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                        }}
                      >
                        {isLoading ? "AIが評価中..." : "設計完了（評価する）"}
                      </button>
                    </Panel>
                  </ReactFlow>
                </div>
              </div>
            </div>

            <MemoPad value={memo} onChange={setMemo} />
          </div>
        </>
      )}
    </div>
  );
}

export function ArchitectureCanvas() {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow />
    </ReactFlowProvider>
  );
}

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "#f5f5f5",
  borderBottom: "1px solid #ddd",
  padding: "0 20px",
  flexShrink: 0,
};

const tabStyle: React.CSSProperties = {
  padding: "15px 30px",
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: "16px",
  color: "#666",
  borderBottom: "3px solid transparent",
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: "#2196F3",
  fontWeight: "bold",
  borderBottom: "3px solid #2196F3",
};
