import type { Edge, Node } from 'reactflow';
import type { AppNodeData, ConnectionDesign } from '../types';

export function ConnectionPanel({ edge, nodes, onChange, onClose, onDelete, onEditEnd }: {
  edge: Edge<ConnectionDesign>; nodes: Node<AppNodeData>[]; onChange: (data: ConnectionDesign) => void; onClose: () => void; onDelete: () => void; onEditEnd: () => void;
}) {
  const d = edge.data ?? {};
  const name = (id: string) => nodes.find(n => n.id === id)?.data.label ?? '部品';
  return <aside className="connection-panel" aria-label="接続の設定">
    <header><h2>接続の設定</h2><button className="ui-button" aria-label="接続の設定を閉じる" onClick={onClose}>閉じる</button></header>
    <p>{name(edge.source)} → {name(edge.target)}</p>
    <p className="property-guidance">矢印は要求やデータを渡す向きです。何を渡し、結果を待つかを考えましょう。</p>
    {([['payload', '渡すもの', '例: 注文内容、画像、メール送信の依頼'], ['protocol', '通信方式', '例: HTTPS、SQL。未定なら空欄'], ['retry', '失敗したとき', '例: 3回まで再試行。同じ注文を重複登録しない']] as const).map(([key, label, placeholder]) => <div className="design-field" key={key}><label htmlFor={`edge-${key}`}>{label}</label><textarea id={`edge-${key}`} maxLength={200} rows={2} placeholder={placeholder} value={d[key] ?? ''} onChange={e => onChange({ ...d, [key]: e.target.value })} onBlur={onEditEnd} /></div>)}
    <div className="design-field"><label htmlFor="edge-mode">結果を待つ？</label><select id="edge-mode" value={d.mode ?? ''} onChange={e => { onChange({ ...d, mode: e.target.value as ConnectionDesign['mode'] || undefined }); onEditEnd(); }}><option value="">未確認</option><option value="sync">同期: 結果を待って次に進む</option><option value="async">非同期: 依頼を渡し、後で処理する</option></select></div>
    <button className="ui-button" onClick={onDelete}>接続を削除</button>
  </aside>;
}
