import { ThemeToggle } from './ThemeToggle';
import React from "react";
import { BiHelpCircle, BiArrowBack, BiSave } from "react-icons/bi";

interface HeaderProps {
  title: string;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, onSave, isSaving, onOpenHelp }) => (
  <header className="app-header">
    <div className="app-header-brand">
      <button className="ui-button ui-icon-button" onClick={onBack} title="シナリオ選択画面に戻る" aria-label="シナリオ選択画面に戻る"><BiArrowBack size={20} /></button>
      <button className="app-home-button" onClick={onBack} aria-label="Architecture Sandbox ホームへ戻る" title="ホームへ戻る"><img src="/icons/01-open-a-small.svg" alt="" width={30} height={30} /></button>
    </div>
    <h1 title={title}>{title}</h1>
    <div className="app-header-actions">
      <ThemeToggle />
      <button className="ui-button" onClick={onOpenHelp} aria-label="操作ガイド"><BiHelpCircle size={18} /><span>操作ガイド</span></button>
      <button className="ui-button ui-button-success" onClick={onSave} disabled={isSaving} aria-label={isSaving ? '保存中...' : 'プロジェクト保存'}><BiSave size={18} /><span>{isSaving ? '保存中...' : 'プロジェクト保存'}</span></button>
    </div>
  </header>
);
