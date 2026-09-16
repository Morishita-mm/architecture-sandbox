import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { BiSearchAlt, BiRevision, BiBot, BiBulb, BiLink, BiCheckCircle, BiErrorCircle, BiHelpCircle, BiBarChartAlt2, BiChevronDown } from "react-icons/bi";
import { SiX } from "react-icons/si";
import { createChallengeUrl } from "../utils/projectFormat";
import { postJson } from "../utils/api";
import type { EvaluationResult, Scenario, AppNodeData } from "../types";

// 環境変数の読み込み
import { API_BASE_URL, APP_SHARE_URL as SHARE_BASE_URL } from "../config";

import { splitEvaluationFeedback, type FeedbackKind } from '../utils/evaluationFeedback';
import './EvaluationPanel.css';

const feedbackPresentation = {
  general: { title: 'AIからのフィードバック', caption: '設計全体へのコメント', icon: BiBot },
  strengths: { title: '良い点・確認できたこと', caption: 'AIが確認した設計の根拠', icon: BiCheckCircle },
  issues: { title: '改善が必要な点', caption: 'AIが指摘した不足や矛盾', icon: BiErrorCircle },
  unknowns: { title: 'まだ確認が必要なこと', caption: '情報が足りず、判断できていない点', icon: BiHelpCircle },
} satisfies Record<FeedbackKind, { title: string; caption: string; icon: typeof BiBot }>;
const scoreBands = [
  ['80–100', '根拠と検証方法まで説明できる'], ['60–79', '条件に対応する説明がある'],
  ['40–59', '重要な確認が残る'], ['20–39', '重大な矛盾がある'], ['0–19', '根拠がほぼない／成立しない'],
];

interface Props {
  result: EvaluationResult | null;
  onEvaluate: () => void;
  isLoading: boolean;
  scenario: Scenario;
  freshness: 'current' | 'stale' | 'unknown';
  nodes: { id: string; data: AppNodeData }[];
  onInspect: (id: string) => void;
  onReview: () => void;
}

export const EvaluationPanel: React.FC<Props> = ({
  result,
  onEvaluate,
  isLoading,
  scenario,
  freshness,
  nodes,
  onInspect,
  onReview,
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);
  const createLongUrl = () => createChallengeUrl(scenario, SHARE_BASE_URL);

  // バックエンド経由で短縮URLを取得してシェアする
  const handleShare = async () => {
    if (!result || freshness !== 'current') return;
    setIsSharing(true);

    try {
      const longUrl = createLongUrl();
      if (!longUrl) throw new Error("URL generation failed");

      const data = await postJson(`${API_BASE_URL}/api/shorten`, { target_url: longUrl });
      if (!data || typeof data !== "object" || !("short_url" in data) || typeof data.short_url !== "string") throw new Error("Invalid short URL");
      const shortUrl = new URL(data.short_url);
      if (shortUrl.protocol !== "https:" || shortUrl.hostname !== "tinyurl.com" || shortUrl.username || shortUrl.password || shortUrl.port) throw new Error("Invalid short URL");

      const score = result.totalScore;
      const text = `Architecture Sandboxで「${scenario.title}」を設計しました！\n総合スコア: ${score}点\n\n▼この要件で設計に挑戦する`;
      const hashtags = "ArchitectureSandbox,システム設計";

      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&hashtags=${hashtags}&url=${encodeURIComponent(shortUrl.toString())}`;
      window.open(tweetUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      setCopyFeedback("共有リンクを作成できませんでした");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    const url = createLongUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopyFeedback("コピーしました");
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setCopyFeedback(""), 2000);
      }).catch(() => setCopyFeedback("コピーできませんでした"));
    }
  };

  const evidenceLink = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    let id = '';
    try { if (href?.startsWith('#node=')) id = decodeURIComponent(href.slice(6)); } catch { /* untrusted model URL */ }
    if (!nodes.some(node => node.id === id)) return <span>{children}{href?.startsWith('#node=') && '（参照先未確認）'}</span>;
    return <button className="evidence-link" disabled={freshness !== 'current'} onClick={() => onInspect(id)} title={freshness === 'current' ? 'この部品の設定を開く' : '以前の評価の参照です。再評価してください。'}>{children}</button>;
  };

  const markdown = (body: string) => <div className="evaluation-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} components={{ a: evidenceLink, h1: 'h4', h2: 'h4', h3: 'h4' }}>{body}</ReactMarkdown></div>;
  if (!result) return <div className="evaluation-empty"><div className="evaluation-empty-card">
    <span className="evaluation-empty-icon"><BiSearchAlt aria-hidden="true" /></span>
    <h2>まだ評価結果がありません</h2>
    <p>部品の選び方とつなぎ方を評価します。任せたい役割を短く書くと、設計の意図も伝わります。詳しい設定は任意です。</p>
    <div className="evaluation-start-actions"><button className="ui-button" onClick={onReview}>図と設定から確かめる</button><button className="ui-button ui-button-primary" onClick={onEvaluate} disabled={isLoading}>{isLoading ? 'AIが診断中...' : '現在の設計を評価する'}</button></div>
  </div></div>;

  const chartData = [
    { subject: '可用性', meaning: '止まりにくさ', A: result.details.availability },
    { subject: '拡張性', meaning: '利用の増加への対応', A: result.details.scalability },
    { subject: '安全性', meaning: '情報や機能を守る', A: result.details.security },
    { subject: '保守性', meaning: '変更・運用のしやすさ', A: result.details.maintainability },
    { subject: 'コスト', meaning: '費用の効率', A: result.details.costEfficiency },
    { subject: '実現性', meaning: '構成を実装できるか', A: result.details.feasibility },
  ];
  const feedback = splitEvaluationFeedback(result.feedback);
  const recordedNodes = nodes.filter(n => n.data.design?.requirement || n.data.design?.evidence);
  return <div className="evaluation-panel"><div className="evaluation-shell">
    <header className="evaluation-header"><div><span className="evaluation-eyebrow">設計の振り返り</span><h2>アーキテクチャ評価レポート</h2></div>
      <div className="evaluation-actions">
        <button className="ui-button ui-button-primary" onClick={onEvaluate} disabled={isLoading}><BiRevision aria-hidden="true" />{isLoading ? '再評価中...' : '再評価する'}</button>
        <button className="ui-button" onClick={handleCopyLink} title="URLをコピー"><BiLink aria-hidden="true" />リンク</button>
        <button className="ui-button evaluation-share" onClick={handleShare} disabled={isSharing || freshness !== 'current'} title={freshness !== 'current' ? '現在の設計を再評価すると点数を共有できます' : undefined}><SiX aria-hidden="true" />{isSharing ? '生成中...' : '結果をシェア'}</button>
      </div>
    </header>
    {copyFeedback && <p className="evaluation-copy-feedback" role="status">{copyFeedback}</p>}
    <p className={`evaluation-freshness${freshness !== 'current' ? ' evaluation-outdated' : ''}`} role="status">{freshness === 'stale' ? '変更前の設計に対する評価です。現在の設計を再評価してください。' : freshness === 'unknown' ? '読み込んだ評価です。現在の設計との対応が未確認のため、再評価してください。' : '現在の設計に対する評価です。'}</p>

    <section className="evaluation-overview" aria-label="評価のスコア">
      <div className="evaluation-score"><h3>総合スコア</h3><div className="evaluation-score-value">{result.totalScore}<span>/ 100</span></div><p>根拠と未確認事項もあわせて振り返りましょう。</p><span className="evaluation-score-note">AIによる学習のための評価</span></div>
      <div className="evaluation-radar">
        <h3>構成のバランス</h3>
        <div className="evaluation-chart" role="img" aria-label="6つの観点のレーダーチャート。各点数は「観点ごとのスコア」に記載しています。">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
              <PolarGrid stroke="#d6e0ee" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#4b607d' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tickCount={6} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="A" stroke="var(--app-primary)" strokeWidth={2.5} fill="var(--app-primary)" fillOpacity={0.2} dot={{ r: 3, fill: 'var(--app-primary)' }} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="evaluation-dimensions"><h3><BiBarChartAlt2 aria-hidden="true" />観点ごとのスコア</h3><dl>{chartData.map(axis => <div className="evaluation-dimension" key={axis.subject}><dt>{axis.subject}<small>{axis.meaning}</small></dt><dd><strong>{axis.A}<span>/100</span></strong><div className="evaluation-score-track" aria-hidden="true"><span style={{ width: `${axis.A}%` }} /></div></dd></div>)}</dl></div>
    </section>

    {result.interview && result.interview.total > 0 && <section className="evaluation-interview" aria-labelledby="evaluation-interview-title">
      <header><div><span className="evaluation-eyebrow">要件定義・交渉</span><h3 id="evaluation-interview-title">聞き取り到達度</h3></div><strong>{result.interview.confirmed}<span> / {result.interview.total}項目</span></strong></header>
      <div className="evaluation-interview-track" aria-hidden="true"><span style={{ width: `${result.interview.confirmed / result.interview.total * 100}%` }} /></div>
      <div className="evaluation-interview-columns"><div><h4>会話で確認できた条件</h4>{result.interview.confirmedConditions.length ? <ul>{result.interview.confirmedConditions.map(item => <li key={item.id}>{item.label}</li>)}</ul> : <p>まだ記録されていません。</p>}</div><div><h4>まだ確認していない条件</h4>{result.interview.missingConditions.length ? <ul>{result.interview.missingConditions.map(item => <li key={item.id}>{item.label}</li>)}</ul> : <p>すべての条件を確認しました。</p>}</div></div>
      <p>質問に対するAIの回答で具体的に明らかになった条件を数えます。設計への対応状況は、下の評価で別に確認します。</p>
    </section>}

    <details className="evaluation-criteria"><summary><span className="evaluation-disclosure-icon"><BiHelpCircle aria-hidden="true" /></span><span>何を基準に評価する？<small>評価に使う情報と、点数の目安</small></span><BiChevronDown className="evaluation-chevron" aria-hidden="true" /></summary>
      <div className="evaluation-criteria-content"><div className="evaluation-criteria-grid"><section><h3>見ているのは、構成と設計の意図</h3><dl className="evaluation-criteria-facts"><div><dt>評価する情報</dt><dd>題材に設定された条件と、部品・接続・役割・短い設計理由を照合します。</dd></div><div><dt>詳しい設定は任意</dt><dd>製品名や実機テストの結果をすべて埋める必要はありません。記入した項目の数では加点しません。</dd></div><div><dt>聞き取りの記録</dt><dd>AIの回答で確認できた条件IDと、その根拠となる質問・回答を渡します。会話全体や要件メモは自動送信しません。</dd></div></dl></section>
        <section><h3>点数の目安</h3><p className="evaluation-criteria-lead">現在の採点では6軸を等しく扱い、総合点はその平均です。</p><dl className="evaluation-score-bands">{scoreBands.map(([range, meaning]) => <div key={range}><dt>{range}</dt><dd>{meaning}</dd></div>)}</dl></section></div>
        <p className="evaluation-criteria-note">未記録の内容は「未確認」として扱います。要件を満たす別の構成も認めます。価格・処理性能・可用性は実測していません。旧版の評価は採点基準が異なる場合があります。</p>
        <button className="ui-button" onClick={onReview}>図と設定から確かめる</button>
      </div>
    </details>

    <div className="evaluation-feedback-heading"><BiBot aria-hidden="true" /><h3>設計へのフィードバック</h3></div>
    <div className="evaluation-feedback-grid">{feedback.map(section => { const item = feedbackPresentation[section.kind], Icon = item.icon; return <section className={`evaluation-feedback-card is-${section.kind}`} key={section.kind} aria-labelledby={`evaluation-${section.kind}`}><header><span className="evaluation-feedback-icon"><Icon aria-hidden="true" /></span><div><h3 id={`evaluation-${section.kind}`}>{item.title}</h3><p>{item.caption}</p></div></header>{section.body ? markdown(section.body) : <p className="evaluation-section-empty">この区分の記載はありません。</p>}</section>; })}</div>
    <section className="evaluation-improvements" aria-labelledby="evaluation-improvements-title"><header><span className="evaluation-feedback-icon"><BiBulb aria-hidden="true" /></span><div><h3 id="evaluation-improvements-title">改善のための提案</h3><p>次に試すことを選び、設計に戻って確かめましょう。</p></div></header>{markdown(result.improvement)}</section>

    <div className="evaluation-supplementary">
      <details className="evaluation-evidence"><summary><BiLink aria-hidden="true" />現在の部品に記録した条件・根拠を見る<BiChevronDown className="evaluation-chevron" aria-hidden="true" /></summary><div className="evaluation-evidence-content"><p>利用者が記録した内容です。変更前の評価では、当時の根拠と一致しない場合があります。</p>{recordedNodes.length ? recordedNodes.map(n => <section key={n.id}><h4>{n.data.label}</h4><dl><div><dt>条件</dt><dd>{n.data.design?.requirement || '未記録'}</dd></div><div><dt>根拠</dt><dd>{n.data.design?.evidence || '未確認'}</dd></div></dl><button className="ui-button" onClick={() => onInspect(n.id)}>現在の部品を開く</button></section>) : <p>部品の設定の「この部品で満たす条件と根拠」から記録できます。</p>}</div></details></div>
  </div></div>;
};
