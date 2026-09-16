import React, { useState } from "react";
import { BiBookContent, BiChevronRight, BiMessageSquareDetail, BiRocket, BiServer, BiSlider, BiWallet } from "react-icons/bi";

import type { CustomScenarioMode, PartnerRole, Scenario, ScenarioDifficulty, ScenarioFamily } from "../types";

interface Props {
  initialScenario: Scenario;
  onConfirm: (updatedScenario: Scenario) => void;
  onCancel: () => void;
}

const families: { id: ScenarioFamily; title: string; description: string; examples: string }[] = [
  { id: 'business', title: '社内業務', description: '記録・申請・検索を扱う', examples: '勤怠、顧客管理、備品管理' },
  { id: 'content', title: 'コンテンツ', description: '情報を投稿・保存・配信する', examples: 'SNS、ブログ、画像・動画共有' },
  { id: 'realtime', title: 'リアルタイム', description: '情報をすばやく届ける', examples: 'チャット、通知、ライブ更新' },
  { id: 'transaction', title: '取引・予約', description: '重複や在庫の矛盾を防ぐ', examples: 'EC、予約、フリマ、決済' },
];

const difficulties: { id: ScenarioDifficulty; title: string; description: string }[] = [
  { id: 'small', title: '基本', description: '少ない条件から役割と接続を考える' },
  { id: 'medium', title: '標準', description: '集中アクセスや故障時の条件も扱う' },
  { id: 'large', title: '発展', description: '複数の優先条件とトレードオフを扱う' },
];

const partners: { id: PartnerRole; title: string; description: string; icon: React.ReactNode }[] = [
  { id: 'ceo', title: '非技術系CEO', description: '目的から話し、質問に応じて条件を説明', icon: <BiRocket aria-hidden="true" /> },
  { id: 'cto', title: '技術責任者（CTO）', description: '品質・運用・技術上のリスクを重視', icon: <BiServer aria-hidden="true" /> },
  { id: 'cfo', title: '財務担当（CFO）', description: '費用対効果と運用費を重視', icon: <BiWallet aria-hidden="true" /> },
];

export const ScenarioSetup: React.FC<Props> = ({ initialScenario, onConfirm, onCancel }) => {
  const [mode, setMode] = useState<CustomScenarioMode>(initialScenario.customMode ?? 'guided');
  const [title, setTitle] = useState(initialScenario.title === 'カスタム設計（フリーテーマ）' ? '' : initialScenario.title);
  const [description, setDescription] = useState(initialScenario.description === 'テーマを決め、条件をおまかせするか、自分で仕様を整理して設計します。' ? '' : initialScenario.description);
  const [family, setFamily] = useState<ScenarioFamily>(initialScenario.scenarioFamily ?? 'business');
  const [difficulty, setDifficulty] = useState<ScenarioDifficulty>(initialScenario.difficulty ?? 'medium');
  const [partnerRole, setPartnerRole] = useState<PartnerRole>(initialScenario.partnerRole ?? 'ceo');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const common = { id: 'custom', title: title.trim(), description: description.trim(), isCustom: true as const, partnerRole, customMode: mode };
    onConfirm(mode === 'guided' ? { ...common, difficulty, scenarioFamily: family } : common);
  };

  return <main className="scenario-setup-screen">
    <section className="scenario-setup-card" aria-labelledby="scenario-setup-title">
      <header className="scenario-setup-header">
        <BiSlider aria-hidden="true" />
        <div><p>カスタム設計</p><h1 id="scenario-setup-title">自分のテーマで設計する</h1></div>
      </header>

      <form onSubmit={handleSubmit}>
        <fieldset className="scenario-setup-section">
          <legend>1. 進め方を選ぶ</legend>
          <div className="scenario-mode-grid">
            <label className={mode === 'guided' ? 'scenario-choice is-selected' : 'scenario-choice'}>
              <input type="radio" name="custom-mode" value="guided" checked={mode === 'guided'} onChange={() => setMode('guided')} />
              <BiMessageSquareDetail aria-hidden="true" />
              <span><strong>条件をおまかせ</strong><small>テーマに合う、あらかじめ用意した条件を固定し、AIへの聞き取りから明らかにします。</small></span>
            </label>
            <label className={mode === 'self_defined' ? 'scenario-choice is-selected' : 'scenario-choice'}>
              <input type="radio" name="custom-mode" value="self_defined" checked={mode === 'self_defined'} onChange={() => setMode('self_defined')} />
              <BiBookContent aria-hidden="true" />
              <span><strong>自分で仕様を決める</strong><small>書いた条件を基準に設計します。未設定の観点は仕様の不足として確認します。</small></span>
            </label>
          </div>
          <p className="scenario-mode-note">{mode === 'guided'
            ? '開始時に条件セットを一度だけ固定し、途中保存・再開・評価でも同じ条件を使います。詳細条件は聞き取りの中で確認します。'
            : '隠れた正解は作りません。AIは未記載の条件を勝手に確定せず、追加で決めるべき観点を質問します。'}</p>
        </fieldset>

        <div className="scenario-setup-section scenario-fields">
          <h2>2. テーマを説明する</h2>
          <label htmlFor="scenario-title">テーマ名</label>
          <input id="scenario-title" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="例：フリマアプリ" required />
          <label htmlFor="scenario-description">{mode === 'guided' ? '利用者と、できるようにしたいこと' : '利用者・機能・わかっている条件'}</label>
          <textarea id="scenario-description" maxLength={2000} value={description} onChange={event => setDescription(event.target.value)}
            placeholder={mode === 'guided' ? '例：利用者同士が商品の写真を載せて売買できる。' : '例：利用者同士が商品を売買する。本人だけが出品を変更でき、同じ商品を二重に購入できないようにしたい。'} required />
          <p>{mode === 'guided' ? '数値や故障時の条件は、クライアント役への質問で確認します。' : 'まだ決まっていない条件は空いたままで構いません。設計前に確認すべき項目として整理します。'}</p>
        </div>

        {mode === 'guided' && <>
          <fieldset className="scenario-setup-section">
            <legend>3. 近いサービスの型を選ぶ</legend>
            <p>完全に一致しなくても、最も重要な利用場面が近いものを選びます。</p>
            <div className="scenario-family-grid">{families.map(item => <label key={item.id} className={family === item.id ? 'scenario-family is-selected' : 'scenario-family'}>
              <input type="radio" name="scenario-family" value={item.id} checked={family === item.id} onChange={() => setFamily(item.id)} />
              <strong>{item.title}</strong><span>{item.description}</span><small>{item.examples}</small>
            </label>)}</div>
          </fieldset>
          <fieldset className="scenario-setup-section">
            <legend>4. 課題の複雑さ</legend>
            <div className="scenario-level-grid">{difficulties.map(item => <label key={item.id} className={difficulty === item.id ? 'scenario-level is-selected' : 'scenario-level'}>
              <input type="radio" name="difficulty" value={item.id} checked={difficulty === item.id} onChange={() => setDifficulty(item.id)} />
              <strong>{item.title}</strong><small>{item.description}</small>
            </label>)}</div>
          </fieldset>
        </>}

        <fieldset className="scenario-setup-section">
          <legend>{mode === 'guided' ? '5' : '3'}. 相談相手</legend>
          <div className="scenario-partner-grid">{partners.map(item => <label key={item.id} className={partnerRole === item.id ? 'scenario-partner is-selected' : 'scenario-partner'}>
            <input type="radio" name="partner" value={item.id} checked={partnerRole === item.id} onChange={() => setPartnerRole(item.id)} />
            {item.icon}<span><strong>{item.title}</strong><small>{item.description}</small></span>
          </label>)}</div>
        </fieldset>

        <footer className="scenario-setup-actions">
          <button type="button" className="ui-button" onClick={onCancel}>戻る</button>
          <button type="submit" className="ui-button ui-button-success">{mode === 'guided' ? '条件を固定して聞き取りへ' : '仕様を整理しながら始める'}<BiChevronRight aria-hidden="true" /></button>
        </footer>
      </form>
    </section>
  </main>;
};
