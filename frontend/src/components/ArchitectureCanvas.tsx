import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from "reactflow";

import "reactflow/dist/style.css";
import { Sidebar } from "./Sidebar";
import { BiChat, BiNetworkChart, BiBarChart } from "react-icons/bi";
import type {
  EvaluationResult,
  ChatMessage,
  Scenario,
  ProjectSaveData,
  SimpleNodeData,
  SimpleEdgeData,
  AppNodeData,
} from "../types";
import { Header } from "./Header";
import { ChatInterface } from "./ChatInterface";
import { MemoPad } from "./MemoPad";
import { EvaluationPanel } from "./EvaluationPanel";
import { v4 as uuidv4 } from "uuid";
import { saveProjectToLocalFile } from "../utils/fileHandler";
import { nodeTypes } from "../constants/nodeTypes";
import { PropertiesPanel } from "./PropertiesPanel";
import { HelpModal } from "./HelpModal";

interface ArchitectureCanvasProps {
  selectedScenario: Scenario;
  onBackToSelection: () => void;
  loadedProjectData: ProjectSaveData | null;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let id = 0;
const getId = () => `dndnode_${id++}`;

const onDragOver = (event: React.DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

// グループとして扱うタイプ定義
const GROUP_TYPES = [
  "VPC",
  "VPC (Network)",
  "Availability Zone",
  "Subnet",
  "Security Group",
];

function ArchitectureFlow({
  selectedScenario,
  onBackToSelection,
  loadedProjectData,
}: ArchitectureCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // getIntersectingNodes を取得
  const { screenToFlowPosition, getNodes, getEdges, getIntersectingNodes } =
    useReactFlow();

  const [activeTab, setActiveTab] = useState<"chat" | "design" | "evaluate">(
    "chat"
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [memo, setMemo] = useState<string>("");
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const projectIdRef = useRef<string>(uuidv4());
  const [isSaving, setIsSaving] = useState(false);
  const [projectVersion, setProjectVersion] = useState<string>("1.0");

  const [selectedNode, setSelectedNode] = useState<Node<AppNodeData> | null>(
    null
  );

  const currentScenario = selectedScenario;
  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 初期化処理
  useEffect(() => {
    if (loadedProjectData) {
      setNodes(loadedProjectData.diagram.nodes as Node[]);
      setEdges(
        loadedProjectData.diagram.edges.map((e) => ({
          id: e.id || `e_${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
        })) as Edge[]
      );
      setChatMessages(loadedProjectData.chatHistory);
      setMemo(loadedProjectData.memo);
      if (loadedProjectData.evaluation) {
        setEvaluationResult(loadedProjectData.evaluation);
        setActiveTab("evaluate");
      }
      const loadedVer = parseFloat(loadedProjectData.version) || 1.0;
      const nextVer = (loadedVer + 1.0).toFixed(1);
      setProjectVersion(nextVer);
      return;
    }
    if (chatMessages.length === 0) {
      setProjectVersion("1.0");
      let initialMessages: ChatMessage[];
      if (currentScenario.isCustom) {
        const difficultySpecs = {
          small: {
            scale: "小規模（個人開発・社内ツール）",
            users: "50〜100人程度",
            budget: "月額5,000円以内 (可能な限り安く)",
            constraint:
              "運用コストをかけられないため、メンテナンスフリーな構成を好む",
          },
          medium: {
            scale: "中規模（急成長スタートアップ）",
            users: "10万DAU, ピーク時秒間100リクエスト",
            budget: "月額50万円〜100万円",
            constraint: "急激なアクセス増に耐えられるスケーラビリティが必須",
          },
          large: {
            scale: "大規模（ミッションクリティカル）",
            users: "1000万ユーザー, グローバル展開",
            budget: "無制限（可用性とレイテンシが最優先）",
            constraint:
              "単一障害点(SPOF)の完全排除と、データロス発生時の法的リスク回避",
          },
        };
        const spec = difficultySpecs[currentScenario.difficulty || "medium"];
        const hiddenSystemPrompt = `
---
Role: System Client
Task: Simulate a client for system architecture design.
Scenario:
  Title: "${currentScenario.title}"
  Description: "${currentScenario.description}"
  Scale: "${spec.scale}"
Hidden_Context:
  Users: "${spec.users}"
  Budget: "${spec.budget}"
  Critical_Constraint: "${spec.constraint}"
  Domain_Specific_Constraint: "Please invent one technical constraint specific to '${currentScenario.title}' (e.g., real-time requirement, legacy system integration)."
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
Please start the conversation by acknowledging the request for "${currentScenario.title}" and waiting for the user to interview you.
`.trim();
        initialMessages = [
          { role: "system", content: hiddenSystemPrompt },
          {
            role: "model",
            content: `ご依頼ありがとうございます。「${currentScenario.title}」のシステム構築ですね。\n\n今回のプロジェクトについて、どのような点から詳細を詰めていきましょうか？`,
          },
        ];
      } else {
        initialMessages = [
          {
            role: "model",
            content: `こんにちは。「${currentScenario.title}」の件についてですね。どのようなシステムをご提案いただけますか？`,
          },
        ];
      }
      setChatMessages(initialMessages);
    }
  }, [
    selectedScenario.id,
    loadedProjectData,
    chatMessages.length,
    setNodes,
    setEdges,
    currentScenario.isCustom,
    currentScenario.difficulty,
    currentScenario.title,
    currentScenario.description,
  ]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const label = event.dataTransfer.getData("application/reactflow/label");
      const type = GROUP_TYPES.includes(label) ? "group" : "custom";

      if (!reactFlowWrapper.current) return;

      // 1. ドロップした位置の「全体座標」を取得
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // 2. その位置にある「グループノード」を探す
      // (intersectingNodes等のヘルパーを使わず、生の座標データで判定するのが最も確実です)
      const allNodes = getNodes();

      // 手前にある（配列の後ろの方の）グループを優先して探す
      const targetGroup = allNodes
        .slice()
        .reverse()
        .find((g) => {
          // 自分自身がグループなら、他のグループには入れない（ネスト回避）
          if (type === "group") return false;
          // グループ以外は親になれない
          if (!GROUP_TYPES.includes(g.data.label || g.type)) return false;

          // グループの領域判定
          const gPos = g.position; // ※親がいないグループはこれが絶対座標
          const gW = g.width ?? 300;
          const gH = g.height ?? 200;

          return (
            position.x >= gPos.x &&
            position.x <= gPos.x + gW &&
            position.y >= gPos.y &&
            position.y <= gPos.y + gH
          );
        });

      // 3. 親子関係と座標の決定
      let newNodePos = position;
      let parentId = undefined;

      if (targetGroup) {
        // ★重要: 親が見つかったら、座標を「親の左上からの距離」に変換する
        parentId = targetGroup.id;
        newNodePos = {
          x: position.x - targetGroup.position.x,
          y: position.y - targetGroup.position.y,
        };
        console.log(
          "Parent found!",
          targetGroup.id,
          "Relative Pos:",
          newNodePos
        );
      }

      // 4. ノード生成
      const newNode: Node<AppNodeData> = {
        id: getId(),
        type,
        position: newNodePos, // 相対座標 or 絶対座標
        parentNode: parentId, // 親ID (これがあれば自動追従する)
        data: {
          label: label,
          originalType: label,
          description: "",
        },
        // グループの場合は最背面に、それ以外は前面に
        style:
          type === "group"
            ? { width: 300, height: 200, zIndex: -1 }
            : { zIndex: 10 },
        // 親がいる場合は、親の範囲外に出られないようにする（吸着感を出すため）
        extent: parentId ? "parent" : undefined,
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    },
    [screenToFlowPosition, setNodes, getNodes]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === "custom" || node.type === "group") {
      setSelectedNode(node as Node<AppNodeData>);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeUpdate = useCallback(
    (id: string, newData: AppNodeData) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const updatedNode = { ...node, data: { ...newData } };
            setSelectedNode(updatedNode as Node<AppNodeData>);
            return updatedNode;
          }
          return node;
        })
      );
    },
    [setNodes]
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
      nodes: currentNodes.map((n) => {
        const data = n.data as AppNodeData;
        return {
          id: n.id,
          type: data.originalType || "Unknown",
          label: data.label,
          description: data.description || "",
          position: n.position,
          parentNode: n.parentNode,
        };
      }),
      edges: currentEdges.map((e) => ({ source: e.source, target: e.target })),
    };
    try {
      const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(designData),
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
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
    try {
      const payload: ProjectSaveData = {
        version: projectVersion,
        timestamp: new Date().toISOString(),
        projectId: projectIdRef.current,
        scenario: currentScenario,
        memo: memo,
        diagram: {
          nodes: currentNodes.map((n) => ({
            id: n.id,
            type: n.type as string,
            position: n.position,
            data: n.data as AppNodeData,
            style: n.style as React.CSSProperties,
            parentNode: n.parentNode,
            extent: n.extent,
          })) as SimpleNodeData[],
          edges: currentEdges.map((e) => ({
            source: e.source,
            target: e.target,
            id: e.id,
          })) as SimpleEdgeData[],
        },
        chatHistory: chatMessages,
        evaluation: evaluationResult,
      };
      const safeTitle = currentScenario.title.trim() || "untitled";
      const filename = `${safeTitle}_v${projectVersion}.json`;
      saveProjectToLocalFile(payload, filename);
      alert(`「${filename}」をローカルに保存しました。`);
      setProjectVersion((currentVer) => {
        const v = parseFloat(currentVer) || 1.0;
        return (v + 1.0).toFixed(1);
      });
    } catch (error) {
      console.error("Save Error:", error);
      alert("プロジェクトの保存中にエラーが発生しました。");
    } finally {
      setIsSaving(false);
    }
  }, [
    getNodes,
    getEdges,
    currentScenario,
    chatMessages,
    memo,
    evaluationResult,
    projectVersion,
  ]);

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
        title={currentScenario.title}
        onBack={onBackToSelection}
        onSave={onSaveProject}
        isSaving={isSaving}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <>
        <div style={tabBarStyle}>
          <button
            style={activeTab === "chat" ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab("chat")}
          >
            <BiChat style={{ marginRight: "6px" }} /> 要件定義・交渉
          </button>
          <button
            style={activeTab === "design" ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab("design")}
          >
            <BiNetworkChart style={{ marginRight: "6px" }} /> アーキテクチャ設計
          </button>
          <button
            style={activeTab === "evaluate" ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab("evaluate")}
          >
            <BiBarChart style={{ marginRight: "6px" }} /> 評価結果
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
                  scenario={currentScenario}
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
                  nodeTypes={memoNodeTypes}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
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

                {selectedNode && (
                  <PropertiesPanel
                    selectedNode={selectedNode}
                    onChange={handleNodeUpdate}
                    onClose={() => setSelectedNode(null)}
                  />
                )}
              </div>
            </div>
          </div>
          <MemoPad value={memo} onChange={setMemo} />
        </div>
      </>
    </div>
  );
}

export function ArchitectureCanvas({
  selectedScenario,
  onBackToSelection,
  loadedProjectData,
}: ArchitectureCanvasProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow
        selectedScenario={selectedScenario}
        onBackToSelection={onBackToSelection}
        loadedProjectData={loadedProjectData}
      />
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
