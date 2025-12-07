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
} from "reactflow";

import "reactflow/dist/style.css";
import { Sidebar } from "./Sidebar";
import { EvaluationModal } from "./EvaluationModal";
import type { EvaluationResult, ChatMessage } from "../types";
import { SCENARIOS } from "../scenarios";
import { Header } from "./Header";
import { ChatInterface } from "./ChatInterface";
import { MemoPad } from "./MemoPad";
import { v4 as uuidv4 } from 'uuid';

let id = 0;
const getId = () => `dndnode_${id++}`;

const onDragOver = (event: React.DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
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
  const [activeTab, setActiveTab] = useState<"chat" | "design">("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [memo, setMemo] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // プロジェクトID (初回レンダリング時に生成)
  const projectIdRef = useRef<string>(uuidv4());
  const [isSaving, setIsSaving] = useState(false);

  // 現在のシナリオオブジェクト
  const currentScenario =
    SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  // シナリオ変更時の処理（履歴とメモのリセット）
  const handleScenarioChange = (newId: string) => {
    setSelectedScenarioId(newId);

    const targetScenario =
      SCENARIOS.find((s) => s.id === newId) || SCENARIOS[0];

    // チャット履歴をリセットし、最初の挨拶を入れる
    setChatMessages([
      {
        role: "model",
        content: `こんにちは。「${targetScenario.title}」の件についてですね。どのようなシステムをご提案いただけますか？`,
      },
    ]);

    // メモもリセット
    setMemo("");
  };

  // 初回起動時の挨拶
  useEffect(() => {
    // まだメッセージがない場合のみ初期化
    if (chatMessages.length === 0) {
      setChatMessages([
        {
          role: "model",
          content: `こんにちは。「${currentScenario.title}」の件についてですね。どのようなシステムをご提案いただけますか？`,
        },
      ]);
    }
  }, []); // 初回のみ実行

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow/type");
      const label = event.dataTransfer.getData("application/reactflow/label");

      if (!reactFlowWrapper.current) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: label },
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
      scenario: currentScenario,
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
      const response = await fetch("http://localhost:8080/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(designData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: EvaluationResult = await response.json();
      setEvaluationResult(result);
      setIsModalOpen(true);
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
      id: projectIdRef.current, // UUID
      title: `${currentScenario.title}の設計`, // 簡易的にシナリオ名をタイトルに
      scenario_id: currentScenario.id,
      diagram_data: {
        nodes: currentNodes,
        edges: currentEdges
      },
      chat_history: chatMessages
    };

    try {
      const response = await fetch('http://localhost:8080/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save');

      const result = await response.json();
      console.log('Save result:', result);
      alert('プロジェクトを保存しました！'); // 簡易通知

    } catch (error) {
      console.error(error);
      alert('保存に失敗しました。');
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
      {/* 1. ヘッダー */}
      <Header
        selectedScenarioId={selectedScenarioId}
        onScenarioChange={handleScenarioChange}
        onSave={onSaveProject}
        isSaving={isSaving}
      />

      {/* 2. タブバー */}
      <div style={tabBarStyle}>
        <button
          style={activeTab === "chat" ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab("chat")}
        >
          💬 要件定義 (Chat)
        </button>
        <button
          style={activeTab === "design" ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab("design")}
        >
          🛠️ アーキテクチャ設計 (Canvas)
        </button>
      </div>

      {/* 3. メインコンテンツ + メモ帳 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* コンテンツエリア (チャット/キャンバス) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* A. チャットモード */}
          {activeTab === "chat" && (
            <div style={{ width: "100%", height: "100%" }}>
              <ChatInterface
                scenario={currentScenario}
                messages={chatMessages}
                onSendMessage={setChatMessages}
              />
            </div>
          )}

          {/* B. 設計モード (非表示時は display: none で維持) */}
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
              <EvaluationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                result={evaluationResult}
              />
            </div>
          </div>
        </div>

        {/* 4. メモ帳 (常に右端に表示) */}
        <MemoPad value={memo} onChange={setMemo} />
      </div>
    </div>
  );
}

// --- export ---
export function ArchitectureCanvas() {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow />
    </ReactFlowProvider>
  );
}

// --- Styles ---
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
