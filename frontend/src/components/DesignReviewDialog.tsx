import { useEffect, useRef, useState } from 'react';
import { BiCheckShield, BiGitCompare, BiPowerOff, BiX } from 'react-icons/bi';
import { compareDesigns, failureImpact, reviewDesign, type ReviewGraph } from '../utils/designReview';
import { appendDesignNote } from '../utils/designNote';

export function DesignReviewDialog({ isOpen, graph, memo, onAppend, onClose, onInspect }: {
  isOpen: boolean; graph: ReviewGraph; memo: string; onAppend: (memo: string) => void; onClose: () => void; onInspect: (nodeId?: string, edgeId?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [area, setArea] = useState<'checks' | 'failure' | 'compare'>('checks');
  const [source, setSource] = useState(''); const [stopped, setStopped] = useState('');
  const [baseline, setBaseline] = useState<ReviewGraph | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current!; dialog.showModal();
    return () => { dialog.close(); trigger?.focus({ preventScroll: true }); };
  }, [isOpen]);
  if (!isOpen) return null;
  const findings = reviewDesign(graph);
  const name = (id: string) => graph.nodes.find(n => n.id === id)?.data.label ?? id;
  const ready = graph.nodes.some(n => n.id === source && n.type !== 'group') && graph.nodes.some(n => n.id === stopped);
  const impact = ready ? failureImpact(graph, source, stopped) : null;
  const comparison = baseline ? compareDesigns(baseline, graph) : null;
  const append = (record: string) => {
    try { onAppend(appendDesignNote(memo, record)); setMessage('要件メモに記録しました。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '記録できませんでした。'); }
  };
  const counts = { fact: findings.filter(f => f.kind === 'fact'), unknown: findings.filter(f => f.kind === 'unknown'), question: findings.filter(f => f.kind === 'question') };
  const tab = (value: typeof area, text: string, icon: React.ReactNode) => <button className="ui-button" aria-pressed={area === value} onClick={() => { setArea(value); setMessage(''); }}>{icon}{text}</button>;
  return <dialog ref={ref} className="design-review-dialog" aria-labelledby="design-review-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyUp={e => e.stopPropagation()} onKeyDown={e => {
    e.stopPropagation();
    if (e.key !== 'Tab') return;
    const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, summary')).filter(el => el.getClientRects().length);
    if (e.shiftKey && e.target === controls[0]) { e.preventDefault(); controls.at(-1)?.focus(); }
    else if (!e.shiftKey && e.target === controls.at(-1)) { e.preventDefault(); controls[0]?.focus(); }
  }}><div className="design-review-layout">
    <header><div><p>図から、理由を考える</p><h2 id="design-review-title">設計を確かめる</h2></div><button className="ui-button ui-icon-button" onClick={onClose} aria-label="設計の確認を閉じる"><BiX size={22} /></button></header>
    <div className="review-area-picker" role="group" aria-label="確認の種類">{tab('checks', '記録の確認', <BiCheckShield aria-hidden />)}{tab('failure', '止まったら？', <BiPowerOff aria-hidden />)}{tab('compare', '変更を比べる', <BiGitCompare aria-hidden />)}</div>
    <div className="design-review-body">
      {area === 'checks' && <>
        <h3>確かなことと、まだ分からないこと</h3><p>入力された設定と接続を、このブラウザで確認します。文章の正しさや、実際のシステムの安全性は判定しません。</p>
        {!findings.length && <p className="review-message">この確認ルールで該当する項目はありません。要件を満たしたという保証ではありません。</p>}
        {(['fact', 'unknown', 'question'] as const).filter(kind => counts[kind].length > 0).map(kind => <section className={`review-findings review-${kind}`} key={kind}><h4>{kind === 'fact' ? '図・設定から確認したこと' : kind === 'unknown' ? '未確認・未記録' : '考えてみよう'} <span>{counts[kind].length}件</span></h4>
          {counts[kind].length ? counts[kind].map(f => <details key={f.id}><summary>{f.title}</summary><p>{f.detail}</p>{(f.nodeId || f.edgeId) && <button className="ui-button" onClick={() => { onClose(); onInspect(f.nodeId, f.edgeId); }}>該当箇所を開く</button>}</details>) : <p>この確認ルールで該当する項目はありません。要件を満たしたという保証ではありません。</p>}
        </section>)}
      </>}
      {area === 'failure' && <>
        <h3>一つが止まると、どこへの道が途切れる？</h3>
        <p>選んだ部品全体が止まると仮定して、矢印をたどります。台数は展開せず、応答時間・データ消失・実際の切り替えは計算しません。</p>
        <div className="design-field"><label htmlFor="failure-source">出発する部品</label><select id="failure-source" value={graph.nodes.some(n => n.id === source) ? source : ''} onChange={e => { setSource(e.target.value); setMessage(''); }}><option value="">選んでください</option>{graph.nodes.filter(n => n.type !== 'group').map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></div>
        <div className="design-field"><label htmlFor="failure-stopped">止まる部品・配置先</label><select id="failure-stopped" value={graph.nodes.some(n => n.id === stopped) ? stopped : ''} onChange={e => { setStopped(e.target.value); setMessage(''); }}><option value="">選んでください</option>{graph.nodes.filter(n => n.data.originalType !== 'Security Group').map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></div>
        <p className="property-guidance">AZ・Subnet・VPCでは設定欄で関連付けた部品も停止させます。見た目の囲みは使いません。配置が未記録なら影響は分かりません。</p>
        {impact && <section className="failure-result" aria-live="polite"><h4>図の接続から計算した結果</h4><p>停止前にたどれる部品: {impact.before.length}個 → 停止後: {impact.after.length}個（出発点を含む）</p>
          <p>停止対象: {impact.disabled.map(name).join('、')}</p>
          <p>たどれなくなる部品: {impact.lost.length ? impact.lost.map(name).join('、') : 'この図ではありません'}</p>
          <p>残った道で本当に処理できるでしょうか？ 切り替え・認証・通信ルール・容量の確認は別に必要です。</p>
          <button className="ui-button" onClick={() => append(`【障害時の検討・仮定】${name(stopped)}全体が停止\n出発点: ${name(source)}\n図の計算: 到達可能 ${impact.before.length}個 → ${impact.after.length}個（出発点を含む）\n途切れる先: ${impact.lost.map(name).join('、') || 'この図ではなし'}\n未確認: 実際の切替・通信制限・容量・応答時間・データ損失。配置は明示的な関連付けだけを使用。`)}>結果をメモに残す</button>
        </section>}
      </>}
      {area === 'compare' && <>
        <h3>変更前と今の違いを振り返る</h3><p>今の図を比較の基準にしてから、閉じて設計を変更します。基準はこの作業中だけ保持し、再読み込みでは消えます。必要な結果はメモに残してください。</p>
        {!baseline && <button className="ui-button ui-button-success" disabled={!graph.nodes.length} onClick={() => setBaseline(structuredClone(graph))}>今の設計を比較の基準にする</button>}
        {comparison && <section className="comparison-result"><h4>基準からの変更</h4><p>追加: {comparison.added.map(n => n.data.label).join('、') || 'なし'}</p><p>削除: {comparison.removed.map(n => n.data.label).join('、') || 'なし'}</p><p>設定の変更: {comparison.changed.map(n => n.data.label).join('、') || 'なし'}</p><p>接続の追加・更新: {comparison.connectionsAdded}本 / 削除・更新: {comparison.connectionsRemoved}本</p><p>座標移動は数えません。変更数や指摘の減少だけでは、良くなったとは判断できません。何の条件を満たすための変更か説明してみましょう。</p>
          <button className="ui-button" onClick={() => append(`【設計の比較】\n追加: ${comparison.added.map(n => n.data.label).join('、') || 'なし'}\n削除: ${comparison.removed.map(n => n.data.label).join('、') || 'なし'}\n設定変更: ${comparison.changed.map(n => n.data.label).join('、') || 'なし'}\n接続の追加・更新 ${comparison.connectionsAdded}本 / 削除・更新 ${comparison.connectionsRemoved}本\n次に確かめること: この変更で、どの条件を満たせると考えたか？`)}>変更をメモに残す</button>
          <details><summary>比較をやり直す</summary><p>前の基準を、現在の図に置き換えます。</p><button className="ui-button" onClick={() => { setBaseline(structuredClone(graph)); setMessage('比較の基準を更新しました。'); }}>現在の図を新しい基準にする</button></details>
        </section>}
      </>}
      {message && <p role="status" className="review-message">{message}</p>}
    </div>
    <footer><p>ここでの確認にはAIを使いません。</p><button className="ui-button" onClick={onClose}>閉じる</button></footer>
  </div></dialog>;
}
