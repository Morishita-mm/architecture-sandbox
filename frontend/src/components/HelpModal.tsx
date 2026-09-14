import React, { useState, useEffect, useRef } from "react";
import {
  BiHelpCircle,
  BiArrowBack,
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
  BiSave,
  BiShareAlt,
  BiRocket,
} from "react-icons/bi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "flow" | "canvas" | "ai" | "evaluation" | "share";

export const HelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const topicButtons = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  const returnTopic = useRef<TabKey | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      trigger?.focus();
    };
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (activeTab) contentRef.current?.querySelector<HTMLElement>("h3")?.focus();
    else if (returnTopic.current) topicButtons.current[returnTopic.current]?.focus();
  }, [activeTab, isOpen]);
  const closeGuide = () => {
    dialogRef.current?.close();
    setActiveTab(null);
    returnTopic.current = null;
    onClose();
  };
  const showContents = () => { returnTopic.current = activeTab; setActiveTab(null); };

  if (!isOpen) return null;

  // タブの定義
  const tabs: { key: TabKey; label: string; description: string; icon: React.ReactNode }[] = [
    { key: "flow", label: "基本的な流れ", description: "ヒアリングから設計・評価までの進め方", icon: <BiListUl /> },
    { key: "canvas", label: "キャンバス操作", description: "部品の配置・接続・グループ化", icon: <BiMouse /> },
    { key: "ai", label: "AI活用のコツ", description: "要件を聞き出し、設計意図を伝える", icon: <BiBot /> },
    { key: "evaluation", label: "評価と改善", description: "スコアとフィードバックの読み方", icon: <BiBarChart /> },
    { key: "share", label: "共有と挑戦", description: "保存・共有とチャレンジの始め方", icon: <BiShareAlt /> },
  ];

  const topicIndex = tabs.findIndex(tab => tab.key === activeTab);

  return (
    <dialog ref={dialogRef} className="help-dialog" style={modalStyle} aria-labelledby="guide-title" onCancel={event => { event.preventDefault(); closeGuide(); }} onClick={event => { if (event.target === event.currentTarget) closeGuide(); }}>
      <div className="help-dialog-inner">
        {/* ヘッダー */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BiHelpCircle size={24} color="var(--app-primary)" />
            <h2 id="guide-title" style={{ margin: 0, fontSize: "20px" }}>ユーザーガイド</h2>
          </div>
          <button onClick={closeGuide} style={closeButtonStyle} aria-label="操作ガイドを閉じる">
            <BiX size={24} />
          </button>
        </div>

        <div ref={contentRef} className="help-content" style={contentAreaStyle}>
          {activeTab === null ? (
            <div className="help-index">
              <h3>どの操作を確認しますか？</h3>
              <p>項目を選ぶと、詳しい使い方を確認できます。</p>
              <nav aria-label="ガイドの目次">
                {tabs.map(tab => <button key={tab.key} ref={element => { topicButtons.current[tab.key] = element; }} onClick={() => setActiveTab(tab.key)}>
                  <span className="help-topic-icon">{tab.icon}</span>
                  <span><strong>{tab.label}</strong><small>{tab.description}</small></span>
                  <BiRightArrowAlt size={20} />
                </button>)}
              </nav>
            </div>
          ) : <div className="help-article-nav"><button className="ui-button" onClick={showContents}><BiArrowBack size={16} />目次に戻る</button><span>{topicIndex + 1} / {tabs.length}</span></div>}
            {activeTab === "flow" && (
              <div style={animateInStyle}>
                <h3 tabIndex={-1} style={contentTitleStyle}>設計の基本的なワークフロー</h3>
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

                <div style={tipBoxStyle}>
                  <strong
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      marginBottom: "5px",
                    }}
                  >
                    <BiSave size={18} /> 保存と中断について:
                  </strong>
                  作業内容は画面右上の
                  <strong style={{ color: "var(--app-success)" }}>
                    「プロジェクト保存」
                  </strong>
                  ボタンから、いつでもローカルファイル（.json）として保存できます。
                  <br />
                  保存したファイルは、トップ画面の「既存プロジェクトを読み込む」から読み込むことで、続きから再開可能です。
                </div>
              </div>
            )}

            {activeTab === "canvas" && (
              <div style={animateInStyle}>
                <h3 tabIndex={-1} style={contentTitleStyle}>キャンバスの操作方法</h3>
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
                        コンポーネントはプロパティパネルの削除ボタンから削除できます。
                        <br />
                        ノードまたはエッジを選択して <Kbd>Backspace</Kbd> または{" "}
                        <Kbd>Delete</Kbd> でも削除できます。
                        グループを削除すると、内部のコンポーネントと接続線も削除されます。
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
                <h3 tabIndex={-1} style={contentTitleStyle}>AI評価の精度を上げるコツ</h3>
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
                      color: "var(--app-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    悪い例 <BiXCircle color="var(--app-danger)" />
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
                      color: "var(--app-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    良い例 <BiCheckCircle color="var(--app-success)" />
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
                      color: "var(--app-muted)",
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
                <h3 tabIndex={-1} style={contentTitleStyle}>評価レポートの見方</h3>
                <p>
                  設計が完了したら、右上の
                  <strong style={{ color: "var(--app-success)" }}>
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

            {/* ★追加: 共有と挑戦タブ */}
            {activeTab === "share" && (
              <div style={animateInStyle}>
                <h3 tabIndex={-1} style={contentTitleStyle}>設計を共有して競い合おう</h3>
                <p>
                  納得のいく設計ができたら、SNSでシェアして他のエンジニアに
                  <strong>「挑戦状」</strong>を送りましょう。
                </p>

                <div style={stepContainerStyle}>
                  <StepItem number={1} title="結果をシェアする">
                    評価画面の<strong>「結果をシェア」</strong>
                    ボタンを押すと、X（旧Twitter）への投稿画面が開きます。
                    投稿にはスコアと<strong>「挑戦用URL」</strong>が含まれます。
                  </StepItem>
                  <StepItem number={2} title="挑戦状を送る">
                    発行されたURLには、あなたが設計したシナリオの要件（難易度、相手役、そして
                    <strong>隠しパラメータ</strong>）が全て含まれています。
                    <br />
                    このURLを受け取った人は、<strong>全く同じ条件・制約</strong>
                    で設計に挑戦できます。
                  </StepItem>
                  <StepItem number={3} title="設計を見せ合う">
                    「プロジェクト保存」でダウンロードしたJSONファイルを交換すれば、お互いの設計図を自分の手元で再現・再評価できます。
                    設計思想の違いを議論してみましょう！
                  </StepItem>
                </div>

                <div style={tipBoxStyle}>
                  <strong
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <BiRocket size={18} /> Challenge Modeについて:
                  </strong>
                  共有URLからアクセスした場合、隠し要件（ユーザー数や予算など）は伏せられた状態でスタートします。
                  <br />
                  通常のプレイと同様に、まずはクライアント（AI）へのヒアリングから始めてください。
                </div>
              </div>
            )}
        </div>

        {/* フッター */}
        <div className="help-footer" style={footerStyle}>
          {activeTab !== null && <div className="help-page-controls">
            <button className="ui-button" disabled={topicIndex === 0} onClick={() => setActiveTab(tabs[topicIndex - 1].key)}>前の項目</button>
            <button className="ui-button" disabled={topicIndex === tabs.length - 1} onClick={() => setActiveTab(tabs[topicIndex + 1].key)}>次の項目</button>
          </div>}
          <button onClick={closeGuide} style={primaryButtonStyle}>閉じる</button>
        </div>
      </div>
    </dialog>
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
        backgroundColor: "var(--app-primary-soft)",
        color: "var(--app-primary)",
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
      <div style={{ fontWeight: "bold", marginBottom: "5px", color: "var(--app-text)" }}>
        {title}
      </div>
      <div style={{ fontSize: "14px", color: "var(--app-muted)", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  </div>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    style={{
      backgroundColor: "var(--app-border)",
      border: "1px solid var(--app-border)",
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

const modalStyle: React.CSSProperties = {
  backgroundColor: "white",
  width: "900px",
  height: "660px",
  maxWidth: "95vw",
  maxHeight: "90vh",
  borderRadius: "12px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
  padding: 0,
  border: "1px solid var(--app-border)",
  color: "var(--app-text)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  padding: "15px 25px",
  borderBottom: "1px solid var(--app-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#fff",
};

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: "var(--help-content-padding, 24px 32px)",
  overflowY: "auto",
  backgroundColor: "#fff",
};

const footerStyle: React.CSSProperties = {
  padding: "var(--help-footer-padding, 15px 25px)",
  borderTop: "1px solid var(--app-border)",
  textAlign: "right",
  backgroundColor: "var(--app-subtle)",
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
  backgroundColor: "var(--app-primary)",
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
  fontSize: "21px",
  color: "var(--app-text)",
  borderBottom: "1px solid var(--app-border)",
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
  borderBottom: "1px solid var(--app-border)",
  width: "40px",
  color: "var(--app-muted)",
};

const tdLabelStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid var(--app-border)",
  fontWeight: "bold",
  width: "100px",
  color: "var(--app-text)",
};

const listStyle: React.CSSProperties = {
  paddingLeft: "20px",
  lineHeight: "1.8",
  color: "var(--app-muted)",
};

const animateInStyle: React.CSSProperties = {
  animation: "fadeIn 0.3s ease-out",
};

const exampleBoxStyle: React.CSSProperties = {
  backgroundColor: "var(--app-subtle)",
  padding: "20px",
  borderRadius: "8px",
  border: "1px solid var(--app-border)",
};

const badNodeStyle: React.CSSProperties = {
  padding: "10px",
  border: "2px solid var(--app-border)",
  borderRadius: "8px",
  backgroundColor: "white",
  color: "var(--app-text)",
  textAlign: "center",
  width: "120px",
  margin: "0 auto",
};

const goodNodeStyle: React.CSSProperties = {
  padding: "10px",
  border: "2px solid var(--app-primary)",
  borderRadius: "8px",
  backgroundColor: "var(--app-primary-soft)",
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
