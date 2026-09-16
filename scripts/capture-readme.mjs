import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '../frontend/node_modules/playwright/index.mjs';

const baseUrl = process.env.CAPTURE_BASE_URL ?? 'http://127.0.0.1:4173';
const output = resolve('docs/images/readme');

const chatHistory = [
  { role: 'user', content: '交代時間には、どのくらいアクセスが集中しますか？' },
  { role: 'model', content: '約300人が交代時刻の前後5分に打刻します。ピーク時でも打刻結果を3秒以内に返してください。' },
  { role: 'user', content: 'システムが止まった場合、どの程度まで許容できますか？' },
  { role: 'model', content: '24時間使うため、1台の障害では止めず、月間停止は合計30分以内を目標にします。打刻記録は失わないでください。' },
];
const project = {
  schemaVersion: 4, version: '1.0', timestamp: '2026-09-16T00:00:00.000Z', projectId: 'readme-capture',
  scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '24時間動く工場で、交代時の一斉打刻を受け付ける勤怠システム。', partnerRole: 'ceo', profileId: 'attendance-shift', acceptedNegotiationIds: [], specificationVersion: 1 },
  memo: '交代時間の集中と、停止時にも打刻を失わない構成を優先する。', chatHistory,
  interviewEvidence: [
    { conditionId: 'traffic', label: '利用量と集中する時間', question: chatHistory[0].content, answer: chatHistory[1].content, questionMessageIndex: 0, answerMessageIndex: 1 },
    { conditionId: 'availability', label: '停止できる時間', question: chatHistory[2].content, answer: chatHistory[3].content, questionMessageIndex: 2, answerMessageIndex: 3 },
  ],
  requirementRevisions: [], evaluation: null,
  diagram: {
    nodes: [
      { id: 'browser', type: 'custom', position: { x: 360, y: 40 }, data: { label: '打刻画面', originalType: 'Web Browser', description: '社員が出退勤を入力する' } },
      { id: 'lb', type: 'custom', position: { x: 360, y: 210 }, data: { label: '入口の振り分け', originalType: 'Load Balancer', description: '稼働中の処理先へ要求を分ける' } },
      { id: 'app-a', type: 'custom', position: { x: 180, y: 390 }, data: { label: '勤怠API A', originalType: 'App Server', description: '打刻を検証して保存する', design: { replicas: 2, redundancy: '別の処理先へ切り替える', requirement: '交代時の集中でも3秒以内に応答する', evidence: '2台へ振り分け、片方の停止時も処理を続ける' } } },
      { id: 'app-b', type: 'custom', position: { x: 540, y: 390 }, data: { label: '勤怠API B', originalType: 'App Server', description: '打刻を検証して保存する' } },
      { id: 'db', type: 'custom', position: { x: 360, y: 580 }, data: { label: '勤怠DB', originalType: 'RDBMS (SQL)', description: '打刻と訂正履歴を保存する', design: { backup: '日次バックアップ', recovery: '復元手順は要確認', requirement: '打刻記録を失わない', evidence: 'アプリとは別の永続DBへ保存する' } } },
    ],
    edges: [
      { id: 'browser-lb', source: 'browser', target: 'lb', data: { payload: '打刻要求', protocol: 'HTTPS', mode: 'sync' } },
      { id: 'lb-app-a', source: 'lb', target: 'app-a', data: { payload: '打刻要求', mode: 'sync' } },
      { id: 'lb-app-b', source: 'lb', target: 'app-b', data: { payload: '打刻要求', mode: 'sync' } },
      { id: 'app-a-db', source: 'app-a', target: 'db', data: { payload: '打刻記録', mode: 'sync', retry: '失敗時に再試行' } },
      { id: 'app-b-db', source: 'app-b', target: 'db', data: { payload: '打刻記録', mode: 'sync', retry: '失敗時に再試行' } },
    ],
  },
};

const evaluation = {
  totalScore: 72,
  details: { availability: 68, scalability: 78, security: 64, maintainability: 74, costEfficiency: 70, feasibility: 76 },
  weights: { availability: 75, scalability: 15, security: 0, maintainability: 10, costEfficiency: 0, feasibility: 0 },
  feedback: '確認した根拠: [打刻画面](#node=browser)から振り分けを経て2つの処理先へ届き、[勤怠DB](#node=db)へ保存する経路があります。\n\n重大な不足: DBが停止した場合の保存先と復旧方法が決まっていないため、打刻を失わない条件への備えが不足しています。\n\n未確認事項: 交代時の300人を3秒以内で処理できるか、負荷試験の結果はまだありません。',
  improvement: '1. **DB停止時の方針を決める**\n   待機系への切り替えと、復元できる時点を記録しましょう。\n2. **ピーク条件を試す**\n   300人が5分に集中する条件で、応答時間とDBの処理量を測りましょう。',
  interview: { confirmed: 2, total: 4, confirmedConditions: [{ id: 'traffic', label: '利用量と集中する時間' }, { id: 'availability', label: '停止できる時間' }], missingConditions: [{ id: 'recovery', label: '復旧とデータ損失' }, { id: 'budget', label: '予算' }] },
};

async function shot(page, name) {
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
}
async function importProject(page) {
  await page.goto(baseUrl);
  await page.locator('input[type=file]').setInputFiles({ name: 'readme-capture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/api/evaluate')) return route.fulfill({ json: evaluation });
  if (url.hostname === new URL(baseUrl).hostname) return route.continue();
  return route.abort();
});

try {
  await page.goto(baseUrl); await page.evaluate(() => localStorage.clear()); await page.reload(); await shot(page, '01-home');
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click(); await page.getByRole('heading', { name: '学習マップ', exact: true }).waitFor(); await shot(page, '02-learning-map');
  await page.getByRole('button', { name: 'Web Browserの学習を始める' }).click();
  const controls = page.locator('.learning-accessible-controls'); await controls.locator('summary').click();
  await page.getByRole('combobox', { name: '接続元', exact: true }).selectOption('browser-1'); await page.getByRole('combobox', { name: '接続先', exact: true }).selectOption('responder'); await page.getByRole('button', { name: '接続する', exact: true }).click(); await controls.locator('summary').click();
  await page.getByRole('button', { name: '会場を調べる', exact: true }).click(); await page.locator('.learning-canvas').scrollIntoViewIfNeeded(); await shot(page, '03-learning-stage');
  await importProject(page); await page.getByText('確認できた条件 2件', { exact: true }).waitFor(); await shot(page, '04-interview');
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click(); await page.locator('.react-flow').waitFor(); await page.waitForTimeout(300); await shot(page, '05-design');
  await page.getByRole('button', { name: '評価結果', exact: true }).click(); await page.getByRole('button', { name: '現在の設計を評価する', exact: true }).click(); await page.getByRole('region', { name: '評価のスコア' }).waitFor(); await page.locator('.evaluation-shell').evaluate(element => element.scrollIntoView({ block: 'start' })); await shot(page, '06-evaluation');
} finally { await browser.close(); }

console.log(`Captured README images in ${output}`);
