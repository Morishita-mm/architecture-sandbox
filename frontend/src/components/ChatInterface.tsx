import React, { useState, useEffect, useRef } from 'react';
import type { Scenario } from '../scenarios';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface Props {
  scenario: Scenario;
}

export const ChatInterface: React.FC<Props> = ({ scenario }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // シナリオが変わったら履歴をリセットし、最初の挨拶を入れる
  useEffect(() => {
    setMessages([{
      role: 'model',
      content: `こんにちは。「${scenario.title}」の件についてですね。どのようなシステムをご提案いただけますか？`
    }]);
  }, [scenario.id]);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newHistory = [...messages, userMessage];
    
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      // バックエンドへ送信
      const response = await fetch('http://localhost:8080/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: scenario.id,
          messages: newHistory,
        }),
      });

      if (!response.ok) throw new Error('API Error');

      const data = await response.json();
      
      // AIの返信を追加
      setMessages(prev => [...prev, { role: 'model', content: data.reply }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: 'すみません、通信エラーが発生しました。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      {/* メッセージ表示エリア */}
      <div style={messagesAreaStyle}>
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            style={{
              ...messageRowStyle,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {/* アイコン（簡易） */}
            {msg.role === 'model' && <div style={iconStyle}>🤖</div>}
            
            <div style={{
              ...bubbleStyle,
              backgroundColor: msg.role === 'user' ? '#2196F3' : '#f1f1f1',
              color: msg.role === 'user' ? 'white' : 'black',
            }}>
              {msg.content}
            </div>
            
            {msg.role === 'user' && <div style={iconStyle}>👤</div>}
          </div>
        ))}
        {isLoading && <div style={{ textAlign: 'center', color: '#999' }}>入力中...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div style={inputAreaStyle}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="要件について質問する（例：予算はどのくらいですか？）"
          style={inputStyle}
          disabled={isLoading}
        />
        <button onClick={handleSend} style={sendButtonStyle} disabled={isLoading}>
          送信
        </button>
      </div>
    </div>
  );
};

// --- Styles (CSS-in-JS) ---
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#fff',
  maxWidth: '800px',
  margin: '0 auto',
  borderLeft: '1px solid #eee',
  borderRight: '1px solid #eee',
};

const messagesAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
};

const messageRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
};

const iconStyle: React.CSSProperties = {
  fontSize: '24px',
  marginTop: '5px',
};

const bubbleStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '18px',
  maxWidth: '70%',
  lineHeight: '1.5',
  fontSize: '15px',
  whiteSpace: 'pre-wrap',
};

const inputAreaStyle: React.CSSProperties = {
  padding: '20px',
  borderTop: '1px solid #eee',
  display: 'flex',
  gap: '10px',
  backgroundColor: '#f9f9f9',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  borderRadius: '24px',
  border: '1px solid #ddd',
  fontSize: '16px',
  outline: 'none',
};

const sendButtonStyle: React.CSSProperties = {
  padding: '0 25px',
  borderRadius: '24px',
  border: 'none',
  backgroundColor: '#2196F3',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
};