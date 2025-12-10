import React, { useState } from "react";
import {
  BiHelpCircle,
  BiX,
  BiMouse,
  BiEdit,
  BiBot,
  BiBarChart,
  BiRightArrowAlt,
  BiKey,
  BiBulb,
  BiXCircle,
  BiCheckCircle,
  BiRevision,
  BiListUl,
} from "react-icons/bi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "flow" | "canvas" | "ai" | "evaluation";

export const HelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("flow");

  if (!isOpen) return null;

  // タブの定義 (ラベルから絵文字を除去)
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "flow", label: "基本的な流れ", icon: <BiListUl /> },
    { key: "canvas", label: "キャンバス操作", icon: <BiMouse /> },
    { key: "ai", label: "AI活用のコツ", icon: <BiBot /> },
    { key: "evaluation", label: "評価と改善", icon: <BiBarChart /> },
  ];

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BiHelpCircle size={24} color="#2196F3" />
            <h2 style={{ margin: 0, fontSize: "20px" }}>ユーザーガイド</h2>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>
            <BiX size={24} />
          </button>
        </div>

        {/* メインエリア（2カラム） */}
        <div style={bodyStyle}>
          {/* 左サイドバー（メニュー） */}
          <div style={sidebarStyle}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={activeTab === tab.key ? activeTabStyle : tabStyle}
              >
                <span style={tabIconStyle}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 右コンテンツエリア */}
          <div style={contentAreaStyle}>
            {activeTab === "flow" && (
              <div style={animateInStyle}>
                <h3 style={contentTitleStyle}>設計の基本的なワークフロー</h3>
                <p>このアプリケーションは、以下の4ステップで設計を進めます。</p>

                <div style={stepContainerStyle}>
                  <StepItem number={1} title="要件定義 (Chat)">
                    AIクライアントと会話して、隠れた要件（予算、ユーザー数、制約条件など）を引き出します。
                  </StepItem>
                  <StepItem number={2} title="アーキテクチャ設計 (Canvas)">
                    必要なコンポーネントを配置し、システム構成図を作成します。
                  </StepItem>
                  <StepItem number={3} title="詳細設定 (Properties)">
                    各コンポーネントに具体的な役割や技術スタックを記述します。
                  </StepItem>
                  <StepItem number={4} title="評価・改善 (Evaluate)">
                    AIアーキテクトに設計を評価してもらい、フィードバックを元に修正します。
                  </StepItem>
                </div>
              </div>
            )}

            {activeTab === "canvas" && (
              <div style={animateInStyle}>
                <h3 style={contentTitleStyle}>キャンバスの操作方法</h3>
                <table style={tableStyle}>
                  <tbody>
                    <tr>
                      <td style={tdIconStyle}>
                        <BiMouse size={20} />
                      </td>
                      <td style={tdLabelStyle}>配置</td>
                      <td>
                        左サイドバーからコンポーネントをドラッグ＆ドロップ
                      </td>
                    </tr>
                    <tr>
                      <td style={tdIconStyle}>
                        <BiRightArrowAlt size={20} />
                      </td>
                      <td style={tdLabelStyle}>接続</td>
                      <td>
                        コンポーネント上下の「●」ハンドルをドラッグして線を繋ぐ
                      </td>
                    </tr>
                    <tr>
                      <td style={tdIconStyle}>
                        <BiEdit size={20} />
                      </td>
                      <td style={tdLabelStyle}>編集</td>
                      <td>
                        コンポーネントをクリックしてプロパティパネルを開く
                      </td>
                    </tr>
                    <tr>
                      <td style={tdIconStyle}>
                        <BiKey size={20} />
                      </td>
                      <td style={tdLabelStyle}>削除</td>
                      <td>
                        ノードまたはエッジを選択して <Kbd>Backspace</Kbd> または{" "}
                        <Kbd>Delete</Kbd>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={tipBoxStyle}>
                  <strong
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <BiBulb size={18} /> Tip:
                  </strong>
                  キャンバスの何もないところをドラッグすると視点を移動でき、マウスホイールでズームイン・アウトが可能です。
                </div>
              </div>
            )}

            {activeTab === "ai" && (
              <div style={animateInStyle}>
                <h3 style={contentTitleStyle}>AI評価の精度を上げるコツ</h3>
                <p>
                  AIは配置されたコンポーネントの「種類」だけでなく、あなたが入力した
                  <strong>「名前」</strong>や<strong>「詳細メモ」</strong>
                  も読み取っています。
                </p>

                <div style={exampleBoxStyle}>
                  <div
                    style={{
                      marginBottom: "10px",
                      fontWeight: "bold",
                      color: "#666",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    悪い例 <BiXCircle color="#F44336" />
                  </div>
                  <div style={badNodeStyle}>Web Server</div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#888",
                      margin: "5px 0 15px 0",
                    }}
                  >
                    （情報が少なすぎて、具体的なアドバイスができない）
                  </p>

                  <div
                    style={{
                      marginBottom: "10px",
                      fontWeight: "bold",
                      color: "#2196F3",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    良い例 <BiCheckCircle color="#4CAF50" />
                  </div>
                  <div style={goodNodeStyle}>
                    <div style={{ fontWeight: "bold" }}>画像処理サーバー</div>
                    <div style={{ fontSize: "10px", marginTop: "4px" }}>
                      Python (FastAPI) + OpenCV
                      <br />
                      GPUインスタンスを使用
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginTop: "5px",
                    }}
                  >
                    （「GPUを使っているならコストに注意」といった具体的な指摘が可能に！）
                  </p>
                </div>
              </div>
            )}

            {activeTab === "evaluation" && (
              <div style={animateInStyle}>
                <h3 style={contentTitleStyle}>評価レポートの見方</h3>
                <p>
                  設計が完了したら、右上の
                  <strong style={{ color: "#4CAF50" }}>
                    「設計完了（評価する）」
                  </strong>
                  ボタンを押してください。
                </p>

                <ul style={listStyle}>
                  <li>
                    <strong>総合スコア:</strong>{" "}
                    100点満点で評価されます。80点以上を目指しましょう。
                  </li>
                  <li>
                    <strong>レーダーチャート:</strong>{" "}
                    「可用性」「拡張性」「コスト」などのバランスを可視化します。
                  </li>
                  <li>
                    <strong>フィードバック:</strong>{" "}
                    良い点と改善点がテキストで詳しく表示されます。
                  </li>
                </ul>

                <div style={tipBoxStyle}>
                  <strong
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <BiRevision size={18} /> サイクルを回す:
                  </strong>
                  一度で完璧な設計を目指す必要はありません。「設計 → 評価 → 修正
                  →
                  再評価」を繰り返すことで、より良いアーキテクチャに洗練されていきます。
                </div>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div style={footerStyle}>
          <button onClick={onClose} style={primaryButtonStyle}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

// --- サブコンポーネント ---

const StepItem: React.FC<{
  number: number;
  title: string;
  children: React.ReactNode;
}> = ({ number, title, children }) => (
  <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
    <div
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        backgroundColor: "#E3F2FD",
        color: "#2196F3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        flexShrink: 0,
      }}
    >
      {number}
    </div>
    <div>
      <div style={{ fontWeight: "bold", marginBottom: "5px", color: "#333" }}>
        {title}
      </div>
      <div style={{ fontSize: "14px", color: "#666", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  </div>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    style={{
      backgroundColor: "#eee",
      border: "1px solid #ccc",
      borderRadius: "3px",
      padding: "2px 6px",
      fontSize: "12px",
      fontFamily: "monospace",
      margin: "0 4px",
    }}
  >
    {children}
  </kbd>
);

// --- Styles ---

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
  backdropFilter: "blur(2px)",
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "white",
  width: "900px",
  height: "600px",
  maxWidth: "95vw",
  maxHeight: "90vh",
  borderRadius: "12px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  padding: "15px 25px",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#fff",
};

const bodyStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  overflow: "hidden",
};

const sidebarStyle: React.CSSProperties = {
  width: "220px",
  backgroundColor: "#f8f9fa",
  borderRight: "1px solid #eee",
  padding: "20px 0",
  display: "flex",
  flexDirection: "column",
};

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: "30px 40px",
  overflowY: "auto",
  backgroundColor: "#fff",
};

const footerStyle: React.CSSProperties = {
  padding: "15px 25px",
  borderTop: "1px solid #eee",
  textAlign: "right",
  backgroundColor: "#f8f9fa",
};

const tabStyle: React.CSSProperties = {
  padding: "12px 20px",
  border: "none",
  background: "transparent",
  textAlign: "left",
  cursor: "pointer",
  color: "#666",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  transition: "all 0.2s",
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  backgroundColor: "#e3f2fd",
  color: "#1976D2",
  fontWeight: "bold",
  borderRight: "3px solid #1976D2",
};

const tabIconStyle: React.CSSProperties = {
  marginRight: "10px",
  fontSize: "18px",
  display: "flex",
  alignItems: "center",
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#888",
  padding: "5px",
  display: "flex",
  transition: "color 0.2s",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 30px",
  backgroundColor: "#2196F3",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "bold",
};

const contentTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: "25px",
  fontSize: "24px",
  color: "#333",
  borderBottom: "1px solid #eee",
  paddingBottom: "10px",
};

const stepContainerStyle: React.CSSProperties = {
  marginTop: "20px",
};

const tipBoxStyle: React.CSSProperties = {
  backgroundColor: "#fff3cd",
  border: "1px solid #ffeeba",
  borderRadius: "6px",
  padding: "15px",
  color: "#856404",
  fontSize: "14px",
  marginTop: "20px",
  lineHeight: "1.6",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const tdIconStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #eee",
  width: "40px",
  color: "#555",
};

const tdLabelStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #eee",
  fontWeight: "bold",
  width: "100px",
  color: "#333",
};

const listStyle: React.CSSProperties = {
  paddingLeft: "20px",
  lineHeight: "1.8",
  color: "#555",
};

const animateInStyle: React.CSSProperties = {
  animation: "fadeIn 0.3s ease-out",
};

const exampleBoxStyle: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  padding: "20px",
  borderRadius: "8px",
  border: "1px solid #ddd",
};

const badNodeStyle: React.CSSProperties = {
  padding: "10px",
  border: "2px solid #ccc",
  borderRadius: "8px",
  backgroundColor: "white",
  color: "#333",
  textAlign: "center",
  width: "120px",
  margin: "0 auto",
};

const goodNodeStyle: React.CSSProperties = {
  padding: "10px",
  border: "2px solid #2196F3",
  borderRadius: "8px",
  backgroundColor: "#E3F2FD",
  color: "#0D47A1",
  textAlign: "center",
  width: "180px",
  margin: "0 auto",
  boxShadow: "0 4px 6px rgba(33, 150, 243, 0.2)",
};

// CSSアニメーション用のstyleタグ（簡易的）
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
if (!document.getElementById("modal-style")) {
  styleSheet.id = "modal-style";
  document.head.appendChild(styleSheet);
}
