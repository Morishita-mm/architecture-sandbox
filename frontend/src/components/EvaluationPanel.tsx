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
import { BiSearchAlt, BiRevision, BiBot, BiBulb, BiLink } from "react-icons/bi";
import { SiX } from "react-icons/si";
import { createChallengeUrl } from "../utils/projectFormat";
import { postJson } from "../utils/api";
import type { EvaluationResult, Scenario } from "../types";

// 環境変数の読み込み
import { API_BASE_URL, APP_SHARE_URL as SHARE_BASE_URL } from "../config";

const CHART_HEIGHT = 280;

interface Props {
  result: EvaluationResult | null;
  onEvaluate: () => void;
  isLoading: boolean;
  scenario: Scenario;
}

export const EvaluationPanel: React.FC<Props> = ({
  result,
  onEvaluate,
  isLoading,
  scenario,
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);
  const createLongUrl = () => createChallengeUrl(scenario, SHARE_BASE_URL);

  // バックエンド経由で短縮URLを取得してシェアする
  const handleShare = async () => {
    if (!result) return;
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
        setCopyFeedback("Copied!");
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setCopyFeedback(""), 2000);
      }).catch(() => setCopyFeedback("コピーできませんでした"));
    }
  };

  if (!result) {
    return (
      <div style={emptyContainerStyle}>
        <div style={emptyCardStyle}>
          <div
            style={{
              fontSize: "64px",
              marginBottom: "20px",
              color: "var(--app-border)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <BiSearchAlt />
          </div>
          <h2 style={{ margin: "0 0 10px 0", color: "var(--app-text)" }}>
            まだ評価結果がありません
          </h2>
          <p style={{ color: "var(--app-muted)", marginBottom: "30px" }}>
            現在の設計が要件を満たしているか、AIアーキテクトに診断してもらいましょう。
          </p>
          <button
            onClick={onEvaluate}
            disabled={isLoading}
            style={{
              ...buttonStyle,
              backgroundColor: isLoading ? "var(--app-border)" : "var(--app-primary)",
              cursor: isLoading ? "wait" : "pointer",
            }}
          >
            {isLoading ? "AIが診断中..." : "現在の設計を評価する"}
          </button>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "var(--app-success)";
    if (score >= 50) return "var(--app-warning)";
    return "var(--app-danger)";
  };

  const details = result.details || {
    availability: 0,
    scalability: 0,
    security: 0,
    maintainability: 0,
    costEfficiency: 0,
    feasibility: 0,
  };

  const totalScore = result.totalScore;

  const chartData = [
    { subject: "可用性", A: details.availability, fullMark: 100 },
    { subject: "拡張性", A: details.scalability, fullMark: 100 },
    { subject: "安全性", A: details.security, fullMark: 100 },
    { subject: "保守性", A: details.maintainability, fullMark: 100 },
    { subject: "コスト", A: details.costEfficiency, fullMark: 100 },
    { subject: "実現性", A: details.feasibility, fullMark: 100 },
  ];

  return (
    <div style={containerStyle}>
      <div className="evaluation-header" style={headerStyle}>
        <h2 style={{ margin: 0 }}>アーキテクチャ評価レポート</h2>

        <div className="evaluation-actions" style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleCopyLink}
            style={iconButtonStyle}
            title="URLをコピー"
          >
            <BiLink size={18} />
            {copyFeedback ? (
              <span style={{ fontSize: "12px" }}>{copyFeedback}</span>
            ) : (
              "リンク"
            )}
          </button>

          <button
            onClick={handleShare}
            disabled={isSharing}
            style={{
              ...shareButtonStyle,
              opacity: isSharing ? 0.7 : 1,
              cursor: isSharing ? "wait" : "pointer",
            }}
          >
            <SiX size={14} />
            {isSharing ? "生成中..." : "結果をシェア"}
          </button>

          <button
            onClick={onEvaluate}
            disabled={isLoading}
            style={retryButtonStyle}
          >
            {isLoading ? (
              "再評価中..."
            ) : (
              <>
                <BiRevision size={18} /> 再評価する
              </>
            )}
          </button>
        </div>
      </div>

      <div className="evaluation-top" style={topSectionStyle}>
        {/* 左側: 総合スコア */}
        <div className="evaluation-score" style={scoreBoxStyle}>
          <div style={scoreLabelStyle}>総合スコア</div>
          <div style={{ ...scoreValueStyle, color: getScoreColor(totalScore) }}>
            {totalScore}
            <span style={{ fontSize: "24px", color: "#999" }}>/100</span>
          </div>
        </div>

        {/* 右側: レーダーチャート */}
        <div className="evaluation-chart" style={chartBoxStyle}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
              <Radar
                name="Score"
                dataKey="A"
                stroke="var(--app-primary)"
                fill="var(--app-primary)"
                fillOpacity={0.18}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={contentStyle}>
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>
            <BiBot size={24} color="var(--app-primary)" /> AIからのフィードバック
          </h3>
          <div className="evaluation-markdown" style={markdownContainerStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} components={{ a: ({ children }) => <span>{children}</span> }}>
              {result.feedback}
            </ReactMarkdown>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>
            <BiBulb size={24} color="var(--app-warning)" /> 改善のための提案
          </h3>
          <div className="evaluation-markdown" style={markdownContainerStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} components={{ a: ({ children }) => <span>{children}</span> }}>
              {result.improvement}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Styles ---
const iconButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  backgroundColor: "white",
  color: "var(--app-muted)",
  border: "1px solid var(--app-border)",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "13px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minWidth: "80px",
  justifyContent: "center",
};

const containerStyle: React.CSSProperties = {
  padding: "24px",
  height: "100%",
  overflowY: "auto",
  backgroundColor: "var(--app-bg)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
};

const topSectionStyle: React.CSSProperties = {
  display: "flex",
  gap: "20px",
  marginBottom: "30px",
  minHeight: CHART_HEIGHT + 20,
};

const scoreBoxStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: "white",
  borderRadius: "10px",
  border: "1px solid var(--app-border)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "var(--app-shadow)",
};

const chartBoxStyle: React.CSSProperties = {
  flex: 2,
  backgroundColor: "white",
  borderRadius: "10px",
  border: "1px solid var(--app-border)",
  padding: "10px",
  boxShadow: "var(--app-shadow)",
};

const emptyContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100%",
  backgroundColor: "var(--app-bg)",
  padding: "20px",
};

const emptyCardStyle: React.CSSProperties = {
  backgroundColor: "white",
  padding: "32px",
  borderRadius: "10px",
  border: "1px solid var(--app-border)",
  textAlign: "center",
  boxShadow: "var(--app-shadow)",
  maxWidth: "500px",
  width: "100%",
};

const scoreLabelStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "var(--app-muted)",
  marginBottom: "5px",
  fontWeight: "bold",
};

const scoreValueStyle: React.CSSProperties = {
  fontSize: "64px",
  fontWeight: "bold",
  lineHeight: 1,
};

const contentStyle: React.CSSProperties = {
  display: "flex",
  paddingBottom: "24px",
  flexDirection: "column",
  gap: "24px",
};

const sectionStyle: React.CSSProperties = {};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "bold",
  marginBottom: "15px",
  color: "var(--app-text)",
  borderLeft: "4px solid var(--app-primary)",
  paddingLeft: "10px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const markdownContainerStyle: React.CSSProperties = {
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "8px",
  border: "1px solid var(--app-border)",
  lineHeight: "1.7",
  color: "var(--app-text)",
  fontSize: "15px",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 24px",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "bold",
};

const retryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "white",
  color: "var(--app-muted)",
  border: "1px solid var(--app-border)",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const shareButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "black",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: "bold",
};
