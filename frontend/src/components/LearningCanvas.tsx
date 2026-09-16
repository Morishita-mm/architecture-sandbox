import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type { ReactFlowInstance } from 'reactflow';
import { BiPlus, BiTrash, BiLink, BiSortDown, BiPlay, BiPause, BiSkipPrevious, BiSkipNext, BiReset } from 'react-icons/bi';
import { componentStages } from '../constants/componentStages';
import type { StageId } from '../constants/componentStages';
import { allowedParts, addPart, arrangeCourseDiagram, partName, partRole } from '../utils/courseDiagram';
import type { CourseDiagram, DiagramStage } from '../utils/courseDiagram';
import { courseEditorNode, toCourseEditor, fromCourseEditor } from '../utils/courseEditor';
import { useDiagramEditor, diagramHistoryShortcut, startComponentDrag, COMPONENT_DRAG_TYPE } from '../utils/useDiagramEditor';
import { connectDiagram, connectionTargets, insertDiagramNode } from '../utils/diagramEditing';
import type { ConnectionRules } from '../utils/diagramEditing';
import { DiagramCanvas } from './DiagramCanvas';
import type { NodePresentation } from './nodePresentation';
import type { PlaybackStep } from '../utils/coursePlayback';
import './LearningCanvas.css';

const emptyPlayback: PlaybackStep[] = [];
const connectionRules: ConnectionRules = { maxEdges: 24, allowSelf: false, edgeId: c => `${c.source}--${c.target}` };
export function LearningCanvas({ stage, practice, diagram, onChange, playback = emptyPlayback, traceStep = 0, onTraceStep, playing = false, reducedMotion = false, onPlay, runId = 0, experiment, nodePresentation, simulatedStop = false }: {
  stage: DiagramStage; practice: boolean; diagram: CourseDiagram; onChange: (next: CourseDiagram) => void;
  playback?: PlaybackStep[]; traceStep?: number; onTraceStep?: (step: number) => void; playing?: boolean; reducedMotion?: boolean; onPlay?: () => void; runId?: number; experiment?: ReactNode; simulatedStop?: boolean;
  nodePresentation?: Record<string, NodePresentation>;
}) {
  const activeStep = playback[traceStep];
  const editor = useDiagramEditor(toCourseEditor(diagram), connectionRules);
  const graph = editor.history.present;
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [source, setSource] = useState(''), [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const fit = () => requestAnimationFrame(() => requestAnimationFrame(() => flow?.fitView({ padding: .15, maxZoom: 1 })));
  // The common editor owns changes. Only the existing course format crosses the persistence boundary.
  // Stage changes and resets remount this editor; simulation updates only the checked signature.
  useEffect(() => {
    if (graph.nodes.some(n => n.dragging)) return;
    const next = fromCourseEditor(graph, diagram.checked);
    if (JSON.stringify(next) !== JSON.stringify(diagram)) onChange(next);
  }, [graph, diagram, onChange]);
  const chosen = graph.nodes.find(n => n.selected), chosenEdge = graph.edges.find(e => e.selected);
  const selected = chosen?.id ?? chosenEdge?.id ?? '';
  const select = (id: string) => editor.dispatch({ type: 'change', update: g => ({
    nodes: g.nodes.map(n => ({ ...n, selected: n.id === id })), edges: g.edges.map(e => ({ ...e, selected: e.id === id })),
  }) });
  function add(kind: StageId, at?: { x: number; y: number }) {
    const current = fromCourseEditor(graph, diagram.checked);
    const next = addPart(current, stage, kind, at, practice);
    if (next === current) { setMessage('この部品は配置済みです。アプリは負荷分散から2台まで、それ以外は1台ずつ使えます。'); return; }
    const part = next.nodes.at(-1)!;
    editor.dispatch({ type: 'change', update: g => insertDiagramNode({ ...g, nodes: g.nodes.map(n => {
      const placed = next.nodes.find(p => p.id === n.id)!;
      return { ...n, position: { x: placed.x, y: placed.y } };
    }) }, courseEditorNode(part)) });
    setMessage(`${partName(part)}を追加しました。経路をつないで試しましょう。`); fit();
  }
  function arrange() {
    const next = arrangeCourseDiagram(fromCourseEditor(graph, diagram.checked), stage);
    editor.setNodes(nodes => nodes.map((n, i) => ({ ...n, position: { x: next.nodes[i].x, y: next.nodes[i].y } })));
    setMessage('通信の道が見やすい間隔で並べました。元に戻すことで配置を取り消せます。'); fit();
  }
  function link(s = source, t = target) {
    const c = { source: s, target: t, sourceHandle: null, targetHandle: null };
    if (graph.nodes.find(n => n.id === s)?.data.courseKind === 'responder' || connectDiagram(graph, c, connectionRules) === graph) {
      setMessage('異なる2つの部品を選んでください。同じ接続は重ねて作れません。'); return;
    }
    editor.onConnect(c); setMessage('接続しました。この図で動きを試してください。');
  }
  function remove() {
    void flow?.deleteElements({ nodes: graph.nodes.filter(n => n.selected), edges: graph.edges.filter(e => e.selected) });
  }
  const targets = connectionTargets(graph, source);
  const intro = stage === 'browser' || stage === 'app';
  const height = Math.max(intro ? 480 : 460, Math.min(680, Math.max(0, ...graph.nodes.map(n => n.position.y)) - Math.min(0, ...graph.nodes.map(n => n.position.y)) + 180));
  const presentation: Record<string, NodePresentation> = Object.fromEntries(graph.nodes.map(n => [n.id, {
    ...nodePresentation?.[n.id],
    step: activeStep?.node === n.id ? traceStep + 1 : undefined,
    status: simulatedStop && n.id === 'app-1' ? 'この条件では停止を想定' : n.data.stopped ? '停止中' : undefined,
    fixed: n.data.courseKind === 'responder',
  }]));
  return <section className={`learning-canvas${stage === 'browser' || stage === 'app' ? ' is-intro' : ''}`} aria-label="部品を配置してつなぐ" onKeyDown={e => diagramHistoryShortcut(e, editor.undo, editor.redo)}>
    <div className="learning-palette"><div><strong>使える部品</strong><span>{allowedParts(stage).length}種類 · {practice ? 'ここまでに学んだ部品' : '今回の部品まで'}</span></div>
      <div className="learning-palette-items">{allowedParts(stage).map(kind => <button className="ui-button" key={kind} draggable onDragStart={e => startComponentDrag(e, componentStages[kind].component)} onClick={() => add(kind)} aria-label={`${componentStages[kind].component}を追加`} title={componentStages[kind].role}><BiPlus aria-hidden="true" />{componentStages[kind].component}</button>)}</div>
    </div>
    <div className="learning-canvas-toolbar"><span>上から下へ、丸をつないで経路を作る</span><div className="diagram-history" role="group" aria-label="構成図の操作">
      <button className="ui-button" disabled={graph.nodes.length < 2} onClick={arrange} title="間隔を広げ、部品の役割に合わせて縦に並べ直す"><BiSortDown aria-hidden="true" />縦に整列</button>
      <button className="ui-button" disabled={!editor.history.past.length} onClick={editor.undo}>元に戻す</button>
      <button className="ui-button" disabled={!editor.history.future.length} onClick={editor.redo}>やり直す</button>
      <button className="ui-button" disabled={(!chosen && !chosenEdge) || chosen?.data.courseKind === 'responder'} onClick={remove}><BiTrash aria-hidden="true" />選択を削除</button>
    </div></div>
    <div className={`learning-lab-layout${!experiment ? ' is-inline' : ''}`}><div className="learning-lab-diagram">
    <div className="learning-flow-legend" id={!experiment ? 'studio-experiment' : undefined} tabIndex={!experiment ? -1 : undefined}><span>{!experiment ? '2. 図のブラウザのボタンで試す' : '図で見るデータの流れ'}</span><span className="request-key">➜ 要求を送る</span><span className="response-key">➜ 返事が戻る</span></div>
    <div className="learning-flow" id="studio-flow" tabIndex={-1} ref={wrap} style={{ '--learning-flow-height': `${height}px` } as CSSProperties}>
      <DiagramCanvas nodes={graph.nodes} edges={graph.edges} onInit={setFlow} onNodesChange={editor.onNodesChange} onEdgesChange={editor.onEdgesChange}
        onNodeDragStop={editor.finish} onConnect={c => { if (c.source && c.target) link(c.source, c.target); }}
        onDrop={e => {
          e.preventDefault();
          const type = e.dataTransfer.getData(COMPONENT_DRAG_TYPE), kind = allowedParts(stage).find(k => componentStages[k].component === type);
          if (kind) add(kind, flow?.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}
        presentation={presentation} packet={activeStep?.wire ? { edgeId: activeStep.wire.id, reverse: activeStep.wire.reverse, response: activeStep.kind === 'response', key: `${runId}-${traceStep}`, playing } : undefined}
        nodeExtent={[[-5000, -5000], [5000, 5000]]} deleteKeyCode={['Backspace', 'Delete']}
        fitViewOptions={{ padding: .15, maxZoom: 1 }} minZoom={.25} maxZoom={1.6} zoomOnScroll={false} preventScrolling={false} />
    </div>
    <div className={`learning-playback ${activeStep?.kind ?? ''}`} aria-label="データの流れの再生">
      {activeStep ? <>
        <div className="learning-playback-caption" role="status" aria-live={playing ? 'off' : 'polite'} aria-atomic="true"><span className="learning-playback-phase">{traceStep + 1} / {playback.length} · {activeStep.kind === 'request' ? '要求（送信）' : activeStep.kind === 'response' ? '返事（応答）' : activeStep.kind === 'process' ? '部品の役割' : '立ち止まって確認'}</span><strong>{activeStep.title}</strong><p>{activeStep.detail}</p></div>
        <div className="learning-playback-actions"><button className="ui-button" onClick={onPlay}>{playing ? <BiPause aria-hidden="true" /> : traceStep === playback.length - 1 ? <BiReset aria-hidden="true" /> : <BiPlay aria-hidden="true" />}{playing ? '一時停止' : traceStep === playback.length - 1 ? 'もう一度見る' : reducedMotion ? '一段進める' : '流れを再生'}</button><button className="ui-button" disabled={traceStep === 0} onClick={() => onTraceStep?.(traceStep - 1)} aria-label="ひとつ前の動き"><BiSkipPrevious aria-hidden="true" /></button><button className="ui-button" disabled={traceStep === playback.length - 1} onClick={() => onTraceStep?.(traceStep + 1)} aria-label="次の動き"><BiSkipNext aria-hidden="true" /></button><span>{playing ? '1件の流れを再生中' : '一段ずつ見直せます'}</span></div>
      </> : <p>操作すると、要求が進む道と返事が戻る道をここで追えます。</p>}
    </div>
    </div>{experiment}</div>
    {chosen && <div className="learning-node-inspector"><strong>{chosen.data.label}</strong><span>{partRole(chosen.data.courseKind)}</span>
      {((stage === 'balancer' && chosen.data.courseKind === 'app') || chosen.data.courseKind === 'worker') && <label><input type="checkbox" checked={chosen.data.stopped} onChange={e => editor.setNodes(nodes => nodes.map(n => n.id === chosen.id ? { ...n, data: { ...n.data, stopped: e.target.checked } } : n))} />この部品を停止する</label>}
    </div>}
    <details className="learning-accessible-controls"><summary><BiLink aria-hidden="true" />ドラッグ以外の操作</summary><div className="learning-connect-form">
      <label>接続元<select value={graph.nodes.some(n => n.id === source) ? source : ''} onChange={e => { setSource(e.target.value); setTarget(''); }}><option value="">部品を選ぶ</option>{graph.nodes.filter(n => n.data.courseKind !== 'responder').map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></label>
      <label>接続先<select value={targets.some(n => n.id === target) ? target : ''} onChange={e => setTarget(e.target.value)}><option value="">部品を選ぶ</option>{targets.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></label>
      <button className="ui-button" disabled={!source || !targets.some(n => n.id === target)} onClick={() => link()}>接続する</button>
    </div>
      <label>部品・接続を選ぶ<select value={selected} onChange={e => select(e.target.value)}><option value="">選択なし</option>{graph.nodes.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}{graph.edges.map(e => <option key={e.id} value={e.id}>{graph.nodes.find(n => n.id === e.source)!.data.label} → {graph.nodes.find(n => n.id === e.target)!.data.label}</option>)}</select></label>
      {chosen && chosen.draggable !== false && <div className="learning-move-buttons">{[['左へ', -40, 0], ['右へ', 40, 0], ['上へ', 0, -40], ['下へ', 0, 40]].map(([label, x, y]) => <button className="ui-button" key={label} onClick={() => editor.setNodes(nodes => nodes.map(n => n.id === chosen.id ? { ...n, position: { x: Math.max(-5000, Math.min(5000, n.position.x + Number(x))), y: Math.max(-5000, Math.min(5000, n.position.y + Number(y))) } } : n))}>{label}</button>)}</div>}
      <p>部品はボタンでも追加できます。図から外しても教材の保存内容は保持し、「最初に戻す」で図と実験をリセットします。</p>
    </details>
    <p className="learning-canvas-message" role="status">{message}</p>
  </section>;
}
