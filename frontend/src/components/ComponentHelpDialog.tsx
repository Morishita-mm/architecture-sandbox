import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BiX, BiChevronLeft, BiChevronRight } from 'react-icons/bi';
import { NODE_CATEGORIES } from '../constants/nodeTypes';
import { componentCategoryNames, componentGuides } from '../constants/componentGuides';
import { ComponentConnectionExample } from './ComponentConnectionExample';

const components = NODE_CATEGORIES.flatMap(category => category.items);

interface Props {
  initialType: string;
  trigger: HTMLButtonElement;
  onClose: () => void;
}

export function ComponentHelpDialog({ initialType, trigger, onClose }: Props) {
  const [activeType, setActiveType] = useState(initialType);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const index = components.findIndex(item => item.type === activeType);
  const guide = componentGuides[activeType];

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      trigger.focus({ preventScroll: true });
    };
  }, [trigger]);

  useEffect(() => { articleRef.current?.scrollTo({ top: 0 }); }, [activeType]);

  return createPortal(
    <dialog
      id="component-help-dialog"
      ref={dialogRef}
      className="component-help-dialog"
      aria-labelledby="component-help-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      // Keep workspace shortcuts and the mobile sidebar's Escape handler out of the dialog.
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, [tabindex="0"]'));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
      }}
      onKeyUp={event => event.stopPropagation()}
    >
      <div className="component-help-layout">
        <header className="component-help-header">
          <div>
            <p className="component-help-eyebrow">コンポーネントガイド</p>
            <h2 id="component-help-title" aria-live="polite">{activeType}</h2>
            <p className="component-help-type">{guide.name}</p>
          </div>
          <button ref={closeRef} className="ui-button component-help-close" aria-label="部品の説明を閉じる" onClick={onClose}><BiX size={22} /></button>
        </header>
        <label className="component-help-picker" htmlFor="component-help-picker">
          別の部品の説明を見る
          <select id="component-help-picker" value={activeType} onChange={event => setActiveType(event.target.value)}>
            {NODE_CATEGORIES.map(category => <optgroup key={category.id} label={componentCategoryNames[category.id]}>
              {category.items.map(item => <option key={item.type} value={item.type}>{item.label} — {componentGuides[item.type].name}</option>)}
            </optgroup>)}
          </select>
        </label>
        <div className="component-help-article" ref={articleRef} tabIndex={0} role="region" aria-label="部品の説明">
          <p className="component-help-role">{guide.role}</p>
          <ComponentConnectionExample type={activeType} />
          <dl>
            <dt>使う場面</dt><dd>{guide.when}</dd>
            <dt>注意点</dt><dd>{guide.caution}</dd>
            <dt>考えてみよう</dt><dd>{guide.question}</dd>
          </dl>
        </div>
        <footer className="component-help-footer" aria-label="部品の説明の切り替え">
          <button className="ui-button" disabled={index === 0} onClick={() => setActiveType(components[index - 1].type)}><BiChevronLeft size={20} />前の部品</button>
          <span>{index + 1} / {components.length}</span>
          <button className="ui-button" disabled={index === components.length - 1} onClick={() => setActiveType(components[index + 1].type)}>次の部品<BiChevronRight size={20} /></button>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
