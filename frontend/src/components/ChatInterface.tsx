import React, { useState, useEffect, useRef } from "react";
import { BiUser, BiBot } from "react-icons/bi";

import type { Scenario, ChatMessage } from "../types"; // 共通型を使用

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const displayMessages = messages.filter((msg) => msg.role !== "system");

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // ユーザーメッセージを追加して親へ通知
    const userMessage: ChatMessage = { role: "user", content: input };
    const newHistory = [...messages, userMessage];

    // ここで一旦更新（画面には即座に反映）
    onSendMessage(newHistory);

    setInput("");
    setIsLoading(true);

try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenario.id,
          messages: newHistory,
          partner_role: scenario.partnerRole || 'ceo', 
        }),
      });

      if (!response.ok) throw new Error("API Error");

      const data = await response.json();

      // AIの返信を追加して親へ通知
      onSendMessage([...newHistory, { role: "model", content: data.reply }]);
    } catch (error) {
      console.error(error);
      onSendMessage([
        ...newHistory,
        { role: "model", content: "すみません、通信エラーが発生しました。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 変換中 (isComposing === true) のEnterは無視する
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === "Enter") {
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
              <BiBot size={24} color="#666" />
              </div>}
            <div
              style={{
                ...bubbleStyle,
                backgroundColor: msg.role === "user" ? "#2196F3" : "#f1f1f1",
                color: msg.role === "user" ? "white" : "black",
              }}
            >
              {msg.content}
            </div>
            {msg.role === "user" && <div style={iconStyle}>
              <BiUser size={24} color="#2196F3" />
              </div>}
          </div>
        ))}
        {isLoading && (
          <div style={{ textAlign: "center", color: "#999" }}>入力中...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={inputAreaStyle}>
        <input
          type="text"
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
  borderLeft: "1px solid #eee",
  borderRight: "1px solid #eee",
};

const messagesAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "15px",
};

const messageRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
};

const iconStyle: React.CSSProperties = {
  fontSize: "24px",
  marginTop: "5px",
};

const bubbleStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "18px",
  maxWidth: "70%",
  lineHeight: "1.5",
  fontSize: "15px",
  whiteSpace: "pre-wrap",
};

const inputAreaStyle: React.CSSProperties = {
  padding: "20px",
  borderTop: "1px solid #eee",
  display: "flex",
  gap: "10px",
  backgroundColor: "#f9f9f9",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  borderRadius: "24px",
  border: "1px solid #ddd",
  fontSize: "16px",
  outline: "none",
};

const sendButtonStyle: React.CSSProperties = {
  padding: "0 25px",
  borderRadius: "24px",
  border: "none",
  backgroundColor: "#2196F3",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};
