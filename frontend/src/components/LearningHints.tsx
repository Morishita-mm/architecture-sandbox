import { useState } from 'react';
import type { IconType } from 'react-icons';
import { BiBulb, BiMessageRoundedDetail, BiBookOpen, BiTimeFive, BiNetworkChart, BiRevision } from 'react-icons/bi';

export type LearningArea = 'start' | 'questions' | 'diagram' | 'reflection';

interface Hint {
  title: string;
  perspective: string;
  reason: string;
  prompt: string;
}

const areas: { id: LearningArea; label: string; icon: IconType; title: string; description: string; hints: Hint[] }[] = [
  { id: 'start', label: '学ぶこと', icon: BiBookOpen, title: 'つなぎ方に、理由を持とう', description: '', hints: [] },
  {
    id: 'questions', label: '聞くこと', icon: BiMessageRoundedDetail, title: 'テーマに合う観点を選ぶ',
    description: 'テーマに関係しそうな観点を一つ選んでみましょう。具体的な条件は、題材の説明や依頼者との会話で確かめます。',
    hints: [
      {
        title: '誰が、何をしたい？',
        perspective: 'この仕組みを使う人と、その人ができるようになりたいことを一つ思い浮かべます。',
        reason: '使う人と目的がわかると、必要な画面・処理・情報を考えやすくなります。利用する人と管理する人で、できる操作が違う場合もあります。',
        prompt: '「このテーマの利用者」は、何ができれば目的を達成できますか？ そのとき、誰がどの操作をしますか？',
      },
      {
        title: 'どんな情報を扱う？',
        perspective: '入力する情報、あとで使う情報、他の人に見せる情報を考えます。',
        reason: '残す情報によって保存先が変わります。誰が見たり変更したりできるかによって、情報を守る仕組みも変わります。',
        prompt: '「このテーマで扱う情報」は、あとでも必要ですか？ 誰が見たり変更したりでき、なくなると何に困りますか？',
      },
      {
        title: '待つ・止まると、何に困る？',
        perspective: '利用が重なる時間や、処理を待つ場面を思い浮かべます。仕組みが使えない間の影響も考えます。',
        reason: 'すぐ返す必要がある処理と、あとでよい処理ではつなぎ方が変わります。停止による影響が大きければ、別の処理先や復旧の準備が必要になります。',
        prompt: '「このテーマの大切な操作」は、どのくらい待てますか？ 使えなくなったら誰にどんな影響があり、代わりの方法はありますか？',
      },
      {
        title: '続けて使うための条件は？',
        perspective: '使える費用、運用を担当する人、すでに使っている仕組みを確かめます。',
        reason: '部品を増やすと費用や管理することも増えます。必要な品質と、使い続けられる費用・手間を一緒に考えます。',
        prompt: '「この仕組み」を維持する費用と、日々の管理・故障対応は誰が担いますか？ 合わせる必要のある既存の仕組みや決まりはありますか？',
      },
    ],
  },
  {
    id: 'diagram', label: '図にする', icon: BiNetworkChart, title: '一つの操作から、部品と線を考える',
    description: '全部を一度に描く必要はありません。気になる操作を一つ選び、必要な役割から考えてみましょう。',
    hints: [
      {
        title: 'どの部品を選ぶ？',
        perspective: '「画面を表示する」「ルールに沿って処理する」「情報を残す」など、やりたいことを先に言葉にします。',
        reason: '役割が決まると、部品を選ぶ理由ができます。一つの部品に複数の役割をまとめたり、必要に応じて分けたりする設計もあります。',
        prompt: '「この操作」を実現するには、何をする担当が必要ですか？ 部品一覧でやりたいことを検索し、「？」から役割と接続例を比べてみましょう。',
      },
      {
        title: 'どうつなぐ？',
        perspective: '利用者の操作で、どこからどこへ、何を送るかをたどります。たとえば処理の依頼、保存する情報、あとで行う仕事などです。',
        reason: '線に意味を持たせると、情報の行き先や処理の担当がわかります。枠による配置と、矢印による受け渡しも区別できます。',
        prompt: 'この線は「何」を「誰から誰へ」渡しますか？ 相手の返事を待つ必要はありますか？ 考えた内容は部品の詳細に書き残せます。',
      },
      {
        title: 'わからない条件があるときは？',
        perspective: 'わかっていることと、まだ確かめていないことを分けます。仮に決めたことは、そのまま仮定と書きます。',
        reason: '未確認の条件が見えると、依頼者に聞き直したり、条件が変わったときに設計を見直したりできます。',
        prompt: '「ここは仮にこう置いた」「ここは未確認」と書ける場所はありますか？ 要件メモの「要件と設計を記録」で、条件と対応方針をまとめられます。設計に関わる判断は部品の詳細にも記述しましょう。',
      },
    ],
  },
  {
    id: 'reflection', label: '振り返る', icon: BiRevision, title: 'この構成にした理由を、説明してみる',
    description: '途中の図でも振り返れます。答えがわからないところは、次に確かめることとして残しましょう。',
    hints: [
      {
        title: '一つの部品が止まったら？',
        perspective: '図の部品を一つ選び、それが動かないと仮定して、利用者の操作をたどります。',
        reason: 'どこまで使えなくなるかを考えると、構成が利用者に与える影響や、復旧に必要な準備が見えてきます。',
        prompt: 'この部品が止まると、どの操作ができなくなりますか？ 別の方法で続けるのか、復旧を待つのか、その理由を説明できますか？',
      },
      {
        title: '別の構成なら、何が変わる？',
        perspective: '部品をまとめる・分ける、処理先を増やすなど、一つだけ変えた場合を考えます。',
        reason: '止まりにくさや速さを求めると、費用や管理の手間が増える場合があります。何を優先したかが、設計の理由になります。',
        prompt: '変えると誰にとって何がよくなり、何の負担が増えそうですか？ このテーマでは、どちらを優先したいですか？',
      },
      {
        title: 'AIの評価をどう使う？',
        perspective: '指摘が自分の図のどこを見ているか、確かめた条件と合っているかを見直します。',
        reason: 'AIは、書いていない設定を推測したり、条件を見落としたりすることがあります。点数だけでは判断できません。',
        prompt: '指摘の根拠は図や部品の説明にありますか？ 納得できる点と、確認が必要な点を分けてみましょう。現在の採点には、会話と要件メモは直接渡していません。',
      },
    ],
  },
];

// Local teaching material: no scenario answers, network requests, or project writes.
export function LearningHints({ initialArea = 'start' }: { initialArea?: LearningArea }) {
  const [activeArea, setActiveArea] = useState(initialArea);
  const area = areas.find(item => item.id === activeArea)!;

  return <section className="learning-hints">
    <h3 tabIndex={-1}>設計のヒント</h3>
    <p className="learning-hints-intro">どのテーマでも使える、考えるための観点です。必要なところだけ開いてみましょう。</p>
    <div className="learning-area-picker" role="group" aria-label="ヒントの種類">
      {areas.map(item => <button key={item.id} aria-pressed={activeArea === item.id} aria-controls="learning-area-content" onClick={() => setActiveArea(item.id)}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span></button>)}
    </div>
    <div key={activeArea} id="learning-area-content" role="region" aria-labelledby="learning-area-title">
      {activeArea === 'start' ? <>
        <div className="learning-goal">
          <span className="learning-goal-label"><BiBulb size={18} aria-hidden="true" />このアプリで目指すこと</span>
          <h4 id="learning-area-title">{area.title}</h4>
          <p className="learning-goal-message">「なぜこの部品を、このつなぎ方で使うのか」を<br className="learning-goal-break" />自分の言葉で説明できるようになる。</p>
          <p className="learning-goal-context">アーキテクチャは、システム全体の部品とつなぎ方です。構成によって変わる、止まりにくさ・情報の守り方・費用を、自由に部品を置いて考えます。</p>
        </div>
        <section className="learning-checkpoint" aria-labelledby="learning-checkpoint-title">
          <h5 id="learning-checkpoint-title"><BiMessageRoundedDetail size={20} aria-hidden="true" />一区切りの目安</h5>
          <p>まずは、この3つを説明してみましょう。</p>
          <ul>
            <li><strong>部品の役割</strong><span>何を担当している？</span></li>
            <li><strong>線で渡すもの</strong><span>どこへ、何を送る？</span></li>
            <li><strong>つなぎ方の理由</strong><span>なぜ、この構成にした？</span></li>
          </ul>
          <p className="learning-checkpoint-note">未確認のことは、次に確かめることとして残します。</p>
        </section>
        <div className="learning-supplement" role="group" aria-label="始めるときの補足">
          <div>
            <h5><BiBookOpen size={17} aria-hidden="true" />始める前に</h5>
            <p>プログラミングの知識は必要ありません。普段使うサイトやアプリの操作を思い浮かべましょう。部品の役割は「？」から調べられます。</p>
          </div>
          <div>
            <h5><BiTimeFive size={17} aria-hidden="true" />練習時間の提案</h5>
            <p>まずは10〜15分で、一つの操作に必要な部品と線を考えてみましょう。いつでも中断・再開できます。</p>
          </div>
        </div>
        <p className="learning-hints-note">決まった順番や、すべての項目を終える必要はありません。ガイドを閉じて、好きなところから設計できます。</p>
      </> : <>
        <h4 id="learning-area-title">{area.title}</h4>
        <p>{area.description}</p>
        <div className="learning-hint-list">
          {area.hints.map(hint => <details key={hint.title} className="learning-hint">
            <summary>{hint.title}</summary>
            <div className="learning-hint-body">
              <p>{hint.perspective}</p>
              <details className="learning-hint-depth">
                <summary>設計にどう関わる？</summary>
                <p>{hint.reason}</p>
                <details className="learning-hint-depth">
                  <summary>考える問いを見る</summary>
                  <p className="learning-hint-prompt">{hint.prompt}</p>
                </details>
              </details>
            </div>
          </details>)}
        </div>
      </>}
    </div>
  </section>;
}
