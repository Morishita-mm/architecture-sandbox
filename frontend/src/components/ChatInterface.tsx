import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { BiUser, BiBot } from "react-icons/bi";

import type { Scenario, ChatMessage, InterviewEvidence, NegotiationProposal, RequirementRevision } from "../types"; // 共通型を使用

import { chatContext, publicScenario } from "../utils/projectFormat";
import { postJson } from "../utils/api";
import { API_BASE_URL } from "../config";
import { PROFILE_LABELS } from "../scenarios";

interface Props {
  scenario: Scenario;
  messages: ChatMessage[]; // 親から受け取る
  onSendMessage: (newHistory: ChatMessage[]) => void; // 更新関数も親からもらう
  evidence: InterviewEvidence[];
  onUpdateEvidence: (evidence: InterviewEvidence[]) => void;
  requirementRevisions: RequirementRevision[];
  onAcceptNegotiation: (proposal: NegotiationProposal) => void;
  request: React.RefObject<AbortController | null>;
}

export const ChatInterface: React.FC<Props> = ({
  scenario,
  messages,
  onSendMessage,
  evidence,
  onUpdateEvidence,
  requirementRevisions,
  onAcceptNegotiation,
  request,
}) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingProposals, setPendingProposals] = useState<NegotiationProposal[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => request.current?.abort(), [request]);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "auto";
      // scrollHeight includes padding; add the top and bottom borders.
      if (textarea.value) textarea.style.height = `${textarea.scrollHeight + 2}px`;
    };
    resize();
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth !== width) {
        width = textarea.clientWidth;
        resize();
      }
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [input]);

  // 自動スクロール
  useEffect(() => {
    const area = messagesAreaRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [messages]);

  const displayMessages = messages;

  const handleSend = async () => {
    if (!input.trim() || request.current) return;
    if (messages.length >= 998) { setError("会話の上限に達しました。プロジェクトを保存して新しい設計を始めてください。"); return; }
    const controller = new AbortController();
    request.current = controller;
    setError("");

    // ユーザーメッセージを追加して親へ通知
    const userMessage: ChatMessage = { role: "user", content: input };
    const newHistory = [...messages, userMessage];

    // ここで一旦更新（画面には即座に反映）
    onSendMessage(newHistory);

    setInput("");
    setIsLoading(true);

    try {
      const data = await postJson(`${API_BASE_URL}/api/chat`, {
        scenario: publicScenario(scenario), messages: chatContext(newHistory),
      }, controller.signal);
      if (!data || typeof data !== "object" || !("reply" in data) || typeof data.reply !== "string" || !data.reply.trim() || [...data.reply].length > 4000) throw new Error("応答の形式が不正です。");
      const covered = "coveredConditions" in data ? data.coveredConditions : [];
      if (!Array.isArray(covered) || covered.length > 20 || covered.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 40 || typeof item.label !== 'string' || !item.label.trim() || [...item.label].length > 80)) throw new Error("応答の条件記録が不正です。");
      const proposals = "negotiationProposals" in data ? data.negotiationProposals : [];
      if (!Array.isArray(proposals) || proposals.length > 4 || proposals.some(item => !item || typeof item !== 'object'
        || typeof item.optionId !== 'string' || !item.optionId || item.optionId.length > 80
        || typeof item.conditionId !== 'string' || !item.conditionId || item.conditionId.length > 40
        || typeof item.label !== 'string' || !item.label.trim() || [...item.label].length > 80
        || typeof item.currentValue !== 'string' || !item.currentValue.trim() || [...item.currentValue].length > 2000
        || typeof item.proposedValue !== 'string' || !item.proposedValue.trim() || [...item.proposedValue].length > 2000)) throw new Error("応答の仕様変更案が不正です。");
      if (!controller.signal.aborted) {
        const byId = new Map(evidence.map(item => [item.conditionId, item]));
        for (const item of covered as { id: string; label: string }[]) byId.set(item.id, {
          conditionId: item.id, label: item.label, question: userMessage.content, answer: data.reply,
          questionMessageIndex: newHistory.length - 1, answerMessageIndex: newHistory.length,
        });
        onUpdateEvidence([...byId.values()]);
        setPendingProposals(proposals as NegotiationProposal[]);
        onSendMessage([...newHistory, { role: "model", content: data.reply }]);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "通信エラーが発生しました。");
        setInput(userMessage.content);
        onSendMessage(messages);
      }
      if (controller.signal.reason === 'leave') {
        setError('応答を中断しました。必要なら同じ質問を再送してください。');
        setInput(userMessage.content);
        onSendMessage(messages);
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted || controller.signal.reason === 'leave') setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 変換中 (isComposing === true) のEnterは無視する
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={containerStyle}>
      {scenario.profileId && <header className="scenario-case-summary">
        <div><span>今回のケース</span><strong>{PROFILE_LABELS[scenario.profileId]}</strong></div>
        <div><span>評価に使う仕様</span><strong>v{scenario.specificationVersion ?? 1}</strong></div>
      </header>}
      <div ref={messagesAreaRef} style={messagesAreaStyle}>
        {displayMessages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...messageRowStyle,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "model" && <div style={iconStyle}>
              <BiBot size={24} color="var(--app-muted)" />
              </div>}
            <div
              style={{
                ...bubbleStyle,
                backgroundColor: msg.role === "user" ? "var(--app-primary)" : "#f1f4f7",
                color: msg.role === "user" ? "white" : "var(--app-text)",
              }}
            >
              {msg.content}
            </div>
            {msg.role === "user" && <div style={iconStyle}>
              <BiUser size={24} color="var(--app-primary)" />
              </div>}
          </div>
        ))}
        {isLoading && (
          <div style={{ textAlign: "center", color: "#999" }}>入力中...</div>
        )}
      </div>

      {evidence.length > 0 && <aside className="interview-progress" aria-label="聞き取りで確認した条件">
        <strong>確認できた条件 {evidence.length}件</strong>
        <div>{evidence.map(item => <span key={item.conditionId}>{item.label}</span>)}</div>
      </aside>}

      {(requirementRevisions.length > 0 || pendingProposals.length > 0) && <aside className="specification-progress" aria-label="合意仕様の変更">
        <strong>合意仕様 v{scenario.specificationVersion ?? 1}</strong>
        {requirementRevisions.length > 0 && <p>確定済み: {requirementRevisions.map(item => item.label).join('、')}</p>}
        {pendingProposals.map(proposal => <div className="negotiation-proposal" key={proposal.optionId}>
          <p><strong>{proposal.label}の変更案</strong></p>
          <p><span>現在</span>{proposal.currentValue}</p>
          <p><span>変更後</span>{proposal.proposedValue}</p>
          <div>
            <button className="ui-button ui-button-success" onClick={() => { onAcceptNegotiation(proposal); setPendingProposals(items => items.filter(item => item.optionId !== proposal.optionId)); }}>この内容で仕様を確定</button>
            <button className="ui-button" onClick={() => setPendingProposals(items => items.filter(item => item.optionId !== proposal.optionId))}>今回は変更しない</button>
          </div>
        </div>)}
      </aside>}

      {error && <p role="alert" style={{ color: "var(--app-danger)", padding: "0 20px" }}>{error}</p>}
      <div style={inputAreaStyle}>
        <textarea
          className="chat-composer"
          ref={inputRef}
          rows={1}
          aria-label="メッセージ"
          maxLength={4000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="要件について質問する"
          style={inputStyle}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          style={sendButtonStyle}
          disabled={isLoading}
        >
          送信
        </button>
      </div>
    </div>
  );
};

// --- Styles (CSS-in-JS) ---
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  backgroundColor: "#fff",
  maxWidth: "800px",
  margin: "0 auto",
  borderLeft: "1px solid var(--app-border)",
  borderRight: "1px solid var(--app-border)",
};

const messagesAreaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const messageRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
};

const iconStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  width: "28px",
  height: "32px",
  marginTop: "5px",
};

const bubbleStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "12px",
  maxWidth: "78%",
  lineHeight: "1.75",
  fontSize: "15px",
  whiteSpace: "pre-wrap",
};

const inputAreaStyle: React.CSSProperties = {
  padding: "20px",
  borderTop: "1px solid var(--app-border)",
  display: "flex",
  gap: "10px",
  backgroundColor: "var(--app-subtle)",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid var(--app-border)",
  fontSize: "15px",
  fontFamily: "inherit",
  lineHeight: "24px",
  boxSizing: "border-box",
  resize: "none",
  // One to three 24px lines, plus 24px padding and 2px borders.
  minHeight: "50px",
  maxHeight: "98px",
  overflowY: "auto",
};

const sendButtonStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  height: "50px",
  padding: "0 20px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "var(--app-primary)",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};
