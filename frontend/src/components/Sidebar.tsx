import { startComponentDrag } from '../utils/useDiagramEditor';
import { useState } from 'react';
import { NODE_CATEGORIES } from '../constants/nodeTypes';
import { basicComponents, componentCategoryNames, componentGuides } from '../constants/componentGuides';
import { ComponentHelpDialog } from './ComponentHelpDialog';

export const Sidebar = ({ onAdd }: { onAdd: (type: string) => void }) => {
  const [openCategories, setOpenCategories] = useState(['client', 'traffic', 'compute', 'database', 'integration']);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(true);
  const [help, setHelp] = useState<{ type: string; trigger: HTMLButtonElement } | null>(null);
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const categories = NODE_CATEGORIES.map(category => ({ ...category, items: category.items.filter(item => {
    const guide = componentGuides[item.type];
    const searchable = [item.label, ...Object.values(guide)].join(' ').toLocaleLowerCase();
    return words.length ? words.every(word => searchable.includes(word)) : showAll || basicComponents.has(item.type);
  }) })).filter(category => category.items.length);

  return <aside className="component-sidebar" aria-label="コンポーネント" tabIndex={-1}>
    <h2 className="side-panel-heading">コンポーネント</h2>
    <p className="component-sidebar-hint">選択して追加<span className="component-drag-hint">・ドラッグで配置</span></p>
    <label className="component-search">名前・やりたいこと
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="部品を検索" placeholder="画像、保存、通知…" />
    </label>
    <button className="component-library-toggle" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? '基本の8種類に戻す' : '全32種類を見る'}</button>
    <div className="component-list">
      {!categories.length && <p>該当する部品がありません。別の目的や名前で検索してください。</p>}
      {categories.map(category => {
        const open = words.length > 0 || openCategories.includes(category.id);
        return <section key={category.id} className="component-category">
          <button className="component-category-heading" aria-label={`${componentCategoryNames[category.id]} (${category.label})`} aria-expanded={open} style={{ borderLeftColor: category.color }} onClick={() => setOpenCategories(previous => previous.includes(category.id) ? previous.filter(id => id !== category.id) : [...previous, category.id])}>
            {componentCategoryNames[category.id]} <span aria-hidden="true">{open ? '▼' : '▶'}</span>
          </button>
          {open && category.items.map(item => {
            const guide = componentGuides[item.type];
            return <div key={item.type} className="component-item">
                <button className="dndnode" type="button" aria-label={item.label} onClick={() => onAdd(item.type)} draggable onDragStart={event => startComponentDrag(event, item.type)}><span>{item.label}</span><small>{guide.name}</small></button>
                {/* Separate native buttons share one card; pressing help must not add or drag a node. */}
                <button className="component-info" aria-label={`${item.label}の説明`} aria-haspopup="dialog" aria-expanded={help?.type === item.type} aria-controls="component-help-dialog" onClick={event => setHelp({ type: item.type, trigger: event.currentTarget })}>?</button>
            </div>;
          })}
        </section>;
      })}
    </div>
    {help && <ComponentHelpDialog initialType={help.type} trigger={help.trigger} onClose={() => setHelp(null)} />}
  </aside>;
};
