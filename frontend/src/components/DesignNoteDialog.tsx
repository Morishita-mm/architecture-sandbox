import { useEffect, useRef, useState } from 'react';
import { BiX, BiNotepad, BiGitCompare } from 'react-icons/bi';
import type { AppNodeData } from '../types';
import { appendDesignNote, formatDesignNote, type DesignNoteDraft } from '../utils/designNote';

interface Props {
  isOpen: boolean;
  memo: string;
  nodes: { id: string; data: AppNodeData }[];
  onAppend: (memo: string) => void;
  onClose: () => void;
}
const emptyNote: DesignNoteDraft = { status: 'unconfirmed', condition: '', evidence: '', reason: '', before: '', after: '', next: '' };

export function DesignNoteDialog({ isOpen, memo, nodes, onAppend, onClose }: Props) {
  const [note, setNote] = useState(emptyNote);
  const [componentId, setComponentId] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const conditionRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const selected = nodes.find(node => node.id === componentId);
  const missingComponent = Boolean(componentId && !selected);
  const record = formatDesignNote(note, selected ? `${selected.data.label}（${selected.data.originalType}）` : '');
  const update = (field: keyof DesignNoteDraft, value: string) => setNote(current => ({ ...current, [field]: value }));
  const close = () => { setError(''); onClose(); };

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    conditionRef.current?.focus();
    return () => { dialog.close(); trigger?.focus({ preventScroll: true }); };
  }, [isOpen]);

  // Keep unfinished form input when closing or moving between workspace tabs.
  if (!isOpen) return null;

  const append = (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = !note.condition.trim() ? conditionRef.current : note.status === 'confirmed' && !note.evidence.trim() ? event.currentTarget.querySelector<HTMLTextAreaElement>('#design-note-evidence') : null;
    if (invalid) { invalid.setCustomValidity('空白だけでは追加できません。内容を入力してください。'); invalid.reportValidity(); return; }
    if (missingComponent) return;
    try {
      onAppend(appendDesignNote(memo, record));
      setNote(emptyNote); setComponentId(''); setError(''); onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : '記録を追加できませんでした。');
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  };

  const field = (key: 'evidence' | 'reason' | 'before' | 'after' | 'next', label: string, required = false) => <div className="design-note-field">
    <label htmlFor={`design-note-${key}`}>{label}{!required && <small>任意</small>}</label>
    <textarea id={`design-note-${key}`} aria-describedby={`design-note-${key}-count`} value={note[key]} maxLength={2000} rows={2} required={required} onChange={event => { event.target.setCustomValidity(''); update(key, event.target.value); }} />
    <small id={`design-note-${key}-count`} className="design-note-count">{note[key].length} / 2,000</small>
  </div>;

  return <dialog ref={dialogRef} className="design-note-dialog" aria-labelledby="design-note-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, select, input, summary')).filter(element => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
    }} onKeyUp={event => event.stopPropagation()}>
    <form onSubmit={append} className="design-note-layout">
      <header className="design-note-header">
        <h2 id="design-note-title"><BiNotepad size={22} aria-hidden="true" />要件と設計を記録</h2>
        <button type="button" className="ui-button ui-icon-button" onClick={close} aria-label="記録を閉じる"><BiX size={22} aria-hidden="true" /></button>
      </header>
      <div className="design-note-body">
        <p className="design-note-intro">一つの条件と、それに対する設計の考えを残します。</p>
        <div className="design-note-field">
          <label htmlFor="design-note-condition">条件・確かめたいこと</label>
          <textarea id="design-note-condition" ref={conditionRef} aria-describedby="design-note-condition-count" value={note.condition} maxLength={2000} rows={2} required onChange={event => { event.target.setCustomValidity(''); update('condition', event.target.value); }} placeholder="この仕組みで実現したいことは？" />
          <small id="design-note-condition-count" className="design-note-count">{note.condition.length} / 2,000</small>
        </div>
        <fieldset className="design-note-status">
          <legend>確認の状態</legend>
          <label><input type="radio" name="note-status" value="unconfirmed" checked={note.status === 'unconfirmed'} onChange={() => update('status', 'unconfirmed')} />未確認</label>
          <label><input type="radio" name="note-status" value="confirmed" checked={note.status === 'confirmed'} onChange={() => update('status', 'confirmed')} />確認済み</label>
        </fieldset>
        {note.status === 'confirmed' && field('evidence', '確認した根拠（会話・題材の説明など）', true)}
        <div className="design-note-field">
          <label htmlFor="design-note-component">関連する部品<small>任意</small></label>
          <select id="design-note-component" value={componentId} aria-invalid={missingComponent || undefined} aria-describedby={missingComponent ? 'design-note-missing' : undefined} onChange={event => setComponentId(event.target.value)}>
            <option value="">設計全体・まだ決めていない</option>
            {missingComponent && <option value={componentId}>削除された部品</option>}
            {nodes.map((node, index) => <option value={node.id} key={node.id}>{node.data.label} — {node.data.originalType}（{index + 1}）</option>)}
          </select>
          {missingComponent && <small id="design-note-missing" role="alert">この部品は削除されました。選び直してください。</small>}
        </div>
        {field('reason', '設計理由・対応方針')}
        <details className="design-note-changes">
          <summary><BiGitCompare size={18} aria-hidden="true" />変更前後・次に確かめること</summary>
          {field('before', '変更前の構成・困っていたこと')}
          {field('after', '変更後の構成・期待する違い')}
          {field('next', '次に確かめること')}
        </details>
        <details className="design-note-preview"><summary>追加する内容を見る</summary><pre>{record}</pre></details>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="design-note-error">{error}</p>}
      </div>
      <footer className="design-note-footer">
        <p>追加後は要件メモで編集できます。</p>
        <button type="button" className="ui-button" onClick={close}>閉じる</button>
        <button type="submit" className="ui-button ui-button-success" disabled={missingComponent}>メモに追加</button>
      </footer>
    </form>
  </dialog>;
}
