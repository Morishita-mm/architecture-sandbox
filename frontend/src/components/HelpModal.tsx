import React, { useState, useEffect, useRef } from "react";
import { LearningHints, type LearningArea } from './LearningHints';
import { componentStages, stageIds } from '../constants/componentStages';
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
  BiBookOpen,
} from "react-icons/bi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: 'learning' | 'tutorial';
  initialHintArea?: LearningArea;
}

type TabKey = 'tutorial' | 'learning' | "flow" | "canvas" | "ai" | "evaluation" | "share";

export const HelpModal: React.FC<Props> = ({ isOpen, onClose, initialTopic, initialHintArea }) => {
  const [activeTab, setActiveTab] = useState<TabKey | null>(initialTopic ?? null);
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
    { key: 'tutorial', label: 'チュートリアルの進め方', description: '8ステージの体験・練習から卒業課題へ', icon: <BiBookOpen /> },
    { key: 'learning', label: '設計のヒント', description: '学ぶこと・聞くこと・図にする・振り返る', icon: <BiBulb /> },
    { key: "flow", label: "基本的な流れ", description: "ヒアリングから設計・評価までの進め方", icon: <BiListUl /> },
    { key: "canvas", label: "キャンバス操作", description: "部品の配置・接続・グループ化", icon: <BiMouse /> },
    { key: "ai", label: "AI活用のコツ", description: "要件を聞き出し、設計意図を伝える", icon: <BiBot /> },
    { key: "evaluation", label: "評価と改善", description: "スコアとフィードバックの読み方", icon: <BiBarChart /> },
    { key: "share", label: "共有と挑戦", description: "保存・共有とチャレンジの始め方", icon: <BiShareAlt /> },
  ];

  const topicIndex = tabs.findIndex(tab => tab.key === activeTab);

  return (
    <dialog ref={dialogRef} className="help-dialog" style={modalStyle} aria-labelledby="guide-title" onCancel={event => { event.preventDefault(); closeGuide(); }} onClick={event => { if (event.target === event.currentTarget) closeGuide(); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href]')).filter(element => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
      }}
      onKeyUp={event => event.stopPropagation()}
    >
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
              <h3>何を確認しますか？</h3>
              <p>設計の考え方や操作を、必要なところから確認できます。</p>
              <nav aria-label="ガイドの目次">
                {tabs.map(tab => <button key={tab.key} ref={element => { topicButtons.current[tab.key] = element; }} onClick={() => setActiveTab(tab.key)}>
                  <span className="help-topic-icon">{tab.icon}</span>
                  <span><strong>{tab.label}</strong><small>{tab.description}</small></span>
                  <BiRightArrowAlt size={20} />
                </button>)}
              </nav>
            </div>
          ) : activeTab !== 'learning' && <div className="help-article-nav"><button className="ui-button" onClick={showContents}><BiArrowBack size={16} />目次に戻る</button><span>{topicIndex + 1} / {tabs.length}</span></div>}
            {activeTab === 'learning' && <LearningHints initialArea={initialHintArea} />}
            {activeTab === 'tutorial' && <article className="help-tutorial">
              <h3 tabIndex={-1} style={contentTitleStyle}>チュートリアルの進め方</h3>
              <p>ホームの「部品の役割から学ぶ」から始めます。1種類ずつ図につなぎ、動きを試して、基本8種類の役割と使い方を身につけるコースです。</p>
              <div className="help-tutorial-start"><BiBookOpen aria-hidden="true" /><div><strong>体験 → 練習問題 → 次のステージ</strong><p>まずはWeb Browser。「この体験で確かめること」のチェックを埋めていきましょう。</p></div></div>
              <h4>1つのステージで行うこと</h4>
              <ol className="help-tutorial-steps">
                <li><strong>部品を置き、丸と丸をつなぐ</strong><p>使えるのは、そのステージまでに登場した部品です。追加ボタンやドラッグで置き、下の丸から次の部品の上の丸へ線を引きます。「ドラッグ以外の操作」では選択欄でも接続できます。</p></li>
                <li><strong>操作して、要求と返事を図で追う</strong><p>最初の2ステージは、図のWeb Browserにある「調べる」ボタンを押します。要求が相手に届くと、返事が戻ってブラウザに自動で表示されます。文章の入力や、表示のための追加操作はありません。青い矢印は要求を送る方向、緑の矢印は返事が戻る方向です。線上の移動と、今どの部品が何をしているかを見比べます。つながない場合や、部品を停止した場合との違いも試しましょう。</p><p>DB以降は、保存・読み出し、停止・再開、負荷の変更など、その部品の役割を確かめる操作を使います。「一時停止」「ひとつ前の動き」「次の動き」でじっくり確認できます。再生を見直しても送信や処理は追加されません。端末で動きを減らす設定をしている場合は、自動で進まず一段ずつ確認します。</p></li>
                <li><strong>確認問題に答えて、練習へ進む</strong><p>体験では選ぶと正解・不正解が表示されます。正解すると理由も確認できます。実験の条件もすべて満たすと「練習問題へ」が現れます。</p></li>
                <li><strong>別の条件で使い、ステージをクリアする</strong><p>練習では「この練習のクリア条件」を確かめ、自分で図を作ります。操作と回答を終えたら「練習の結果を確認する」を押してください。正解でも実験の条件が残っていればクリアにはなりません。やり直しは何度でもできます。</p></li>
              </ol>
              <details className="learning-hint-depth"><summary>8ステージで学ぶ部品</summary><ol className="help-tutorial-components">{stageIds.map(id => <li key={id}><strong>{componentStages[id].component}</strong><span>{componentStages[id].role}</span></li>)}</ol><p>Load Balancerの前には、必要な処理量を見積もる体験もあります。全32種類を扱うコースではありません。</p></details>
              <h4>学習マップと卒業課題</h4><p>各カードに体験・練習・クリアの状態を表示します。前のステージをクリアすると次が開き、クリア済みのステージはいつでも復習できます。8ステージを終えたら卒業課題へ。2つの構成を試して条件を満たす図を選び、理由と残る課題を一言ずつ書いて修了します。</p>
              <h4>途中からの再開・やり直し</h4><p>図・実験・回答・クリア履歴は、使っているブラウザに自動保存します。次回ホームで「部品の役割から学ぶ」を選ぶと続きに戻ります。「体験をやり直す」「練習をやり直す」はそのページだけを最初に戻し、他のステージとクリア履歴は残します。</p><p>学習記録は設計プロジェクトのJSON保存には含まれません。別のブラウザには引き継がれず、ブラウザのデータを削除すると消えます。</p>
              <div className="help-tutorial-next"><strong>好きなタイミングで自由設計へ</strong><p>「設計課題に進む」は最初から使えます。コース修了後は、卒業課題の構成を引き継いで自由設計を始めることもできます。</p></div>
            </article>}
            {activeTab === "flow" && (
              <div style={animateInStyle}>
                <h3 tabIndex={-1} style={contentTitleStyle}>設計の基本的なワークフロー</h3>
                <p>部品の役割から試したい場合は、ホームの「部品の役割から学ぶ」で基本8種類を体験・練習できます。進め方は目次の「チュートリアルの進め方」で確認できます。</p>
                <p>会話・設計・詳細の記述・評価を、自由に行き来できます。部品を置いて試してから、気になった条件を聞く進め方でも構いません。</p>

                <details className="learning-hint-depth">
                  <summary>自分のテーマで設計する場合</summary>
                  <p><strong>「条件をおまかせ」</strong>では、社内業務・コンテンツ・リアルタイム・取引の型と複雑さを選びます。開始時にあらかじめ用意した条件を固定し、保存・再開・評価でも同じ条件を使います。具体的な規模、集中する時間、保存、故障時の条件などはAIへの質問で確認します。</p>
                  <p><strong>「自分で仕様を決める」</strong>では、入力した説明を仕様の出発点にします。隠れた正解はなく、AIは未記載の条件を決定事項として作らず、追加で決める観点を質問します。この場合、未記載の内容は聞き漏らしではなく「仕様の未定義」です。</p>
                </details>

                <div style={stepContainerStyle}>
                  <StepItem number={1} title="要件定義 (Chat)">
                    固定課題と「条件をおまかせ」ではAIクライアントから条件を聞きます。回答で具体的に明らかになった条件は画面下へ記録され、評価で未確認の条件と比較できます。「自分で仕様を決める」では、AIと未定義の観点を整理します。
                    チャットはEnterで送信、Shift + Enterで改行できます。
                  </StepItem>
                  <StepItem number={2} title="アーキテクチャ設計 (Canvas)">
                    必要なコンポーネントを配置し、システム構成図を作成します。
                  </StepItem>
                  <StepItem number={3} title="詳細設定 (Properties)">
                    各コンポーネントに具体的な役割や技術スタックを記述します。
                  </StepItem>
                  <StepItem number={4} title="評価・改善 (Evaluate)">
                    聞き取り到達度とアーキテクチャの設計評価を別々に確認し、フィードバックを元に修正します。条件を聞けたことだけで設計点は上がりません。
                  </StepItem>
                </div>

                <details className="learning-hint-depth">
                  <summary>要件と設計理由を一緒に残す</summary>
                  <p>要件メモの「要件と設計を記録」から、条件・確認状態・根拠・関連部品・対応方針を一組にして残せます。設計を変えたときは、変更前後と次に確かめることも記録できます。</p>
                  <p>確認済みかどうかは自分で判断します。追加した内容は普通のメモとして編集・保存できます。部品名は記録したときの名前です。採点したい設計理由は、部品の詳細にも反映してください。「メモに追加」する前の入力は、同じ作業を開いている間だけ保持します。</p>
                </details>

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
                  保存したファイルは、トップ画面の「既存プロジェクトを読み込む」から再開できます。送信済みの会話・要件メモ・構成図はこのブラウザにも自動保存され、トップ画面の「このブラウザの作業を再開」から開けます。不要な保存データは同じ一覧から削除できます。削除確認欄の「JSONファイルを保存」から、再開せずにファイルへ書き出すこともできます。共有端末では他の利用者も開けます。ブラウザのデータ削除に備えてJSONファイルも残しましょう。未送信の質問とUndoの履歴は再開時に復元されません。
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
                        左の一覧で部品を選択して追加、またはドラッグ＆ドロップ。カード内の「？」で説明をポップアップ表示します。開いたまま全32種類から選ぶか、「前の部品」「次の部品」で説明を切り替えられます。「？」を押しても部品は追加されません。部品の一覧は日本語の目的でも検索できます。
                      </td>
                    </tr>
                    <tr>
                      <td style={tdIconStyle}>
                        <BiRightArrowAlt size={20} />
                      </td>
                      <td style={tdLabelStyle}>接続</td>
                      <td>
                        部品の下側から相手の上側へ接続します。部品へTabで移動してEnterを押すと設定を開けます。「この部品からの接続先」で相手を選び、「接続を追加」を押すと、キーボードやタッチでも接続できます。矢印は接続の向きを示します。何を送る接続かは部品の詳細へ記述してください。
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
                        グループを削除すると、内部のコンポーネントと接続線も削除されます。「元に戻す」「やり直す」で直近50操作を戻せます。構成図にフォーカスがあるときはCtrl / ⌘ + Zでも戻せます。文字入力中は通常の文字編集が優先されます。
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
                  AIへ渡すのはシナリオと構成図です。会話と要件メモは採点へ直接渡しません。確認した条件と判断理由を部品の詳細に反映しましょう。コンポーネントの「種類」に加え、あなたが入力した
                  <strong>「名前」</strong>や<strong>「詳細メモ」</strong>
                  も読み取ります。説明の例やヒントは、あなたが設計に書き込むまで採点には使われません。
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
                    説明が足りない例 <BiXCircle color="var(--app-danger)" />
                  </div>
                  <div style={badNodeStyle}>Web Server</div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--app-muted)",
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
                    判断理由が伝わる例 <BiCheckCircle color="var(--app-success)" />
                  </div>
                  <div style={goodNodeStyle}>
                    <div style={{ fontWeight: "bold" }}>画像処理サーバー</div>
                    <div style={{ fontSize: "10px", marginTop: "4px" }}>
                      受付後に別の処理で画像を加工
                      <br />
                      失敗時に再実行できるよう元画像を保存
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--app-muted)",
                      marginTop: "5px",
                    }}
                  >
                    （技術名の多さより、要件に対して何を選び、失敗時にどうするかを説明しましょう。）
                  </p>
                </div>
              </div>
            )}

            {activeTab === "evaluation" && (
              <div style={animateInStyle}>
                <h3 tabIndex={-1} style={contentTitleStyle}>評価レポートの見方</h3>
                <p>「設計を確かめる」ではAI通信を使わず、記録の確認・停止を仮定した接続の確認・変更前後の比較ができます。図の道が残ることと、実際にサービスが動くことは別に確認します。比較の基準は作業中だけ保持し、再読み込みで消えるので、必要な結果はメモに残してください。</p>
                <p>部品の設定で、実装方式・管理する人・台数・復元方法・条件と根拠を記録できます。接続の設定では渡すもの・同期／非同期・失敗時の対応を記録します。SubnetのVPCとAZ、Security Groupの関連付けは、図の囲みとは別の設定です。</p>
                <p>部品に書いた条件と根拠はAIへ渡しますが、サーバーの正式条件は上書きしません。会話と自由メモは自動では採点に渡りません。根拠のリンクから部品に戻り、未確認と欠陥を区別して読みましょう。</p>
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
                    100点満点の参考値です。点数だけで要件を満たしたと判断せず、設計理由と未確認事項を説明できることを目指しましょう。
                  </li>
                  <li>
                    <strong>レーダーチャート:</strong>{" "}
                    「可用性」「拡張性」「コスト」などのバランスを可視化します。
                  </li>
                  <li>
                    <strong>フィードバック:</strong>{" "}
                    良い点と改善点を確認します。AIが未記載の設定を推測していないか、要件を見落としていないかも見直しましょう。設計変更後は「変更前の評価」と表示し、再評価するまで点数を共有できません。
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
                    発行されたURLには、公開されるシナリオ情報が含まれます。<strong>会話・要件メモ・構成図は含まれません。</strong>
                    <br />
                    このURLを受け取った人は、<strong>全く同じ条件・制約</strong>
                    で設計に挑戦できます。
                  </StepItem>
                  <StepItem number={3} title="設計を見せ合う">
                    新しい部品・接続設定を含むファイルはv3として保存し、旧アプリでは読めません。旧ファイルは引き続き読み込めます。「プロジェクト保存」でダウンロードしたJSONファイルを交換すれば、設計図を手元で再現・再評価できます。変更前・対応未確認の評価は書き出しに含めません。読み込んだ評価は対応を未確認として表示するため、再評価してください。ファイルには会話やメモも含むので、共有前に内容を確認しましょう。
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
                  部品を置いて試したり、クライアント（AI）に気になる条件を聞いたり、自由に進められます。
                </div>
              </div>
            )}
        </div>

        {/* フッター */}
        <div className="help-footer" style={footerStyle}>
          {activeTab === 'learning' && <div className="help-page-controls"><button className="ui-button" onClick={showContents}><BiArrowBack size={16} />目次に戻る</button></div>}
          {activeTab !== null && activeTab !== 'learning' && <div className="help-page-controls">
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
  backgroundColor: "var(--app-surface)",
  width: "900px",
  height: "var(--help-dialog-height, 660px)",
  maxWidth: "95vw",
  maxHeight: "calc(100dvh - 32px)",
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
  backgroundColor: "var(--app-surface)",
};

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: "var(--help-content-padding, 24px 32px)",
  overflowY: "auto",
  backgroundColor: "var(--app-surface)",
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
  color: "var(--app-muted)",
  padding: "5px",
  display: "flex",
  transition: "color 0.2s",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 30px",
  backgroundColor: "var(--app-action)",
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
  backgroundColor: "var(--app-warning-soft)",
  border: "1px solid var(--app-border)",
  borderRadius: "6px",
  padding: "15px",
  color: "var(--app-warning)",
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
  backgroundColor: "var(--app-surface)",
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
  color: "var(--app-primary)",
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
