import type { Node } from 'reactflow';
import type { AppNodeData, NodeDesign } from '../types';
import { responsibilities, placementTypes } from '../utils/designModel';

interface Props { node: Node<AppNodeData>; nodes: Node<AppNodeData>[]; onChange: (design: NodeDesign) => void; onEditEnd: () => void }
export function NodeDesignFields({ node, nodes, onChange, onEditEnd }: Props) {
  const d = node.data.design ?? {};
  const type = node.data.originalType;
  const update = (key: keyof NodeDesign, value: NodeDesign[keyof NodeDesign]) => onChange({ ...d, [key]: value || undefined });
  const field = (key: 'implementation' | 'redundancy' | 'backup' | 'recovery' | 'requirement' | 'evidence' | 'rules', label: string, hint: string) => <div className="design-field" key={key}>
    <label htmlFor={`design-${key}`}>{label}</label>
    <p id={`hint-${key}`}>{hint}</p>
    <textarea id={`design-${key}`} aria-describedby={`hint-${key}`} rows={2} maxLength={300} value={d[key] ?? ''} onChange={e => update(key, e.target.value)} onBlur={onEditEnd} />
  </div>;
  const selectReference = (key: keyof typeof placementTypes, label: string) => {
    const choices = nodes.filter(n => n.id !== node.id && n.data.originalType === placementTypes[key]);
    return <div className="design-field" key={key}><label htmlFor={`design-${key}`}>{label}</label>
      <select id={`design-${key}`} value={d[key] ?? ''} onChange={e => { update(key, e.target.value); onEditEnd(); }}>
        <option value="">未確認・指定しない</option>
        {d[key] && !choices.some(n => n.id === d[key]) && <option value={d[key]}>参照先がありません（選び直してください）</option>}
        {choices.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}
      </select></div>;
  };
  return <details className="node-design-optional"><summary>詳しい設定（任意）</summary>
    <p className="property-guidance">もっと具体的に考えたいときに使います。空欄でも設計を評価できます。すべて埋める必要はありません。</p>
    <div className="node-design-fields">
    <details><summary>役割と実装方式</summary>
      <p className="property-guidance">部品名は役割の目安です。使う製品や、誰が管理するかは分けて考えます。</p>
      {field('implementation', '実装方式・製品', '自社のプログラムや利用するサービスの名前。未定なら空欄にできます。')}
      <div className="design-field"><label htmlFor="design-responsibility">担う仕事</label><select id="design-responsibility" value={d.responsibility ?? ''} onChange={e => { update('responsibility', e.target.value); onEditEnd(); }}>
        <option value="">部品の説明を使う</option>{Object.entries(responsibilities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></div>
      <div className="design-field"><label htmlFor="design-scope">管理するのは誰？</label><select id="design-scope" value={d.scope ?? ''} onChange={e => { update('scope', e.target.value); onEditEnd(); }}><option value="">未確認</option><option value="internal">自分たちで管理</option><option value="external">外部サービスに任せる</option></select></div>
    </details>
    <details><summary>この部品で満たす条件と根拠</summary>
      {field('requirement', '満たしたい条件', '例: 記録が消えても、前日の状態に戻したい。')}
      {field('evidence', '確認した根拠', '会話の日付や回答を記録します。AIが合意を保証するものではありません。')}
    </details>
    {node.type !== 'group' && <details><summary>台数・止まったときの備え</summary>
      <div className="design-field"><label htmlFor="design-replicas">台数・実行単位数</label><input id="design-replicas" type="number" min={1} max={1000} step={1} placeholder="未確認" value={d.replicas ?? ''} onChange={e => { const n = e.target.valueAsNumber; if (!e.target.value || (Number.isInteger(n) && n >= 1 && n <= 1000)) update('replicas', e.target.value ? n : undefined); }} onBlur={onEditEnd} /></div>
      {field('redundancy', '冗長化と切り替え', '台数を増やすだけでは継続できません。配置先と切り替える方法も考えます。')}
      {field('backup', 'バックアップと復元', 'いつコピーを取り、どこに保管し、どう戻せることを確認しますか？')}
      {field('recovery', 'どこまでの停止・損失を許容する？', '例: 1時間で復旧、失ってよい記録は直前5分まで。達成実績ではなく目標です。')}
    </details>}
    <details><summary>{type === 'Security Group' ? '通信ルール' : '配置と通信の制限'}</summary>
      <p className="property-guidance">AWSの配置を表す場合に使います。図の囲みは見た目の整理で、以下の関連付けとは別です。</p>
      {type === 'Subnet' && <>{selectReference('vpcId', '所属するVPC')}{selectReference('zoneId', '所属するAZ')}</>}
      {node.type !== 'group' && <>{selectReference('subnetId', '配置するSubnet')}{selectReference('zoneId', '配置するAZ（Subnet未指定時）')}</>}
      {type === 'Security Group' && <>{selectReference('vpcId', 'ルールを用意するVPC')}{field('rules', '許可する通信', '受信・送信、相手、プロトコル、ポートを記録します。ここでは実際の通信を制限しません。')}</>}
      {node.type !== 'group' && <fieldset className="design-field"><legend>関連付けるSecurity Group</legend><p>囲みの中に置くだけでは適用されません。対応するサービスかどうかも確認しましょう。</p>
        {nodes.filter(n => n.data.originalType === 'Security Group').map(n => <label className="design-checkbox" key={n.id}><input type="checkbox" checked={d.securityGroupIds?.includes(n.id) ?? false} disabled={!d.securityGroupIds?.includes(n.id) && (d.securityGroupIds?.length ?? 0) >= 20} onChange={e => { update('securityGroupIds', e.target.checked ? [...(d.securityGroupIds ?? []), n.id] : d.securityGroupIds?.filter(id => id !== n.id)); onEditEnd(); }} />{n.data.label}</label>)}
        {(d.securityGroupIds ?? []).filter(id => !nodes.some(n => n.id === id)).map(id => <button key={id} className="ui-button" onClick={() => { update('securityGroupIds', d.securityGroupIds?.filter(value => value !== id)); onEditEnd(); }}>なくなった関連付けを解除</button>)}
      </fieldset>}
    </details>
  </div></details>;
}
