import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const node = (id: string, label: string, originalType: string, x: number, y: number) => ({ id, type: 'custom', position: { x, y }, data: { label, originalType, description: '' } });
const project = { schemaVersion: 2, version: '1.0', timestamp: '2026-09-15T00:00:00Z', projectId: 'review-test', scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠' }, memo: '元のメモ', chatHistory: [], evaluation: null, diagram: { nodes: [node('client', '利用者', 'Web Browser', 50, 20), node('app', '受付API', 'App Server', 50, 180), node('db', '勤怠DB', 'RDBMS (SQL)', 50, 360)], edges: [{ id: 'ca', source: 'client', target: 'app' }, { id: 'ad', source: 'app', target: 'db' }] } };
const result = { totalScore: 70, details: { availability: 70, scalability: 70, security: 70, maintainability: 70, costEfficiency: 70, feasibility: 70 }, weights: { availability: 1, scalability: 1, security: 1, maintainability: 1, costEfficiency: 1, feasibility: 1 }, feedback: '## 確認した根拠\n[受付API](#node=app)を確認。[偽の部品](#node=missing)\n[外部](https://evil.example)', improvement: '[勤怠DB](#node=db)の復元を確認しましょう。' };
async function load(page: Page, data: unknown = project) {
  let calls = 0; const bodies: unknown[] = [];
  await page.route('**/*', route => {
    const request = route.request();
    if (request.url().includes('/api/')) { calls++; bodies.push(request.postDataJSON()); return route.fulfill({ json: result }); }
    return new URL(request.url()).hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles({ name: 'design.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  return { calls: () => calls, bodies };
}
async function design(page: Page, mobile = false) {
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
  if (mobile && await page.getByRole('button', { name: 'コンポーネントの表示切り替え' }).getAttribute('aria-expanded') === 'true') await page.getByRole('button', { name: 'コンポーネントの表示切り替え' }).click();
}
async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'プロジェクト保存', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('optional component/edge settings survive v3 export, reload and undo, and reach the existing API', async ({ page }) => {
  const api = await load(page); await design(page);
  await page.locator('.react-flow__node[data-id=app]').click();
  await page.getByText('詳しい設定（任意）', { exact: true }).click();
  await page.getByText('役割と実装方式', { exact: true }).click();
  await page.getByLabel('実装方式・製品', { exact: true }).fill('外部の決済API');
  await page.getByLabel('担う仕事').selectOption('payment');
  await page.getByLabel('管理するのは誰？').selectOption('external');
  await page.getByText('この部品で満たす条件と根拠', { exact: true }).click();
  await page.getByLabel('満たしたい条件').fill('注文を重複させない');
  await page.getByLabel('確認した根拠', { exact: true }).fill('担当者に確認した回答');
  await page.getByText('つながっている接続を編集', { exact: true }).click();
  await page.getByRole('button', { name: '受付API → 勤怠DB', exact: true }).click();
  await expect(page.getByLabel('渡すもの', { exact: true })).toBeFocused();
  await page.getByLabel('渡すもの', { exact: true }).fill('勤怠の記録');
  await page.getByLabel('通信方式', { exact: true }).fill('HTTPS');
  await page.getByLabel('結果を待つ？').selectOption('async');
  await page.getByLabel('失敗したとき').fill('重複防止IDを付けて3回まで再試行');
  await page.getByRole('button', { name: '接続の設定を閉じる' }).click();
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  expect((await exported(page)).diagram.edges.find((e: { id: string }) => e.id === 'ad').data.retry).toBeUndefined();
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  const saved = await exported(page);
  expect(saved.schemaVersion).toBe(3);
  expect(saved.diagram.nodes[1].data.design).toMatchObject({ implementation: '外部の決済API', responsibility: 'payment', scope: 'external', requirement: '注文を重複させない', evidence: '担当者に確認した回答' });
  expect(saved.diagram.edges[1].data).toMatchObject({ payload: '勤怠の記録', protocol: 'HTTPS', mode: 'async', retry: '重複防止IDを付けて3回まで再試行' });
  expect(api.calls()).toBe(0);
  await page.getByRole('button', { name: '設計完了（評価する）' }).click();
  await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
  expect(JSON.stringify(api.bodies[0])).toContain('サーバー未検証');
  expect(JSON.stringify(api.bodies[0])).toContain('重複防止ID');
  expect(Object.keys(api.bodies[0] as object).sort()).toEqual(['edges', 'interviewEvidence', 'nodes', 'scenario']);
  await page.getByRole('button', { name: '受付API', exact: true }).click();
  await expect(page.getByLabel('表示名', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'プロパティを閉じる' }).click();
  await page.getByTitle('シナリオ選択画面に戻る').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'v3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  expect((await exported(page)).diagram).toEqual(saved.diagram);
});

for (const mobile of [false, true]) test.describe(mobile ? 'mobile review' : 'desktop review', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1255, height: 963 }, isMobile: mobile, hasTouch: mobile });
  test('offline checks, failure trace and comparison preserve the graph and can be recorded', async ({ page }) => {
    const api = await load(page); await design(page, mobile);
    const trigger = page.getByRole('button', { name: '設計を確かめる', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '設計を確かめる', exact: true });
    await expect(dialog.getByText('未確認・未記録', { exact: false })).toBeVisible();
    await page.keyboard.press('Delete'); await page.keyboard.press('Control+z');
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await mkdir('../docs/images', { recursive: true });
    await page.screenshot({ path: `../docs/images/design-review-${mobile ? 'mobile' : 'desktop'}.png` });
    await dialog.getByRole('button', { name: '止まったら？', exact: true }).click();
    await dialog.getByLabel('出発する部品').selectOption('client');
    await dialog.getByLabel('止まる部品・配置先').selectOption('app');
    await expect(dialog.getByText('停止前にたどれる部品: 3個 → 停止後: 1個（出発点を含む）')).toBeVisible();
    await expect(dialog.getByText('たどれなくなる部品: 受付API、勤怠DB')).toBeVisible();
    await dialog.getByRole('button', { name: '結果をメモに残す' }).click();
    await expect(dialog.getByRole('status')).toContainText('要件メモに記録');
    await dialog.getByRole('button', { name: '変更を比べる', exact: true }).click();
    await dialog.getByRole('button', { name: '今の設計を比較の基準にする' }).click();
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await page.locator('.react-flow__node[data-id=db]').click();
    await page.getByLabel('役割のメモ（任意）', { exact: true }).fill('復元の手順を検討する');
    await page.getByRole('button', { name: 'プロパティを閉じる' }).click();
    await trigger.click();
    await expect(dialog.getByText('設定の変更: 勤怠DB', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '変更をメモに残す' }).click();
    await page.keyboard.press('Escape');
    const saved = await exported(page);
    expect(saved.memo).toContain('元のメモ'); expect(saved.memo).toContain('【障害時の検討・仮定】'); expect(saved.memo).toContain('【設計の比較】');
    expect(saved.diagram.edges).toEqual(project.diagram.edges); expect(api.calls()).toBe(0);
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    await expect(page.locator('.draft-status')).toHaveAttribute('data-state', 'saved');
    await page.reload(); await page.getByRole('button', { name: /社内勤怠管理システムを再開/ }).click();
    expect((await exported(page)).memo).toBe(saved.memo);
  });
});

test('dangling placement and legacy SG containment stay editable, and findings navigate to exact settings', async ({ page }) => {
  const data = structuredClone(project);
  Object.assign(data.diagram.nodes[1].data, { design: { subnetId: 'deleted' } });
  await load(page, data);
  await page.getByRole('button', { name: '設計を確かめる', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('受付API: 配置先を選び直す', { exact: true }).click();
  await dialog.getByRole('button', { name: '該当箇所を開く' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('表示名', { exact: true })).toHaveValue('受付API');
  await expect(page.getByLabel('表示名', { exact: true })).toBeFocused();
  await page.getByText('詳しい設定（任意）', { exact: true }).click();
  await page.getByText('配置と通信の制限', { exact: true }).click();
  await expect(page.getByLabel('配置するSubnet')).toHaveValue('deleted');
  await page.getByLabel('配置するSubnet').selectOption('');
  await page.getByRole('button', { name: '設計を確かめる', exact: true }).click();
  await expect(dialog.getByText('受付API: 配置先を選び直す', { exact: true })).toHaveCount(0);
});

test('AI node links are allow-listed, stale references disabled, and oversized annotations never send a request', async ({ page }) => {
  const api = await load(page); await design(page);
  await page.getByRole('button', { name: '設計完了（評価する）' }).click();
  await expect(page.getByText('偽の部品（参照先未確認）')).toBeVisible();
  await expect(page.locator('a[href*="evil.example"]')).toHaveCount(0);
  await page.getByRole('button', { name: '受付API', exact: true }).click();
  await expect(page.getByLabel('表示名', { exact: true })).toBeFocused();
  await page.getByLabel('役割のメモ（任意）', { exact: true }).fill('a'.repeat(2000));
  await page.getByText('詳しい設定（任意）', { exact: true }).click();
  await page.getByText('この部品で満たす条件と根拠', { exact: true }).click();
  await page.getByLabel('満たしたい条件').fill('保存を継続できる');
  await expect(page.getByLabel('役割のメモ（任意）', { exact: true })).toHaveValue('a'.repeat(2000));
  await expect(page.getByLabel('満たしたい条件')).toHaveValue('保存を継続できる');
  await page.getByRole('button', { name: 'プロパティを閉じる' }).click();
  await page.getByRole('button', { name: '設計完了（評価する）' }).click();
  await expect(page.getByRole('status').filter({ hasText: '合計2,000文字' })).toBeVisible();
  expect(api.calls()).toBe(1);
  await page.getByRole('button', { name: '評価結果', exact: true }).click();
  await expect(page.getByRole('button', { name: '受付API', exact: true })).toBeDisabled();
  expect((await exported(page)).diagram.nodes[1].data.design.requirement).toBe('保存を継続できる');
});
