import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { BiUser, BiBot } from "react-icons/bi";

import type { Scenario, ChatMessage } from "../types"; // 共通型を使用

import { chatContext, publicScenario } from "../utils/projectFormat";
import { postJson } from "../utils/api";
import { API_BASE_URL } from "../config";

interface Props {
  scenario: Scenario;
  messages: ChatMessage[]; // 親から受け取る
  onSendMessage: (newHistory: ChatMessage[]) => void; // 更新関数も親からもらう
}

export const ChatInterface: React.FC<Props> = ({
  scenario,
  messages,
  onSendMessage,
}) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      if (!controller.signal.aborted) onSendMessage([...newHistory, { role: "model", content: data.reply }]);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "通信エラーが発生しました。");
        setInput(userMessage.content);
        onSendMessage(messages);
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
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
      <div style={messagesAreaStyle}>
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
        <div ref={messagesEndRef} />
      </div>

      {error && <p role="alert" style={{ color: "var(--app-danger)", padding: "0 20px" }}>{error}</p>}
      <div style={inputAreaStyle}>
        <textarea
          className="chat-composer"
          ref={inputRef}
          rows={1}
          aria-label="メッセージ"
          aria-describedby="chat-input-help"
          maxLength={4000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="要件について質問する（例：予算はどのくらいですか？）"
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
      <div id="chat-input-help" style={inputHelpStyle}>
        Enterで送信・Shift + Enterで改行
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
  padding: "20px 20px 8px",
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

const inputHelpStyle: React.CSSProperties = {
  padding: "0 20px 12px",
  fontSize: "12px",
  color: "var(--app-muted)",
  backgroundColor: "var(--app-subtle)",
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
