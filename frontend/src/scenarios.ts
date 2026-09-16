import type { Scenario } from './types';

const fixedProfiles = {
  internal_tool: [
    { profileId: 'attendance-office', description: '50人の会社で、専任IT担当なしでも無理なく運用する勤怠システム。' },
    { profileId: 'attendance-shift', description: '24時間動く工場で、交代時の一斉打刻を受け付ける勤怠システム。' },
    { profileId: 'attendance-field', description: '電波が切れる訪問先でも仮保存し、あとで同期する勤怠システム。' },
  ],
  sns_app: [
    { profileId: 'sns-private-community', description: '招待した会員だけで、活動写真を安全に共有するSNS。' },
    { profileId: 'sns-photo-discovery', description: '世界中の100万人が、写真を待たずに閲覧できるSNS。' },
    { profileId: 'sns-live-event', description: 'イベント中の写真とコメントを、混雑時もすぐに届けるSNS。' },
  ],
} as const;

export const PROFILE_LABELS: Record<string, string> = {
  'attendance-office': '小規模オフィス',
  'attendance-shift': '24時間の交代勤務',
  'attendance-field': '通信が切れる訪問先',
  'sns-private-community': '会員限定の写真共有',
  'sns-photo-discovery': '世界向けの写真閲覧',
  'sns-live-event': 'イベント速報',
};

// Public labels only. Interview and scoring requirements live on the server.
export const SCENARIOS: Scenario[] = [
  { id: 'internal_tool', title: '社内勤怠管理システム', description: '社員が出退勤を記録するためのシステム。' },
  { id: 'sns_app', title: '画像投稿SNS (Twitter Clone)', description: 'ユーザーが写真を投稿し、タイムラインで見ることができるアプリ。' },
  { id: 'custom', title: 'カスタム設計（フリーテーマ）', description: 'テーマを決め、条件をおまかせするか、自分で仕様を整理して設計します。', isCustom: true, difficulty: 'medium', customMode: 'guided', scenarioFamily: 'business' },
];

export function startFixedScenario(scenario: Scenario, selection?: number): Scenario {
  const profiles = fixedProfiles[scenario.id as keyof typeof fixedProfiles];
  if (!profiles) return scenario;
  const index = selection ?? crypto.getRandomValues(new Uint32Array(1))[0] % profiles.length;
  const profile = profiles[index % profiles.length];
  return {
    ...scenario,
    description: profile.description,
    partnerRole: scenario.partnerRole ?? 'ceo',
    profileId: profile.profileId,
    acceptedNegotiationIds: [],
    specificationVersion: 1,
  };
}
