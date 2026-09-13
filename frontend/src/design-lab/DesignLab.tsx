import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls, Handle, Position, addEdge, useEdgesState, useNodesState, type Node, type NodeProps } from 'reactflow';
import { LuArrowDown, LuArrowRight, LuArrowUp, LuArrowUpRight, LuBookOpen, LuBox, LuCheck, LuCheckCheck, LuChevronDown, LuChevronRight, LuCircleHelp, LuDatabase, LuFileText, LuFlag, LuFolderOpen, LuGauge, LuGitBranch, LuLayers, LuLayoutGrid, LuMessageSquare, LuMousePointer2, LuNetwork, LuPanelRightClose, LuPlus, LuSearch, LuServer, LuShieldCheck, LuSparkles, LuTrash2, LuX } from 'react-icons/lu';
import 'reactflow/dist/style.css';

type Concept = 'precision' | 'midnight' | 'atelier';
type View = 'overview' | 'chat' | 'design' | 'evaluation';
type Glyph = ComponentType<{ size?: number; className?: string }>;
const directions: { id: Concept; letter: string; name: string; subtitle: string; description: string; benefit: string; tradeoff: string; source: string; url: string }[] = [
  { id: 'precision', letter: 'A', name: 'Precision', subtitle: '静かに、設計に集中する。', description: '白とグレー、細い罫線、要所のブルー。操作の優先順位が自然に伝わる、端正なワークスペース。', benefit: '図・会話・評価を同じ明るさで読みやすく統一できる。', tradeoff: '控えめな分、ブランドらしさは図形や言葉でつくる。', source: 'Dub', url: 'https://styles.refero.design/style/b0d80806-b724-4ed1-a1d1-074edd3c9bc9' },
  { id: 'midnight', letter: 'B', name: 'Midnight', subtitle: '思考を深める、設計のコックピット。', description: '墨色のレイヤーとライムのアクセント。小さな操作レールと広い作業面で、ツールとしての精密さを表現。', benefit: 'キャンバスが主役になり、開発ツールとしての個性が強い。', tradeoff: '長い日本語の会話や補助情報のコントラストに配慮が必要。', source: 'Linear', url: 'https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1' },
  { id: 'atelier', letter: 'C', name: 'Atelier', subtitle: '設計を、考える楽しさから。', description: '温かい紙の色、セリフの見出し、ピーチの余韻。教材とノートの間にある、親しみやすい学習スタジオ。', benefit: '初めての人が入りやすく、学びの振り返りと相性がよい。', tradeoff: '余白を広く取るため、複雑な図では情報密度の調整が必要。', source: 'Steep', url: 'https://styles.refero.design/style/75fdb89f-ca64-41b3-af36-7a78bd09448e' },
];
const views: { id: View; label: string; english: string; icon: Glyph }[] = [
  { id: 'overview', label: 'シナリオ', english: 'Scenarios', icon: LuLayoutGrid },
  { id: 'chat', label: 'ヒアリング', english: 'Discovery', icon: LuMessageSquare },
  { id: 'design', label: 'アーキテクチャ', english: 'Architecture', icon: LuNetwork },
  { id: 'evaluation', label: '評価レポート', english: 'Review', icon: LuGauge },
];
const scenarios = [
  { title: '社内勤怠管理システム', label: 'Internal tool', detail: '毎日の「はたらく」を、スムーズに。\n小さく始める業務システムを考えよう。', level: 'はじめての設計', icon: LuFolderOpen, tone: 'blue' },
  { title: '画像投稿SNS', label: 'Social platform', detail: '好きな瞬間を、たくさんの人へ。\n成長するサービスの構成を考えよう。', level: 'スケーラビリティ', icon: LuLayers, tone: 'violet' },
  { title: 'フリーテーマ', label: 'Your next idea', detail: 'そのアイデアを、設計図に。\n自由なテーマで設計に挑戦しよう。', level: 'カスタムシナリオ', icon: LuSparkles, tone: 'peach' },
];
const initialMessages = [
  { role: 'assistant', text: '写真でつながるSNSをつくりたいと考えています。\nまずは小さく始めたいのですが、利用者が増えても安心して使える仕組みにしたいです。' },
  { role: 'user', text: '最初の利用者数と、想定している予算を教えてください。' },
  { role: 'assistant', text: 'まずは月間1,000人ほどを想定しています。インフラの予算は月1万円程度です。\n写真の表示が速いことと、大切な写真をなくさないことを重視したいですね。' },
];
const starterNodes: Node<DiagramData>[] = [
  { id: 'browser', type: 'study', position: { x: 70, y: 30 }, data: { label: 'Web Browser', detail: '利用者のブラウザ', kind: 'client' } },
  { id: 'cdn', type: 'study', position: { x: 340, y: 30 }, data: { label: 'CDN', detail: '画像配信を高速化', kind: 'edge' } },
  { id: 'app', type: 'study', selected: true, position: { x: 70, y: 160 }, data: { label: 'App Server', detail: '投稿・認証 API', kind: 'compute' } },
  { id: 'storage', type: 'study', position: { x: 340, y: 160 }, data: { label: 'Object Storage', detail: '写真の永続保存', kind: 'storage' } },
  { id: 'database', type: 'study', position: { x: 70, y: 290 }, data: { label: 'PostgreSQL', detail: 'ユーザーと投稿データ', kind: 'database' } },
];
type DiagramData = { label: string; detail: string; kind: string };
const initialEdges = [
  { id: 'browser-app', source: 'browser', target: 'app', label: 'HTTPS' },
  { id: 'app-db', source: 'app', target: 'database', label: 'SQL' },
  { id: 'cdn-storage', source: 'cdn', target: 'storage', label: '画像を取得' },
];
const componentList = [
  { label: 'Web Server', kind: 'compute', icon: LuServer },
  { label: 'App Server', kind: 'compute', icon: LuBox },
  { label: 'Database', kind: 'database', icon: LuDatabase },
  { label: 'Load Balancer', kind: 'edge', icon: LuGitBranch },
];

function DiagramNode({ data, selected }: NodeProps<DiagramData>) {
  const Icon = data.kind === 'database' ? LuDatabase : data.kind === 'storage' ? LuLayers : data.kind === 'client' ? LuLayoutGrid : data.kind === 'edge' ? LuGitBranch : LuServer;
  return <div className={`study-node ${selected ? 'is-selected' : ''}`}>
    <Handle type="target" position={Position.Top} />
    <div className={`node-glyph ${data.kind}`}><Icon size={20} /></div>
    <div><strong>{data.label}</strong><span>{data.detail}</span></div>
    <Handle type="source" position={Position.Bottom} />
  </div>;
}
const nodeTypes = { study: DiagramNode };

function MiniArchitecture() {
  return <div className="mini-architecture" aria-hidden="true">
    <div className="mini-grid" />
    <span className="mini-code">YOUR NEXT ARCHITECTURE</span>
    <div className="mini-zone"><span><LuShieldCheck /> Private network</span></div>
    <svg className="mini-lines" viewBox="0 0 500 320"><path d="M95 108H239V155M239 191V239H352V269" /><path d="M239 173H360V93" /></svg>
    <div className="mini-node mini-client"><LuLayoutGrid /><span>Client</span><i /></div>
    <div className="mini-node mini-server"><LuServer /><span>Application</span><i /></div>
    <div className="mini-node mini-db"><LuDatabase /><span>Database</span><i /></div>
    <div className="mini-node mini-cloud"><LuLayers /><span>Storage</span><i /></div>
    <span className="mini-note"><LuMousePointer2 size={13} /> Your idea starts here</span>
  </div>;
}

function ReferenceDialog({ dialogRef }: { dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  return <dialog ref={dialogRef} className="direction-dialog" onKeyDown={event => event.stopPropagation()} onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
    <header><span className="eyebrow">DESIGN DIRECTION</span><button className="icon-button" aria-label="方針を閉じる" onClick={() => dialogRef.current?.close()}><LuX /></button></header>
    <h2>見た目を整える。<br />思考の流れをつなぐ。</h2>
    <p>推奨は <strong>A / Precision</strong>。ヒアリング、構成図、評価を同じルールで整理でき、このアプリの「考える時間」を支える方向性です。</p>
    <div className="direction-principles"><span>01 <strong>一画面、一つの主役</strong>操作・内容・補助情報に明確な優先順位を。</span><span>02 <strong>色には役割を持たせる</strong>選択、操作、状態の意味を全画面で統一。</span><span>03 <strong>図と文章に場所を譲る</strong>影と装飾を抑え、余白と文字で構造をつくる。</span></div>
    {directions.map(direction => <article key={direction.id}><h3>{direction.letter} / {direction.name}</h3><p>{direction.description}</p><dl><dt>向いていること</dt><dd>{direction.benefit}</dd><dt>注意したいこと</dt><dd>{direction.tradeoff}</dd></dl><a href={direction.url} target="_blank" rel="noreferrer">Refero：{direction.source} <LuArrowUpRight /></a></article>)}
    <footer>参考サイトの色・文字・余白の考え方をアプリ向けに再構成しています。AI応答・要件・スコアは比較用のサンプルです。</footer>
  </dialog>;
}

export function DesignLab() {
  const query = new URLSearchParams(window.location.search);
  const [concept, setConcept] = useState<Concept>(() => directions.find(d => d.id === query.get('concept'))?.id ?? 'precision');
  const [view, setView] = useState<View>(() => views.find(v => v.id === query.get('view'))?.id ?? 'overview');
  const [scenario, setScenario] = useState('画像投稿SNS');
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [memo, setMemo] = useState('画像はオブジェクトストレージへ。\n成長に合わせて、アプリサーバーを水平スケールする。');
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramData>(starterNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>('app');
  const [filter, setFilter] = useState('');
  const [showInspector, setShowInspector] = useState(true);
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const direction = directions.find(d => d.id === concept)!;
  const selected = nodes.find(n => n.id === selectedId);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('concept', concept);
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url);
  }, [concept, view]);
  useEffect(() => { messageEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
  }, [input, view]);

  const go = (next: View) => { setView(next); setNotice(''); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const send = () => {
    if (!input.trim()) return;
    setMessages(previous => [...previous, { role: 'user', text: input }, { role: 'assistant', text: 'よい視点ですね。写真の保管と配信を分けると、利用者が増えたときにも対応しやすくなります。\nこの条件をもとに、構成図を考えてみましょう。' }]);
    setInput('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
  };
  const start = (title: string) => {
    setScenario(title);
    setMessages(title === '画像投稿SNS' ? initialMessages : [{ role: 'assistant', text: `「${title}」の設計を始めましょう。どんな利用者の、どんな課題を解決したいですか？` }]);
    go('chat');
  };
  const addComponent = (label: string, kind: string) => {
    const id = crypto.randomUUID();
    setNodes(previous => [...previous.map(n => ({ ...n, selected: false })), { id, type: 'study', position: { x: 340, y: 290 + (previous.length - 5) * 110 }, data: { label, kind, detail: 'クリックして詳細を編集' }, selected: true }]);
    setSelectedId(id); setShowInspector(true); setNotice(`${label} を追加しました。全体表示で確認できます。`);
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes(previous => previous.filter(n => n.id !== selectedId));
    setEdges(previous => previous.filter(e => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  return <div className={`design-lab concept-${concept}`}>
    <div className="comparison-bar">
      <a className="lab-wordmark" href="/design-lab.html"><span className="lab-mark">as.</span><span>DESIGN STUDIES<small>Architecture Sandbox</small></span></a>
      <nav className="concept-picker" aria-label="デザイン案の切り替え">{directions.map(d => <button key={d.id} aria-pressed={concept === d.id} onClick={() => setConcept(d.id)}><span>{d.letter}</span>{d.name}{d.id === 'precision' && <small>推奨</small>}</button>)}</nav>
      <div className="comparison-actions"><span>サンプルデータ</span><button onClick={() => dialogRef.current?.showModal()}><LuBookOpen /> 方針と参考</button><a href="/" target="_blank" rel="noreferrer" title="現在のアプリを別タブで開く">現行版 <LuArrowUpRight /></a></div>
    </div>
    <div className="product-shell">
      <aside className="product-sidebar">
        <button className="product-brand" onClick={() => go('overview')} aria-label="シナリオ一覧へ"><span className="brand-symbol"><LuNetwork size={22} /></span><span>Architecture<span>Sandbox</span></span></button>
        <div className="workspace-label"><span className="workspace-avatar">M</span><div>My workspace<small>Personal learning space</small></div><LuChevronDown size={14} /></div>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="プレビュー画面">{views.map(v => <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => go(v.id)} title={v.label}><v.icon size={19} /><span>{v.label}</span>{view === v.id && <i />}</button>)}</nav>
        <div className="sidebar-bottom"><div className="learning-note"><LuSparkles /><strong>小さな設計から、大きな学びへ。</strong><p>対話し、つくり、振り返る。<br />あなたのペースで進めましょう。</p></div><button className="sidebar-help" aria-label="このデザインについて" onClick={() => dialogRef.current?.showModal()}><LuCircleHelp size={18} /><span>このデザインについて</span><LuArrowUpRight size={14} /></button><span className="sidebar-version">ARCHITECTURE SANDBOX <b>β</b></span></div>
      </aside>
      <main className={`product-main screen-${view}`}>
        <header className="product-topbar"><div className="breadcrumbs"><span>Workspace</span><LuChevronRight size={13} /><strong>{view === 'overview' ? 'シナリオを選ぶ' : scenario}</strong></div><div className="topbar-right"><span className="demo-pill"><i /> DESIGN PREVIEW</span><span className="user-avatar">M</span></div></header>
        {view !== 'overview' && <div className="project-heading"><div><span className="eyebrow">{views.find(v => v.id === view)?.english}</span><h1>{view === 'chat' ? 'まずは、いい問いから。' : view === 'design' ? 'アイデアを、構成図に。' : '次の設計に、つながる発見。'}</h1></div><div className="workflow-steps">{views.slice(1).map((v, index) => <button key={v.id} className={view === v.id ? 'current' : ''} onClick={() => go(v.id)}><span>{index + 1}</span>{v.label === '評価レポート' ? '評価' : v.label}</button>)}</div></div>}
        {view === 'overview' && <div className="overview-content">
          <section className="overview-hero"><div className="hero-copy"><span className="eyebrow"><i /> A SPACE TO THINK & BUILD</span><h1>{concept === 'atelier' ? <>Good systems<br />start with <em>curiosity.</em></> : concept === 'midnight' ? <>Think deeper.<br /><em>Build better.</em></> : <>いい設計は、<br /><em>いい問いから。</em></>}</h1><p>AIとの対話で要件をひもとき、構成図を描く。<br />つくって、振り返る。システム設計を、あなたの力に。</p><button className="primary-button" onClick={() => document.getElementById('study-scenarios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>シナリオを選ぶ <LuArrowDown size={16} /></button><div className="hero-footnote"><span>01 対話する</span><i /><span>02 設計する</span><i /><span>03 振り返る</span></div></div><MiniArchitecture /></section>
          <section className="scenario-section" id="study-scenarios"><div className="section-heading"><div><span className="eyebrow">CHOOSE YOUR CHALLENGE</span><h2>今日は、何を設計しよう。</h2></div><span className="section-detail">3つの入り口。無限の考え方。</span></div><div className="scenario-grid">{scenarios.map((s, i) => <button className={`scenario-card tone-${s.tone}`} key={s.title} onClick={() => start(s.title)}><div className="scenario-card-top"><span className="scenario-icon"><s.icon size={25} /></span><span className="scenario-number">0{i + 1}</span></div><span className="scenario-english">{s.label}</span><h3>{s.title}</h3><p>{s.detail}</p><div className="scenario-card-footer"><span>{s.level}</span><LuArrowUpRight size={20} /></div></button>)}</div></section>
          <div className="overview-bottom"><LuFolderOpen size={20} /><div><strong>続きは、いつもの場所から。</strong><span>保存済みプロジェクトの読み込みは、現行版で利用できます。</span></div><a href="/" target="_blank" rel="noreferrer">現行版を開く <LuArrowUpRight size={15} /></a></div>
          <footer className="overview-footer"><span>Designed for your next “なるほど”.</span><span>Architecture Sandbox / {direction.name}</span></footer>
        </div>}

        {view === 'chat' && <div className="discovery-layout"><section className="conversation-panel"><header className="conversation-header"><div className="assistant-avatar"><LuSparkles /></div><div><strong>クライアントとの対話</strong><span>新しいサービスを考える、事業責任者</span></div><span className="sample-tag">デモ応答</span></header><div className="conversation-messages"><div className="date-divider">ヒアリングをはじめましょう</div>{messages.map((message, index) => <article className={`conversation-message from-${message.role}`} key={index}><span className="message-avatar">{message.role === 'user' ? 'M' : <LuSparkles size={16} />}</span><div><span className="message-author">{message.role === 'user' ? 'あなた' : 'AI クライアント'}</span><div className="message-body">{message.text}</div></div></article>)}<div ref={messageEnd} /></div><div className="composer-area"><div className="suggestion-chips">{['成長した後の利用者数は？', '障害時に優先したいことは？'].map(text => <button key={text} onClick={() => { setInput(text); inputRef.current?.focus(); }}><LuPlus size={13} />{text}</button>)}</div><div className="study-composer"><textarea ref={inputRef} rows={1} value={input} maxLength={4000} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} aria-label="クライアントへの質問" placeholder="気になったことから、聞いてみましょう…" /><button aria-label="質問を送信" disabled={!input.trim()} onClick={send}><LuArrowUp size={19} /></button></div><div className="composer-hint"><span>Shift + Enter で改行</span><span>プレビュー用の固定応答です</span></div></div></section><aside className="context-panel"><header><LuFileText size={18} /><h2>要件ノート</h2><span>サンプル</span></header><p className="context-intro">会話の中で見つけた条件を、<br />設計の手がかりに。</p><div className="requirement-list"><div><span>月間利用者数</span><strong>1,000 <small>人</small></strong><i><LuCheckCheck /> ヒアリング済み</i></div><div><span>インフラ予算</span><strong>¥10,000 <small>/ 月</small></strong><i><LuCheckCheck /> ヒアリング済み</i></div><div><span>大切にしたいこと</span><p>写真の表示速度<br />データを失わないこと</p></div></div><label className="note-label">自分のメモ<textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="気づいたことを書き留める…" /></label><button className="text-button" onClick={() => go('design')}>この要件で設計する <LuArrowRight /></button></aside></div>}

        {view === 'design' && <div className="architecture-workspace"><aside className="component-library"><h2>コンポーネント <span>{componentList.length}</span></h2><label className="component-search"><LuSearch size={15} /><input aria-label="コンポーネントを検索" value={filter} onChange={e => setFilter(e.target.value)} placeholder="検索…" /></label><span className="eyebrow">BUILDING BLOCKS</span>{componentList.filter(item => item.label.toLowerCase().includes(filter.toLowerCase())).map(item => <button key={item.label} onClick={() => addComponent(item.label, item.kind)}><item.icon size={19} /><span>{item.label}</span><LuPlus size={14} /></button>)}{!componentList.some(item => item.label.toLowerCase().includes(filter.toLowerCase())) && <p className="empty-message">該当する部品がありません。</p>}<div className="library-hint"><LuMousePointer2 /><p>クリックで追加。<br />ノードを動かし、上下の端子をつないでみましょう。</p></div></aside><section className="study-canvas" aria-label="構成図のプレビュー"><div className="canvas-toolbar"><span><LuNetwork size={15} />{scenario} <small>/ 構成図</small></span><div className="canvas-toolbar-actions"><button className="icon-button" aria-label="プロパティの表示切り替え" aria-pressed={showInspector} onClick={() => setShowInspector(!showInspector)}><LuPanelRightClose size={17} /></button><button className="primary-button canvas-evaluate" onClick={() => go('evaluation')}><LuSparkles size={13} />設計を評価する</button></div></div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connection => setEdges(previous => addEdge(connection, previous))} onNodeClick={(_, node) => { setSelectedId(node.id); setShowInspector(true); }} onPaneClick={() => setSelectedId(null)} fitView fitViewOptions={{ padding: 0.24 }} minZoom={0.35} deleteKeyCode={['Delete', 'Backspace']} defaultEdgeOptions={{ type: 'smoothstep', style: { strokeWidth: 1.5 }, labelBgPadding: [6, 4], labelBgBorderRadius: 4 }}><Background variant={BackgroundVariant.Dots} gap={22} size={1} /><Controls showInteractive={false} /></ReactFlow><div className="canvas-footer"><span><i />{nodes.length} コンポーネント <b>·</b> {edges.length} 接続</span><span>ドラッグして移動 / Delete で削除</span></div>{notice && <div className="canvas-notice" role="status">{notice}<button aria-label="通知を閉じる" onClick={() => setNotice('')}><LuX /></button></div>}</section>{showInspector && <aside className="inspector-panel"><div className="inspector-heading"><h2>プロパティ</h2><span>INSPECTOR</span></div>{selected ? <><span className={`inspector-glyph ${selected.data.kind}`}><LuBox size={27} /></span><span className="eyebrow">SELECTED COMPONENT</span><h3>{selected.data.label}</h3><label>表示名<input value={selected.data.label} maxLength={120} onChange={e => setNodes(previous => previous.map(n => n.id === selected.id ? { ...n, data: { ...n.data, label: e.target.value } } : n))} /></label><label>設計の意図<textarea value={selected.data.detail} onChange={e => setNodes(previous => previous.map(n => n.id === selected.id ? { ...n, data: { ...n.data, detail: e.target.value } } : n))} /></label><div className="inspector-tip"><LuCircleHelp size={16} /><p>「なぜ、この構成にしたか」を言葉にすると、設計への理解が深まります。</p></div><button className="delete-component" onClick={deleteSelected}><LuTrash2 size={15} />コンポーネントを削除</button></> : <div className="inspector-empty"><LuMousePointer2 size={26} /><p>コンポーネントを選ぶと、<br />詳細を編集できます。</p></div>}</aside>}</div>}

        {view === 'evaluation' && <div className="evaluation-content"><div className="evaluation-summary"><div><span className="eyebrow">ARCHITECTURE REVIEW <span className="sample-tag">サンプル</span></span><h2>小さく始めて、<br />成長に備える設計。</h2><p>ストレージとアプリケーションの役割が明確です。<br />次は、障害に備える仕組みを考えてみましょう。</p><div className="review-label"><LuCheck size={15} /> 基本の要件を満たしています</div></div><div className="score-block"><div className="score-orbit"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="70" /><circle cx="80" cy="80" r="70" strokeDasharray="361 440" /></svg><span><strong>82</strong><small>/ 100</small></span></div><span>総合スコア</span></div></div><div className="evaluation-details"><section className="score-details"><div className="section-heading"><h3>6つの視点で振り返る</h3><LuGauge size={19} /></div>{[['可用性', 70], ['拡張性', 85], ['安全性', 78], ['保守性', 90], ['コスト効率', 88], ['実現性', 81]].map(([label, score]) => <div className="score-row" key={label}><span>{label}</span><div><i style={{ width: `${score}%` }} /></div><strong>{score}</strong></div>)}<p>構成と設計意図をもとにした、サンプルの評価です。</p></section><section className="review-notes"><article><span className="review-icon"><LuCheck /></span><div><span className="eyebrow">WHAT WORKS WELL</span><h3>役割の分離が、成長への余白に。</h3><p>画像をオブジェクトストレージへ切り出したことで、アプリの負荷と保存容量を別々に管理できます。</p></div></article><article><span className="review-icon improve"><LuFlag /></span><div><span className="eyebrow">YOUR NEXT ITERATION</span><h3>「1台が止まったら？」を考える。</h3><p>アプリサーバーの冗長化と、データベースのバックアップ方針を構成図に加えてみましょう。</p><button className="text-button" onClick={() => go('design')}>構成図に戻って改善する <LuArrowRight size={16} /></button></div></article></section></div><div className="reflection-note"><LuBookOpen size={22} /><div><strong>正解を覚えるより、選んだ理由を話せるように。</strong><p>制約が変わると、よい設計も変わります。もう一度、違う視点で試してみましょう。</p></div><button className="secondary-button" onClick={() => go('chat')}>要件を見直す <LuArrowUpRight size={15} /></button></div></div>}
      </main>
    </div>
    <ReferenceDialog dialogRef={dialogRef} />
  </div>;
}
