import { useCallback, useRef, useState, useEffect, lazy, Suspense } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type NodeMouseHandler,
  type NodeDragHandler,
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
  AppNodeData,
} from "../types";
import { Header } from "./Header";
import { ChatInterface } from "./ChatInterface";
import { MemoPad } from "./MemoPad";
const EvaluationPanel = lazy(() => import("./EvaluationPanel").then(module => ({ default: module.EvaluationPanel })));
import { v4 as uuidv4 } from "uuid";
import { saveProjectToLocalFile } from "../utils/fileHandler";
import { nodeTypes, NODE_CATEGORIES } from "../constants/nodeTypes";
import { PropertiesPanel } from "./PropertiesPanel";
import { HelpModal } from "./HelpModal";

interface ArchitectureCanvasProps {
  selectedScenario: Scenario;
  onBackToSelection: () => void;
  loadedProjectData: ProjectSaveData | null;
}

import { API_BASE_URL } from "../config";
import { parseEvaluation, publicScenario } from "../utils/projectFormat";
import { postJson } from "../utils/api";

const getId = () => uuidv4();

const onDragOver = (event: React.DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

// グループとして扱うタイプ定義（新規作成時のラベル判定用）
const GROUP_TYPES = NODE_CATEGORIES.find(c => c.id === 'group')!.items.map(i => i.type);
const COMPONENT_TYPES = new Set(NODE_CATEGORIES.flatMap(c => c.items.map(i => i.type)));

function ArchitectureFlow({
  selectedScenario,
  onBackToSelection,
  loadedProjectData,
}: ArchitectureCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNodeData>(loadedProjectData?.diagram.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState((loadedProjectData?.diagram.edges ?? []).map((e, index) => ({ ...e, id: e.id ?? `loaded-edge-${index}` })));
  const { screenToFlowPosition, getNodes, getEdges, getIntersectingNodes, deleteElements } = useReactFlow();
  const [activeTab, setActiveTab] = useState<"chat" | "design" | "evaluate">(loadedProjectData?.evaluation ? "evaluate" : "chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadedProjectData?.chatHistory ?? [{ role: "model", content: `こんにちは。「${selectedScenario.title}」について、どのような点から詳細を詰めていきましょうか？` }]);
  const [memo, setMemo] = useState(loadedProjectData?.memo ?? "");
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(loadedProjectData?.evaluation ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [projectId] = useState(() => loadedProjectData?.projectId ?? uuidv4());
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [projectVersion, setProjectVersion] = useState(() => loadedProjectData ? (Number(loadedProjectData.version) + 1).toFixed(1) : "1.0");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const setSelectedNode = useCallback((node: Node<AppNodeData> | null) => setSelectedNodeId(node?.id ?? null), []);
  const currentScenario = selectedScenario;
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const evaluationRequest = useRef<AbortController | null>(null);
  useEffect(() => () => evaluationRequest.current?.abort(), []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => eds.length < 400 ? addEdge(params, eds) : eds),
    [setEdges]
  );

  // ----------------------------------------------------------------
  // 親子関係を解除する関数 (プロパティパネル用)
  // ----------------------------------------------------------------
  const handleDetachNode = useCallback(
    (id: string) => {
      setNodes((nds) => {
        // 対象ノードを探す
        const node = nds.find((n) => n.id === id);
        if (!node || !node.parentNode) return nds;

        // 親ノードを探す（絶対座標計算用）
        const parent = nds.find((p) => p.id === node.parentNode);

        let newPos = { ...node.position };
        if (parent) {
          // 現在の相対座標 + 親の絶対座標 = 新しい絶対座標
          const parentPos = parent.positionAbsolute || parent.position;
          newPos = {
            x: parentPos.x + node.position.x,
            y: parentPos.y + node.position.y,
          };
        }

        // 更新
        return nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              parentNode: undefined,
              position: newPos,
              extent: undefined, // 範囲制限解除
            };
          }
          return n;
        });
      });
      // 選択状態を解除
      setSelectedNode(null);
    },
    [setNodes, setSelectedNode]
  );

  // ----------------------------------------------------------------
  // ドラッグ終了時: 親子関係の設定 + 親の自動拡大
  // ----------------------------------------------------------------
  const onNodeDragStop: NodeDragHandler = useCallback(
    (_, node) => {
      // グループノード自身は何もしない (type === 'group' で判定)
      if (node.type === "group") return;

      // 重なっているグループノードを探す (type === 'group' で判定)
      const intersections = getIntersectingNodes(node).filter(
        (n) => n.type === "group"
      );

      const targetGroup = intersections[intersections.length - 1];

      if (targetGroup) {
        // 親の絶対座標
        const parentPos = targetGroup.positionAbsolute || targetGroup.position;
        // 子の絶対座標
        const childPos = node.positionAbsolute || node.position;

        // 相対座標に変換
        const relativePos = {
          x: childPos.x - parentPos.x,
          y: childPos.y - parentPos.y,
        };

        // 親のサイズを拡張するか判定
        const childWidth = node.width || 150;
        const childHeight = node.height || 40;
        const padding = 20;

        const requiredWidth = relativePos.x + childWidth + padding;
        const requiredHeight = relativePos.y + childHeight + padding;

        setNodes((nds) => {
          const updated = nds.map<Node<AppNodeData>>((n) => {
            // 親ノードのサイズ更新
            if (n.id === targetGroup.id) {
              const currentWidth = n.width || Number(n.style?.width) || 300;
              const currentHeight = n.height || Number(n.style?.height) || 200;

              let newWidth = currentWidth;
              let newHeight = currentHeight;
              let updated = false;

              if (requiredWidth > currentWidth) {
                newWidth = requiredWidth;
                updated = true;
              }
              if (requiredHeight > currentHeight) {
                newHeight = requiredHeight;
                updated = true;
              }

              if (updated) {
                return {
                  ...n,
                  style: { ...n.style, width: newWidth, height: newHeight },
                  width: newWidth,
                  height: newHeight,
                };
              }
              return n;
            }

            // 子ノードの更新
            if (n.id === node.id) {
              // 親が変わらない場合も、相対位置がずれている可能性があるため更新はかけるが、
              // すでにparentNodeが正しいならReactFlowが制御している
              if (n.parentNode === targetGroup.id) {
                return n;
              }

              return {
                ...n,
                parentNode: targetGroup.id,
                position: relativePos,
                extent: "parent", // 親から出られない
              };
            }
            return n;
          });
          // React Flow requires parents before their children (including deletion).
          const child = updated.find(n => n.id === node.id);
          return child ? [...updated.filter(n => n.id !== node.id), child] : updated;
        });
      }
    },
    [getIntersectingNodes, setNodes]
  );

  // ----------------------------------------------------------------
  // ドロップ時: 親子関係の設定 + 親の自動拡大
  // ----------------------------------------------------------------
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const label = event.dataTransfer.getData("application/reactflow/label");
      if (!COMPONENT_TYPES.has(label)) return;
      if (getNodes().length >= 200) { setNotice("コンポーネントは200個まで配置できます。"); return; }
      const type = GROUP_TYPES.includes(label) ? "group" : "custom";

      if (!reactFlowWrapper.current) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const allNodes = getNodes();
      // 重なり判定のターゲットを type === 'group' に限定
      const targetGroup = allNodes
        .slice()
        .reverse()
        .find((g) => {
          if (g.type !== "group") return false;
          // 自分自身がグループなら入れない
          if (type === "group") return false;

          const gPos = g.positionAbsolute || g.position;
          const gW = g.width ?? (Number(g.style?.width) || 300);
          const gH = g.height ?? (Number(g.style?.height) || 200);

          return (
            position.x >= gPos.x &&
            position.x <= gPos.x + gW &&
            position.y >= gPos.y &&
            position.y <= gPos.y + gH
          );
        });

      let finalPosition = position;
      let parentNodeId = undefined;
      let groupUpdate = null;

      if (targetGroup && type !== "group") {
        parentNodeId = targetGroup.id;
        const parentPos = targetGroup.positionAbsolute || targetGroup.position;
        finalPosition = {
          x: position.x - parentPos.x,
          y: position.y - parentPos.y,
        };

        // 親のサイズ拡張チェック
        const childWidth = 150;
        const childHeight = 40;
        const padding = 20;

        const requiredWidth = finalPosition.x + childWidth + padding;
        const requiredHeight = finalPosition.y + childHeight + padding;

        const currentWidth =
          targetGroup.width || Number(targetGroup.style?.width) || 300;
        const currentHeight =
          targetGroup.height || Number(targetGroup.style?.height) || 200;

        let newWidth = currentWidth;
        let newHeight = currentHeight;

        if (requiredWidth > currentWidth) newWidth = requiredWidth;
        if (requiredHeight > currentHeight) newHeight = requiredHeight;

        if (newWidth !== currentWidth || newHeight !== currentHeight) {
          groupUpdate = {
            id: targetGroup.id,
            width: newWidth,
            height: newHeight,
          };
        }
      }

      const newNode: Node<AppNodeData> = {
        id: getId(),
        type,
        selected: true,
        position: finalPosition,
        parentNode: parentNodeId,
        data: {
          label: label,
          originalType: label,
          description: "",
        },
        style:
          type === "group"
            ? { width: 300, height: 200, zIndex: -1 }
            : { zIndex: 10 },
        extent: parentNodeId ? "parent" : undefined,
      };

      setNodes((nds) => {
        let nextNodes = [...nds.map(n => ({ ...n, selected: false })), newNode];
        if (groupUpdate) {
          nextNodes = nextNodes.map((n) => {
            if (n.id === groupUpdate!.id) {
              return {
                ...n,
                width: groupUpdate!.width,
                height: groupUpdate!.height,
                style: {
                  ...n.style,
                  width: groupUpdate!.width,
                  height: groupUpdate!.height,
                },
              };
            }
            return n;
          });
        }
        return nextNodes;
      });
      setEdges(eds => eds.map(e => ({ ...e, selected: false })));
      setSelectedNode(newNode);
    },
    [screenToFlowPosition, setNodes, setEdges, getNodes, setSelectedNode]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === "custom" || node.type === "group") {
      setSelectedNode(node as Node<AppNodeData>);
    } else {
      setSelectedNode(null);
    }
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleNodeUpdate = useCallback(
    (id: string, newData: AppNodeData) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const updatedNode = { ...node, data: { ...newData } };
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
      setNotice("コンポーネントを配置してください");
      return;
    }
    if (evaluationRequest.current) return;
    const controller = new AbortController();
    evaluationRequest.current = controller;
    setIsLoading(true);
    const designData = {
      scenario: publicScenario(currentScenario),
      nodes: currentNodes.map((n) => {
        const data = n.data as AppNodeData;
        return {
          id: n.id,
          type: data.originalType || "Unknown",
          label: data.label,
          description: data.description || "",
          parentNode: n.parentNode,
        };
      }),
      edges: currentEdges.map((e) => ({ source: e.source, target: e.target })),
    };
    try {
      const result = parseEvaluation(await postJson(`${API_BASE_URL}/api/evaluate`, designData, controller.signal));
      if (controller.signal.aborted) return;
      setEvaluationResult(result);
      setActiveTab("evaluate");
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "評価中にエラーが発生しました。");
    } finally {
      evaluationRequest.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [getNodes, getEdges, currentScenario]);

  const onSaveProject = useCallback(async () => {
    setIsSaving(true);
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    try {
      const payload: ProjectSaveData = {
        schemaVersion: 2,
        version: projectVersion,
        timestamp: new Date().toISOString(),
        projectId: projectId,
        scenario: publicScenario(currentScenario),
        memo: memo,
        diagram: {
          nodes: currentNodes.map((n) => ({
            id: n.id,
            type: n.type as string,
            position: n.position,
            data: n.data as AppNodeData,
            style: n.style as React.CSSProperties,
            parentNode: n.parentNode,
            extent: n.extent === "parent" ? "parent" : undefined,
          })),
          edges: currentEdges.map((e) => ({
            source: e.source,
            target: e.target,
            id: e.id,
          })),
        },
        chatHistory: chatMessages,
        evaluation: evaluationResult,
      };
      const safeTitle = currentScenario.title.trim() || "untitled";
      const filename = `${safeTitle}_v${projectVersion}.json`;
      saveProjectToLocalFile(payload, filename);
      setNotice(`「${filename}」をローカルに保存しました。`);
      setProjectVersion((currentVer) => {
        const v = parseFloat(currentVer) || 1.0;
        return (v + 1.0).toFixed(1);
      });
    } catch (error) {
      console.error("Save Error:", error);
      setNotice(error instanceof Error ? error.message : "プロジェクトの保存中にエラーが発生しました。");
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
    projectId,
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

      {notice && <div role="status" style={{ padding: "8px 20px", background: "#fff3cd", display: "flex", justifyContent: "space-between" }}><span>{notice}</span><button onClick={() => setNotice("")} aria-label="通知を閉じる">閉じる</button></div>}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <>
        <div style={tabBarStyle}>
          <button
            style={activeTab === "chat" ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab("chat")}
          >
            <BiChat style={{ marginRight: "6px", verticalAlign: "middle" }} />{" "}
            要件定義・交渉
          </button>
          <button
            style={activeTab === "design" ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab("design")}
          >
            <BiNetworkChart
              style={{ marginRight: "6px", verticalAlign: "middle" }}
            />{" "}
            アーキテクチャ設計
          </button>
          <button
            style={activeTab === "evaluate" ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab("evaluate")}
          >
            <BiBarChart
              style={{ marginRight: "6px", verticalAlign: "middle" }}
            />{" "}
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
            <div style={{ display: activeTab === "chat" ? "block" : "none", width: "100%", height: "100%" }}>
              <ChatInterface
                scenario={currentScenario}
                messages={chatMessages}
                onSendMessage={setChatMessages}
              />
            </div>
            {activeTab === "evaluate" && (
              <div style={{ width: "100%", height: "100%" }}>
                <Suspense fallback={<div role="status">評価画面を読み込み中...</div>}>
              <EvaluationPanel
                  result={evaluationResult}
                  onEvaluate={onEvaluate}
                  isLoading={isLoading}
                  scenario={currentScenario}
                />
                </Suspense>
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
                  onNodeDragStop={onNodeDragStop}
                  nodeTypes={nodeTypes}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  deleteKeyCode={activeTab === "design" && !isHelpOpen ? ["Backspace", "Delete"] : null}
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
                    onDetach={handleDetachNode} // 切り離し関数を渡す
                    onDelete={(id) => {
                      deleteElements({ nodes: [{ id }] });
                      setSelectedNode(null);
                    }}
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
