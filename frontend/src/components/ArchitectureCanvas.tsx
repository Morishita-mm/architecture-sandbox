import { useCallback, useRef, useState, useEffect, useLayoutEffect, lazy, Suspense } from "react";
import {
  type Node,
  type NodeMouseHandler,
  type NodeDragHandler,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from "reactflow";

import { DiagramCanvas } from "./DiagramCanvas";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { Sidebar } from "./Sidebar";
import { BiChat, BiNetworkChart, BiBarChart, BiChevronLeft, BiChevronRight, BiBulb } from "react-icons/bi";
import type {
  EvaluationResult,
  ChatMessage,
  Scenario,
  ProjectSaveData,
  AppNodeData,
  InterviewEvidence,
  NegotiationProposal,
  RequirementRevision,
} from "../types";
import { Header } from "./Header";
import { ChatInterface } from "./ChatInterface";
import { MemoPad } from "./MemoPad";
import { DesignNoteDialog } from "./DesignNoteDialog";
const EvaluationPanel = lazy(() => import("./EvaluationPanel").then(module => ({ default: module.EvaluationPanel })));
import { v4 as uuidv4 } from "uuid";
import { saveProjectToLocalFile } from "../utils/fileHandler";
import { NODE_CATEGORIES } from "../constants/nodeTypes";
import { PropertiesPanel } from "./PropertiesPanel";
import { ConnectionPanel } from "./ConnectionPanel";
import { DesignReviewDialog } from "./DesignReviewDialog";
import { HelpModal } from "./HelpModal";

interface ArchitectureCanvasProps {
  selectedScenario: Scenario;
  onBackToSelection: () => void;
  loadedProjectData: ProjectSaveData | null;
  loadedEvaluationKey?: string | null;
  initialTab?: "chat" | "design";
}

import { API_BASE_URL } from "../config";
import { parseEvaluation, publicScenario } from "../utils/projectFormat";
import { postJson } from "../utils/api";
import { useDiagramEditor, diagramHistoryShortcut, COMPONENT_DRAG_TYPE } from "../utils/useDiagramEditor";
import { insertDiagramNode } from "../utils/diagramEditing";
import { NODE_CARD_WIDTH, NODE_CARD_MIN_HEIGHT } from "../utils/nodeStyles";
import { evaluationInput, evaluationKey, checkEvaluationSize } from "../utils/designSnapshot";
import { saveDraft } from "../utils/draftStore";
import { useLocalDraft } from "../utils/useLocalDraft";

const getId = () => uuidv4();

// グループとして扱うタイプ定義（新規作成時のラベル判定用）
const GROUP_TYPES = NODE_CATEGORIES.find(c => c.id === 'group')!.items.map(i => i.type);
const COMPONENT_TYPES = new Set(NODE_CATEGORIES.flatMap(c => c.items.map(i => i.type)));
type SidePanel = "memo" | "components";

function ArchitectureFlow({
  selectedScenario,
  onBackToSelection,
  loadedProjectData,
  loadedEvaluationKey = null,
  initialTab = "chat",
}: ArchitectureCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const editor = useDiagramEditor<AppNodeData>({ nodes: (loadedProjectData?.diagram.nodes ?? []) as Node<AppNodeData>[], edges: (loadedProjectData?.diagram.edges ?? []).map((e, index) => ({ ...e, id: e.id ?? `loaded-edge-${index}` })) });
  const { history, dispatch: dispatchDiagram, setNodes, setEdges, onNodesChange, onEdgesChange, onConnect } = editor;
  const { nodes, edges } = history.present;
  const { screenToFlowPosition, getViewport, setViewport, getNodes, getEdges, getIntersectingNodes, deleteElements } = useReactFlow();
  const [activeTab, setActiveTab] = useState<"chat" | "design" | "evaluate">(loadedProjectData?.evaluation ? "evaluate" : initialTab);
  const [currentScenario, setCurrentScenario] = useState(selectedScenario);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadedProjectData?.chatHistory ?? [{ role: "model", content: selectedScenario.customMode === 'self_defined'
    ? `こんにちは。「${selectedScenario.title}」の仕様を一緒に整理します。今わかっている条件から、どの点を確かめましょうか？`
    : `こんにちは。「${selectedScenario.title}」の今回のケースは「${selectedScenario.description}」です。どの条件から詳しく確認しますか？` }]);
  const [memo, setMemo] = useState(loadedProjectData?.memo ?? "");
  const [interviewEvidence, setInterviewEvidence] = useState<InterviewEvidence[]>(loadedProjectData?.interviewEvidence ?? []);
  const [requirementRevisions, setRequirementRevisions] = useState<RequirementRevision[]>(loadedProjectData?.requirementRevisions ?? []);
  const [evaluatedKey, setEvaluatedKey] = useState<string | null>(loadedEvaluationKey);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(loadedProjectData?.evaluation ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [projectId] = useState(() => loadedProjectData?.projectId ?? uuidv4());
  const [notice, setNotice] = useState("");
  const [leaveWithoutSaving, setLeaveWithoutSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projectVersion, setProjectVersion] = useState(() => loadedProjectData ? (Number(loadedProjectData.version) + 1).toFixed(1) : "1.0");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const setSelectedNode = useCallback((node: Node<AppNodeData> | null) => { setSelectedNodeId(node?.id ?? null); if (node) setSelectedEdgeId(null); }, []);
  const acceptNegotiation = useCallback((proposal: NegotiationProposal) => {
    const accepted = currentScenario.acceptedNegotiationIds ?? [];
    if (accepted.includes(proposal.optionId)) return;
    const nextVersion = (currentScenario.specificationVersion ?? 1) + 1;
    setCurrentScenario({
      ...currentScenario,
      acceptedNegotiationIds: [...accepted, proposal.optionId],
      specificationVersion: nextVersion,
    });
    setRequirementRevisions(revisions => [
      ...revisions,
      { ...proposal, version: nextVersion, acceptedAt: new Date().toISOString() },
    ]);
    setNotice(`仕様v${nextVersion}として「${proposal.label}」の変更を確定しました。評価はこの仕様で行います。`);
  }, [currentScenario]);
  const [helpTopic, setHelpTopic] = useState<'index' | 'learning' | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const isHelpOpen = helpTopic !== null || isNoteOpen || isReviewOpen;
  const inspectDesign = (nodeId?: string, edgeId?: string) => {
    setActiveTab('design'); setMobilePanel(null); setSelectedNodeId(nodeId ?? null); setSelectedEdgeId(edgeId ?? null);
    requestAnimationFrame(() => { document.getElementById(nodeId ? 'node-label' : 'edge-payload')?.focus(); });
  };
  const [panelWidths, setPanelWidths] = useState<Partial<Record<SidePanel, number>>>({});
  const [isMemoOpen, setIsMemoOpen] = useState(true);
  const [isComponentsOpen, setIsComponentsOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<SidePanel | null>(null);
  const [isCompact, setIsCompact] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const memoToggleRef = useRef<HTMLButtonElement>(null);
  const componentsToggleRef = useRef<HTMLButtonElement>(null);
  const focusPanelOnOpen = useRef<SidePanel | null>(null);
  const memoVisible = isMemoOpen && (!isCompact || mobilePanel === "memo");
  const componentsVisible = activeTab === "design" && isComponentsOpen && (!isCompact || mobilePanel === "components");
  const canvasOrigin = useRef<{ x: number; y: number } | null>(null);

  const rememberCanvasOrigin = () => {
    if (activeTab !== "design" || !reactFlowWrapper.current) return;
    const { x, y } = reactFlowWrapper.current.getBoundingClientRect();
    canvasOrigin.current = { x, y };
  };

  const resizePanel = (panel: SidePanel, width: number) => {
    rememberCanvasOrigin();
    setPanelWidths(previous => ({ ...previous, [panel]: width }));
  };

  useLayoutEffect(() => {
    const previous = canvasOrigin.current;
    canvasOrigin.current = null;
    if (activeTab !== "design" || !reactFlowWrapper.current) return;
    const { x, y } = reactFlowWrapper.current.getBoundingClientRect();
    if (previous && (previous.x !== x || previous.y !== y)) {
      // Keep nodes at the same screen position when a docked panel moves the canvas origin.
      const viewport = getViewport();
      setViewport({ ...viewport, x: viewport.x + previous.x - x, y: viewport.y + previous.y - y });
    }
  }, [activeTab, componentsVisible, memoVisible, panelWidths, getViewport, setViewport]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setIsCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const panel = focusPanelOnOpen.current;
    if (panel && (panel === "memo" ? memoVisible : componentsVisible)) {
      document.getElementById(`${panel}-panel`)?.querySelector<HTMLElement>("aside")?.focus();
      focusPanelOnOpen.current = null;
    }
  }, [memoVisible, componentsVisible]);

  const closePanel = (panel: SidePanel) => {
    rememberCanvasOrigin();
    if (panel === "memo") setIsMemoOpen(false);
    else setIsComponentsOpen(false);
    setMobilePanel(isCompact ? null : panel === "components" && isMemoOpen ? "memo" : panel === "memo" && componentsVisible ? "components" : null);
    (panel === "memo" ? memoToggleRef : componentsToggleRef).current?.focus();
  };
  const togglePanel = (panel: SidePanel) => {
    if (panel === "memo" ? memoVisible : componentsVisible) return closePanel(panel);
    rememberCanvasOrigin();
    if (panel === "memo") setIsMemoOpen(true);
    else setIsComponentsOpen(true);
    setMobilePanel(panel);
    focusPanelOnOpen.current = panel;
  };
  const selectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobilePanel(tab === "design" && isComponentsOpen ? "components" : null);
  };
  const onPanelKeyDown = (event: React.KeyboardEvent, panel: SidePanel) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePanel(panel);
    }
  };
  const evaluationRequest = useRef<AbortController | null>(null);
  const chatRequest = useRef<AbortController | null>(null);
  useEffect(() => () => evaluationRequest.current?.abort(), []);

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
        (n) => n.type === "group" && n.data.originalType !== "Security Group"
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
        const childWidth = node.width || NODE_CARD_WIDTH;
        const childHeight = node.height || NODE_CARD_MIN_HEIGHT;
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
  // コンポーネント追加: ドロップと一覧からの選択で共通の親子関係・上限を適用
  // ----------------------------------------------------------------
  const addComponent = useCallback(
    (label: string, position: { x: number; y: number }) => {
      if (!COMPONENT_TYPES.has(label)) return;
      if (getNodes().length >= 200) { setNotice("コンポーネントは200個まで配置できます。"); return; }
      const type = GROUP_TYPES.includes(label) ? "group" : "custom";

      const allNodes = getNodes();
      // 重なり判定のターゲットを type === 'group' に限定
      const targetGroup = allNodes
        .slice()
        .reverse()
        .find((g) => {
          if (g.type !== "group" || g.data.originalType === "Security Group") return false;
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
        const childWidth = NODE_CARD_WIDTH;
        const childHeight = NODE_CARD_MIN_HEIGHT;
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

      dispatchDiagram({ type: 'change', update: graph => {
        const inserted = insertDiagramNode(graph, newNode);
        let nextNodes = inserted.nodes;
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
        return { ...inserted, nodes: nextNodes };
      } });
      setSelectedNode(newNode);
      return newNode;
    },
    [dispatchDiagram, getNodes, setSelectedNode]
  );

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    addComponent(event.dataTransfer.getData(COMPONENT_DRAG_TYPE), screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [addComponent, screenToFlowPosition]);

  const onAddFromSidebar = (label: string) => {
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    const isGroup = GROUP_TYPES.includes(label);
    const width = isGroup ? 300 : NODE_CARD_WIDTH;
    const height = isGroup ? 200 : 64;
    const center = screenToFlowPosition({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    const position = { x: center.x - width / 2, y: center.y - height / 2 };
    const top = screenToFlowPosition({ x: bounds.x, y: bounds.y + 32 }).y;
    const bottom = screenToFlowPosition({ x: bounds.right, y: bounds.bottom - 32 }).y;
    // Stagger repeated selections so a new component doesn't completely cover the last one.
    const existing = getNodes();
    for (let attempt = 0; attempt < 10 && existing.some(node => {
      const placed = node.positionAbsolute ?? node.position;
      return Math.abs(placed.x - position.x) < 24 && Math.abs(placed.y - position.y) < 24;
    }); attempt++) {
      position.y = position.y + height + 24 <= bottom - height ? position.y + height + 24 : top;
    }
    if (addComponent(label, position) && isCompact) {
      closePanel("components");
      // Reveal the selected node first; tapping it opens its properties.
      setSelectedNode(null);
    }
  };

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === "custom" || node.type === "group") {
      setSelectedNode(node as Node<AppNodeData>);
    } else {
      setSelectedNode(null);
    }
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null); setSelectedEdgeId(null);
  }, [setSelectedNode]);

  const handleNodeUpdate = useCallback((id: string, newData: AppNodeData) => {
    dispatchDiagram({ type: 'change', group: `edit:${id}`, update: graph => ({ ...graph, nodes: graph.nodes.map(node => node.id === id ? { ...node, data: { ...newData } } : node) }) });
  }, [dispatchDiagram]);

  const [startedAt] = useState(() => new Date().toISOString());
  const projectData: ProjectSaveData = {
    schemaVersion: currentScenario.profileId ? 4 : 2, version: projectVersion, timestamp: startedAt, projectId,
    scenario: publicScenario(currentScenario), memo, chatHistory: chatMessages, interviewEvidence,
    ...(currentScenario.profileId ? { requirementRevisions } : {}), evaluation: evaluationResult,
    diagram: { nodes: nodes.map(n => ({ id: n.id, type: n.type || 'custom', position: n.position, data: n.data,
      style: n.type === 'group' ? { ...n.style, width: n.width ?? n.style?.width, height: n.height ?? n.style?.height } : n.style,
      parentNode: n.parentNode, extent: n.extent === 'parent' ? 'parent' : undefined,
    })), edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, ...(e.data ? { data: e.data } : {}) })) },
  };
  const currentKey = evaluationKey(currentScenario, projectData.diagram, interviewEvidence);
  const evaluationState = !evaluatedKey ? 'unknown' : evaluatedKey === currentKey ? 'current' : 'stale';
  const draft = { project: projectData, evaluationKey: evaluatedKey };
  const autosave = useLocalDraft(draft);
  const returnHome = async () => {
    chatRequest.current?.abort('leave');
    evaluationRequest.current?.abort('leave');
    try { await saveDraft(draft); onBackToSelection(); }
    catch { setLeaveWithoutSaving(true); setNotice('このブラウザに保存できませんでした。部品名などの入力を確認し、プロジェクト保存でファイルを保存してください。'); }
  };
  const undo = () => { setSelectedEdgeId(null); editor.undo(); setSelectedNode(null); };
  const redo = () => { setSelectedEdgeId(null); editor.redo(); setSelectedNode(null); };
  const onWorkspaceKeyDown = (event: React.KeyboardEvent) => {
    if (activeTab !== 'design' || isHelpOpen || (isCompact && (memoVisible || componentsVisible))) return;
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable=true]')) return;
    const edgeElement = (event.target as HTMLElement).closest('.react-flow__edge');
    if (edgeElement && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); setSelectedNode(null); setSelectedEdgeId(edgeElement.querySelector('.react-flow__edge-path')?.id ?? null);
      requestAnimationFrame(() => document.getElementById('edge-payload')?.focus()); return;
    }
    const nodeElement = (event.target as HTMLElement).closest('.react-flow__node');
    if (nodeElement && (event.key === 'Enter' || event.key === ' ')) {
      const node = nodes.find(item => item.id === nodeElement.getAttribute('data-id'));
      if (node) {
        event.preventDefault();
        setSelectedNode(node);
        requestAnimationFrame(() => document.getElementById('node-label')?.focus());
      }
      return;
    }
    if (nodeElement && event.key === 'Escape') setSelectedNode(null);
    diagramHistoryShortcut(event, undo, redo);
  };

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
    const designData = evaluationInput(currentScenario, currentNodes.map(n => ({ ...n, type: n.type || 'custom' })), currentEdges, interviewEvidence);
    const requestKey = evaluationKey(currentScenario, { nodes: currentNodes.map(n => ({ ...n, type: n.type || 'custom' })), edges: currentEdges }, interviewEvidence);
    try {
      checkEvaluationSize(designData);
      const result = parseEvaluation(await postJson(`${API_BASE_URL}/api/evaluate`, designData, controller.signal));
      if (controller.signal.aborted) return;
      setEvaluationResult(result);
      setEvaluatedKey(requestKey);
      setActiveTab("evaluate");
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "評価中にエラーが発生しました。");
    } finally {
      evaluationRequest.current = null;
      if (!controller.signal.aborted || controller.signal.reason === 'leave') setIsLoading(false);
    }
  }, [getNodes, getEdges, currentScenario, interviewEvidence]);

  const onSaveProject = useCallback(async () => {
    setIsSaving(true);
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    try {
      const payload: ProjectSaveData = {
        schemaVersion: currentScenario.profileId ? 4 : 2,
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
            ...(e.data ? { data: e.data } : {}),
          })),
        },
        chatHistory: chatMessages,
        interviewEvidence,
        ...(currentScenario.profileId ? { requirementRevisions } : {}),
        evaluation: evaluationState === "current" ? evaluationResult : null,
      };
      const safeTitle = currentScenario.title.trim() || "untitled";
      const filename = `${safeTitle}_v${projectVersion}.json`;
      saveProjectToLocalFile(payload, filename);
      setNotice(`「${filename}」をローカルに保存しました。${evaluationResult && evaluationState !== "current" ? "対応が未確認・変更前の評価はファイルに含めていません。" : ""}`);
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
    interviewEvidence,
    requirementRevisions,
    memo,
    evaluationResult,
    evaluationState,
    projectVersion,
    projectId,
  ]);

  return (
    <div
      onKeyDown={onWorkspaceKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100dvh",
      }}
    >
      <Header
        title={currentScenario.title}
        onBack={returnHome}
        onSave={onSaveProject}
        isSaving={isSaving}
        onOpenHelp={() => setHelpTopic('index')}
      />

      <div className="draft-status" aria-live="polite" data-state={autosave.status}>
        {autosave.status === 'saved' ? 'このブラウザに自動保存済み' : autosave.status === 'saving' ? 'このブラウザに保存中…' : '自動保存できません。入力や空き容量を確認し、ファイルにも保存してください。'}
        {autosave.status === 'error' && <button className="ui-button" onClick={autosave.retry}>保存を再試行</button>}
      </div>
      {notice && <div role="status" style={{ padding: "8px 20px", background: "var(--app-warning-soft)", display: "flex", justifyContent: "space-between" }}><span>{notice}</span><button onClick={() => setNotice("")} aria-label="通知を閉じる">閉じる</button></div>}
      {leaveWithoutSaving && autosave.status !== 'saved' && <div className="draft-exit">
        <p>保存できなかった変更は失われます。必要な作業は先にJSONファイルへ保存してください。</p>
        <button className="ui-button" onClick={() => { chatRequest.current?.abort('leave'); evaluationRequest.current?.abort('leave'); onBackToSelection(); }}>ブラウザに保存せずホームへ戻る</button>
        <button className="ui-button" onClick={() => setLeaveWithoutSaving(false)}>編集を続ける</button>
      </div>}

      {helpTopic && <HelpModal isOpen initialTopic={helpTopic === 'learning' ? 'learning' : undefined} initialHintArea={activeTab === 'design' ? 'diagram' : activeTab === 'evaluate' ? 'reflection' : 'questions'} onClose={() => setHelpTopic(null)} />}
      <DesignReviewDialog isOpen={isReviewOpen} graph={{ nodes, edges }} memo={memo} onAppend={setMemo} onClose={() => setIsReviewOpen(false)} onInspect={inspectDesign} />
      <DesignNoteDialog isOpen={isNoteOpen} memo={memo} nodes={nodes} onClose={() => setIsNoteOpen(false)} onAppend={value => { setMemo(value); setNotice('要件メモに記録を追加しました。メモから編集できます。'); }} />

      <>
        <div className="workspace-navigation">
        <div className="workspace-tabs" style={tabBarStyle}>
          <button
            style={activeTab === "chat" ? activeTabStyle : tabStyle}
            onClick={() => selectTab("chat")}
            aria-pressed={activeTab === "chat"}
          >
            <BiChat style={{ marginRight: "6px", verticalAlign: "middle" }} />{" "}
            要件定義・交渉
          </button>
          <button
            style={activeTab === "design" ? activeTabStyle : tabStyle}
            onClick={() => selectTab("design")}
            aria-pressed={activeTab === "design"}
          >
            <BiNetworkChart
              style={{ marginRight: "6px", verticalAlign: "middle" }}
            />{" "}
            アーキテクチャ設計
          </button>
          <button
            style={activeTab === "evaluate" ? activeTabStyle : tabStyle}
            onClick={() => selectTab("evaluate")}
            aria-pressed={activeTab === "evaluate"}
          >
            <BiBarChart
              style={{ marginRight: "6px", verticalAlign: "middle" }}
            />{" "}
            評価結果
          </button>
        </div>
        </div>

        <div className="diagram-toolbar" role="group" aria-label="ワークスペースの操作">
        {activeTab === 'design' && <>
          <div className="diagram-history" role="group" aria-label="構成図の履歴">
            <button className="ui-button" onClick={undo} disabled={!history.past.length}>元に戻す</button>
            <button className="ui-button" onClick={redo} disabled={!history.future.length}>やり直す</button>
          </div>
        </>}
        <button className="panel-toggle learning-hint-trigger" onClick={() => setHelpTopic('learning')} aria-haspopup="dialog"><BiBulb size={18} aria-hidden="true" />設計のヒント</button>
        <button className="panel-toggle learning-hint-trigger" onClick={() => setIsReviewOpen(true)} aria-haspopup="dialog"><BiNetworkChart size={18} aria-hidden="true" />設計を確かめる</button>
        </div>
        <div className="workspace-content" style={{ display: "flex", flex: 1, overflow: "hidden",
          ...(panelWidths.components ? { "--app-sidebar-width": `min(${panelWidths.components}px, 35vw)` } : {}),
          ...(panelWidths.memo ? { "--app-memo-width": `min(${panelWidths.memo}px, 35vw)` } : {}),
        } as React.CSSProperties}>
          <div className="workspace-panel-actions" role="group" aria-label="サイドパネルの表示">
            {activeTab === "design" && (
              <button ref={componentsToggleRef} className="side-panel-handle side-panel-handle-left" onClick={() => togglePanel("components")} aria-expanded={componentsVisible} aria-controls="components-panel" aria-label="コンポーネントの表示切り替え" title={componentsVisible ? "コンポーネントを閉じる" : "コンポーネントを開く"}>
                {componentsVisible ? <BiChevronLeft aria-hidden="true" /> : <BiChevronRight aria-hidden="true" />}
              </button>
            )}
            <button ref={memoToggleRef} className="side-panel-handle side-panel-handle-right" onClick={() => togglePanel("memo")} aria-expanded={memoVisible} aria-controls="memo-panel" aria-label="要件メモの表示切り替え" title={memoVisible ? "要件メモを閉じる" : "要件メモを開く"}>
              {memoVisible ? <BiChevronRight aria-hidden="true" /> : <BiChevronLeft aria-hidden="true" />}
            </button>
          </div>
          {isCompact && (memoVisible || componentsVisible) && <button className="side-panel-backdrop" aria-label="サイドパネルを閉じる" onClick={() => closePanel(memoVisible ? "memo" : "components")} />}
          <div id="components-panel" className="workspace-side-panel side-panel-left" hidden={!componentsVisible} onKeyDown={event => onPanelKeyDown(event, "components")}>
            <Sidebar onAdd={onAddFromSidebar} />
            {!isCompact && <PanelResizeHandle side="left" label="コンポーネント" width={panelWidths.components ?? (window.innerWidth <= 1100 ? 208 : 232)} onResize={width => resizePanel("components", width)} />}
          </div>
          <div
            className="workspace-main"
            inert={isCompact && (memoVisible || componentsVisible)}
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
                evidence={interviewEvidence}
                onUpdateEvidence={setInterviewEvidence}
                requirementRevisions={requirementRevisions}
                onAcceptNegotiation={acceptNegotiation}
                request={chatRequest}
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
                  freshness={evaluationState}
                  nodes={nodes}
                  onInspect={id => inspectDesign(id)}
                  onReview={() => setIsReviewOpen(true)}
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
              <div
                className="reactflow-wrapper"
                ref={reactFlowWrapper}
                style={{ flex: 1, height: "100%", position: "relative" }}
              >
                <DiagramCanvas
                  nodes={nodes}
                  edges={edges}
                  miniMap={!isCompact}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onDrop={onDrop}
                  onNodeDragStop={(event, node, moved) => { onNodeDragStop(event, node, moved); editor.finish(); }}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  onEdgeClick={(_, edge) => { setSelectedNode(null); setSelectedEdgeId(edge.id); }}
                  deleteKeyCode={activeTab === "design" && !isHelpOpen && !(isCompact && (memoVisible || componentsVisible)) ? ["Backspace", "Delete"] : null}
                  fitView
                  fitViewOptions={{ maxZoom: 1 }}
                >
                  <Panel position="top-right">
                    <button
                      onClick={onEvaluate}
                      disabled={isLoading}
                      className="ui-button ui-button-success"
                      style={{
                        padding: "9px 14px",
                        fontSize: "13px",
                        backgroundColor: isLoading ? "var(--app-border)" : "var(--app-success-fill)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: isLoading ? "wait" : "pointer",
                      }}
                    >
                      {isLoading ? "AIが評価中..." : "設計完了（評価する）"}
                    </button>
                  </Panel>
                </DiagramCanvas>

                {selectedEdge && <ConnectionPanel key={selectedEdge.id} edge={selectedEdge} nodes={nodes} onClose={() => setSelectedEdgeId(null)} onEditEnd={() => dispatchDiagram({ type: 'finish' })} onDelete={() => { setEdges(current => current.filter(e => e.id !== selectedEdge.id)); setSelectedEdgeId(null); }} onChange={data => dispatchDiagram({ type: 'change', group: `edge:${selectedEdge.id}`, update: graph => ({ ...graph, edges: graph.edges.map(e => e.id === selectedEdge.id ? { ...e, data } : e) }) })} />}
                {selectedNode && (
                  <PropertiesPanel
                    key={selectedNode.id}
                    selectedNode={selectedNode}
                    onChange={handleNodeUpdate}
                    onClose={() => setSelectedNode(null)}
                    onEditEnd={() => dispatchDiagram({ type: 'finish' })}
                    nodes={nodes}
                    edges={edges}
                    onConnect={(source, target) => onConnect({ source, target, sourceHandle: null, targetHandle: null })}
                    onEditConnection={id => { setSelectedNode(null); setSelectedEdgeId(id); requestAnimationFrame(() => document.getElementById("edge-payload")?.focus()); }}
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
          <div id="memo-panel" className="workspace-side-panel side-panel-right" hidden={!memoVisible} onKeyDown={event => onPanelKeyDown(event, "memo")}>
            {!isCompact && <PanelResizeHandle side="right" label="要件メモ" width={panelWidths.memo ?? (window.innerWidth <= 1100 ? 210 : 240)} onResize={width => resizePanel("memo", width)} />}
            <MemoPad value={memo} onChange={setMemo} onAddRecord={() => setIsNoteOpen(true)} />
          </div>
        </div>
      </>
    </div>
  );
}

export function ArchitectureCanvas({
  selectedScenario,
  onBackToSelection,
  loadedProjectData,
  loadedEvaluationKey = null,
  initialTab = "chat",
}: ArchitectureCanvasProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow
        selectedScenario={selectedScenario}
        onBackToSelection={onBackToSelection}
        loadedProjectData={loadedProjectData}
        loadedEvaluationKey={loadedEvaluationKey}
        initialTab={initialTab}
      />
    </ReactFlowProvider>
  );
}

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  backgroundColor: "var(--app-subtle)",
  padding: "8px var(--tabs-inset, 16px)",
  gap: "4px",
  flex: 1,
  overflowX: "auto",
};
const tabStyle: React.CSSProperties = {
  padding: "var(--tab-padding, 13px 22px)",
  background: "var(--tab-hover, transparent)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  fontSize: "var(--tab-font, 14px)",
  color: "var(--app-muted)",
  border: "1px solid transparent",
  borderRadius: "9px",
};
const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: "var(--app-primary)",
  fontWeight: "bold",
  border: "1px solid var(--app-border)",
  background: "var(--app-surface)",
  boxShadow: "var(--app-shadow)",
};
