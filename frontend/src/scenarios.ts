import type { Scenario } from './types';

// Public labels only. Interview and scoring requirements live on the server.
export const SCENARIOS: Scenario[] = [
  { id: 'internal_tool', title: '社内勤怠管理システム', description: '社員が出退勤を記録するためのシステム。' },
  { id: 'sns_app', title: '画像投稿SNS (Twitter Clone)', description: 'ユーザーが写真を投稿し、タイムラインで見ることができるアプリ。' },
  { id: 'custom', title: 'カスタム設計（フリーテーマ）', description: 'テーマを決め、条件をおまかせするか、自分で仕様を整理して設計します。', isCustom: true, difficulty: 'medium', customMode: 'guided', scenarioFamily: 'business' },
];
