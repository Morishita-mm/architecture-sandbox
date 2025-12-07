import { useCallback, useRef, useState } from "react";
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
import { EvaluationModal } from "./EvaluatinModal";
import type { EvaluationResult } from "../types";
import { SCENARIOS } from "../scenarios";
import { Header } from "./Header";
import { ChatInterface } from "./ChatInterface"; // 追加

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
  // --- モーダル用のState追加 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false); // ローディング表示用
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    SCENARIOS[0].id
  );
  const [activeTab, setActiveTab] = useState<"chat" | "design">("chat"); // 最初はチャットからスタート

  const currentScenario =
    SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

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

  // バックエンドAPIをコールする処理
  const onEvaluate = useCallback(async () => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    // 何も配置されていない場合は警告
    if (currentNodes.length === 0) {
      alert("コンポーネントを配置してください");
      return;
    }

    setIsLoading(true); // ローディング開始

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
      // 開発環境のURL
      const response = await fetch("http://localhost:8080/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(designData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: EvaluationResult = await response.json();

      // 結果をセットしてモーダルを開く
      setEvaluationResult(result);
      setIsModalOpen(true);
    } catch (error) {
      console.error("API Error:", error);
      alert(
        "評価中にエラーが発生しました。バックエンドのログを確認してください。"
      );
    } finally {
      setIsLoading(false); // ローディング終了
    }
  }, [getNodes, getEdges, currentScenario]);

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
        onScenarioChange={setSelectedScenarioId}
      />

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

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* チャットモード */}
        {activeTab === "chat" && (
          <div style={{ width: "100%", height: "100%" }}>
            <ChatInterface scenario={currentScenario} />
          </div>
        )}

        {/* 設計モード (既存のキャンバス部分) */}
        {/* Canvasは非表示時も状態を維持したいので display: none で制御するのがコツです */}
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
    </div>
  );
}

// --- Styles for Tabs ---
const tabBarStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "#f5f5f5",
  borderBottom: "1px solid #ddd",
  padding: "0 20px",
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

export function ArchitectureCanvas() {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow />
    </ReactFlowProvider>
  );
}
