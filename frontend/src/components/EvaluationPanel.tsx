import React, { useState } from "react";
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
import type { EvaluationResult, Scenario } from "../types";

// 環境変数の読み込み
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const SHARE_BASE_URL =
  import.meta.env.VITE_APP_SHARE_URL || window.location.origin;

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

  // 完全なシナリオデータをエンコードしてロングURLを生成する関数
  const createLongUrl = () => {
    const challengeData: Scenario = {
      ...scenario,
      id: `challenge_${Date.now()}`,
      isCustom: true,
    };

    try {
      const jsonString = JSON.stringify(challengeData);
      // 日本語対応Base64エンコード
      const encoded = btoa(unescape(encodeURIComponent(jsonString)));

      const cleanBaseUrl = SHARE_BASE_URL.endsWith("/")
        ? SHARE_BASE_URL.slice(0, -1)
        : SHARE_BASE_URL;

      // encoded を encodeURIComponent でエスケープする
      // これにより '+' が '%2B' になり、URLパラメータとして安全に渡せるようになります
      return `${cleanBaseUrl}/?challenge=${encodeURIComponent(encoded)}`;
    } catch (e) {
      console.error("Encoding error:", e);
      return null;
    }
  };

  // バックエンド経由で短縮URLを取得してシェアする
  const handleShare = async () => {
    if (!result) return;
    setIsSharing(true);

    try {
      const longUrl = createLongUrl();
      if (!longUrl) throw new Error("URL generation failed");

      const response = await fetch(`${API_BASE_URL}/api/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_url: longUrl }),
      });

      if (!response.ok) throw new Error("Shorten API failed");

      const data = await response.json();
      const shortUrl = data.short_url;

      const score = result.totalScore || result.score || 0;
      const text = `Architecture Sandboxで「${scenario.title}」を設計しました！\n総合スコア: ${score}点\n\n▼この要件で設計に挑戦する`;
      const hashtags = "ArchitectureSandbox,システム設計";

      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&hashtags=${hashtags}&url=${encodeURIComponent(shortUrl)}`;
      window.open(tweetUrl, "_blank");
    } catch (error) {
      console.error(error);
      alert("シェア用URLの生成に失敗しました。");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    const url = createLongUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopyFeedback("Copied!");
        setTimeout(() => setCopyFeedback(""), 2000);
      });
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
              color: "#ccc",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <BiSearchAlt />
          </div>
          <h2 style={{ margin: "0 0 10px 0", color: "#333" }}>
            まだ評価結果がありません
          </h2>
          <p style={{ color: "#666", marginBottom: "30px" }}>
            現在の設計が要件を満たしているか、AIアーキテクトに診断してもらいましょう。
          </p>
          <button
            onClick={onEvaluate}
            disabled={isLoading}
            style={{
              ...buttonStyle,
              backgroundColor: isLoading ? "#ccc" : "#2196F3",
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
    if (score >= 80) return "#4CAF50";
    if (score >= 50) return "#FF9800";
    return "#F44336";
  };

  const details = result.details || {
    availability: 0,
    scalability: 0,
    security: 0,
    maintainability: 0,
    costEfficiency: 0,
    feasibility: 0,
  };

  const totalScore = result.totalScore || result.score || 0;

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
      <div style={headerStyle}>
        <h2 style={{ margin: 0 }}>アーキテクチャ評価レポート</h2>

        <div style={{ display: "flex", gap: "10px" }}>
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

      <div style={topSectionStyle}>
        {/* 左側: 総合スコア */}
        <div style={scoreBoxStyle}>
          <div style={scoreLabelStyle}>総合スコア</div>
          <div style={{ ...scoreValueStyle, color: getScoreColor(totalScore) }}>
            {totalScore}
            <span style={{ fontSize: "24px", color: "#999" }}>/100</span>
          </div>
        </div>

        {/* 右側: レーダーチャート */}
        <div style={chartBoxStyle}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
              <Radar
                name="Score"
                dataKey="A"
                stroke="#2196F3"
                fill="#2196F3"
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={contentStyle}>
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>
            <BiBot size={24} color="#2196F3" /> AIからのフィードバック
          </h3>
          <div style={markdownContainerStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.feedback}
            </ReactMarkdown>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>
            <BiBulb size={24} color="#FFC107" /> 改善のための提案
          </h3>
          <div style={markdownContainerStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
  color: "#555",
  border: "1px solid #ccc",
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
  padding: "30px",
  height: "100%",
  overflowY: "auto",
  backgroundColor: "#f5f7fa",
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
  height: "300px",
};

const scoreBoxStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: "white",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const chartBoxStyle: React.CSSProperties = {
  flex: 2,
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "10px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const emptyContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100%",
  backgroundColor: "#f5f7fa",
  padding: "20px",
};

const emptyCardStyle: React.CSSProperties = {
  backgroundColor: "white",
  padding: "40px",
  borderRadius: "12px",
  textAlign: "center",
  boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
  maxWidth: "500px",
  width: "100%",
};

const scoreLabelStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#666",
  marginBottom: "5px",
  fontWeight: "bold",
};

const scoreValueStyle: React.CSSProperties = {
  fontSize: "80px",
  fontWeight: "bold",
  lineHeight: 1,
};

const contentStyle: React.CSSProperties = {
  display: "flex",
  paddingBottom: "80px",
  flexDirection: "column",
  gap: "30px",
};

const sectionStyle: React.CSSProperties = {};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "bold",
  marginBottom: "15px",
  color: "#333",
  borderLeft: "4px solid #2196F3",
  paddingLeft: "10px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const markdownContainerStyle: React.CSSProperties = {
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "8px",
  border: "1px solid #e1e4e8",
  lineHeight: "1.7",
  color: "#24292e",
  fontSize: "15px",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 24px",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontSize: "16px",
  fontWeight: "bold",
};

const retryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "white",
  color: "#666",
  border: "1px solid #ccc",
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
