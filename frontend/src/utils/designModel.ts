import type { NodeDesign, ConnectionDesign } from '../types';

export const responsibilities = { application: 'アプリの処理', authentication: '本人確認・認証', api: '外部APIとの連携', notification: 'メールなどの通知', payment: '決済' };
export const nodeDesignTextFields = ['implementation', 'redundancy', 'backup', 'recovery', 'requirement', 'evidence', 'rules'] as const;
export const placementTypes = { vpcId: 'VPC (Network)', zoneId: 'Availability Zone', subnetId: 'Subnet' } as const;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('設計の設定形式が不正です。');
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number) {
  if (typeof value !== 'string' || [...value].length > max) throw new Error('設計の設定が長すぎるか形式が不正です。');
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new Error('設計の選択値が不正です。');
  return value as T;
}
// Enumerate fields; arbitrary HTML, CSS and executable properties never enter the editor.
export function normalizeNodeDesign(value: unknown): NodeDesign {
  const v = object(value); const d: NodeDesign = {};
  for (const key of nodeDesignTextFields) if (v[key] !== undefined) d[key] = string(v[key], 300);
  for (const key of Object.keys(placementTypes) as (keyof typeof placementTypes)[]) {
    if (v[key] !== undefined) d[key] = string(v[key], 100);
  }
  if (v.responsibility !== undefined) d.responsibility = choice(v.responsibility, Object.keys(responsibilities) as (keyof typeof responsibilities)[]);
  if (v.scope !== undefined) d.scope = choice(v.scope, ['internal', 'external'] as const);
  if (v.replicas !== undefined) {
    if (typeof v.replicas !== 'number' || !Number.isInteger(v.replicas) || v.replicas < 1 || v.replicas > 1000) throw new Error('台数は1〜1000の整数で指定してください。');
    d.replicas = v.replicas;
  }
  if (v.securityGroupIds !== undefined) {
    if (!Array.isArray(v.securityGroupIds) || v.securityGroupIds.length > 20) throw new Error('Security Groupの指定が不正です。');
    d.securityGroupIds = [...new Set(v.securityGroupIds.map(id => string(id, 100)))];
  }
  return d;
}
export function normalizeConnectionDesign(value: unknown): ConnectionDesign {
  const v = object(value); const d: ConnectionDesign = {};
  for (const key of ['payload', 'protocol', 'retry'] as const) if (v[key] !== undefined) d[key] = string(v[key], 200);
  if (v.mode !== undefined) d.mode = choice(v.mode, ['sync', 'async'] as const);
  return d;
}

export function nodeDesignSummary(d: NodeDesign): string {
  const rows: string[] = [];
  if (d.implementation) rows.push(`実装方式: ${d.implementation}`);
  if (d.responsibility) rows.push(`役割: ${responsibilities[d.responsibility]}`);
  if (d.scope) rows.push(`管理範囲: ${d.scope === 'external' ? '外部サービス' : '自分たちで管理'}`);
  if (d.replicas) rows.push(`台数・実行単位数: ${d.replicas}`);
  for (const [key, label] of [['redundancy', '冗長化・切替'], ['backup', 'バックアップ・復元'], ['recovery', '許容停止時間・許容データ損失'], ['requirement', '利用者が記録した条件'], ['evidence', '利用者が入力した根拠（サーバー未検証）'], ['rules', '通信ルール']] as const) if (d[key]) rows.push(`${label}: ${d[key]}`);
  for (const key of Object.keys(placementTypes) as (keyof typeof placementTypes)[]) if (d[key]) rows.push(`${placementTypes[key]}参照ID: ${d[key]}`);
  if (d.securityGroupIds?.length) rows.push(`関連付けるSecurity Group ID: ${[...d.securityGroupIds].sort().join(', ')}`);
  return rows.join('\n');
}
export function connectionSummary(d: ConnectionDesign): string {
  return [d.payload && `渡すもの: ${d.payload}`, d.protocol && `通信方式: ${d.protocol}`, d.mode && `応答: ${d.mode === 'sync' ? '同期（結果を待つ）' : '非同期（後で処理する）'}`, d.retry && `失敗時: ${d.retry}`].filter(Boolean).join(' / ');
}
export function connectionLabel(d: ConnectionDesign): string {
  const label = d.payload || (d.mode === 'sync' ? '同期' : d.mode === 'async' ? '非同期' : '');
  const characters = [...label];
  return characters.length > 24 ? `${characters.slice(0, 24).join('')}…` : label;
}
