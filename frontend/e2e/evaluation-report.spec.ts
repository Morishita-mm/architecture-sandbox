import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const node = (id: string, originalType: string, y: number) => ({ id, type: 'custom', position: { x: 80, y }, data: { label: originalType, originalType, description: '' } });
const project = {
  schemaVersion: 2, version: '1.0', timestamp: '2026-09-16T00:00:00Z', projectId: 'evaluation-report-test',
  scenario: { id: 'sns_app', title: '画像投稿SNS (Twitter Clone)', description: 'SNS' }, memo: '元のメモ', chatHistory: [], evaluation: null,
  diagram: { nodes: [node('client', 'Web Browser', 20), node('app', 'App Server', 250), node('db', 'RDBMS (SQL)', 480)], edges: [{ id: 'ca', source: 'client', target: 'app' }, { id: 'ad', source: 'app', target: 'db' }] },
};
// Synthetic evaluation for UI verification. This does not call or measure the AI.
const result = {
  totalScore: 66, details: { availability: 60, scalability: 72, security: 68, maintainability: 74, costEfficiency: 64, feasibility: 58 },
  feedback: '確認した根拠: [Web Browser](#node=client)から[App Server](#node=app)、[RDBMS (SQL)](#node=db)へ、投稿を届けて保存する経路がつながっています。部品ごとに、表示・処理・保存の役割を分けています。 重大な不足: アプリが1台停止した場合に、利用者の要求を受け付ける別の経路がありません。停止しても投稿を続けられるという条件に対して、この構成では処理が止まります。 未確認事項: データを復元する手順と、利用が増えたときの対応方針はまだ記録されていません。要件に応じて、どこまで備えるかを確認しましょう。',
  improvement: '1. **停止したときの経路を考える**\n   [App Server](#node=app)が使えなくなったとき、別の処理先へ届けられる構成を試しましょう。\n2. **記録を戻す方法を決める**\n   データを失った場合、どの時点まで復元したいかを確認しましょう。',
  interview: { confirmed: 2, total: 4, confirmedConditions: [{ id: 'users', label: '利用者と利用時間' }, { id: 'traffic', label: '利用量と集中する時間' }], missingConditions: [{ id: 'availability', label: '停止できる時間' }, { id: 'budget', label: '予算' }] },
};
async function load(page: Page, data: unknown = project) {
  let calls = 0;
  await page.route('**/*', route => {
    if (route.request().url().endsWith('/api/evaluate')) { calls++; return route.fulfill({ json: result }); }
    return new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'design.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByRole('button', { name: '評価結果', exact: true }).click();
  return () => calls;
}
async function capture(page: Page, name: string) {
  if (!process.env.CAPTURE_EVALUATION) return;
  await mkdir('../docs/images/evaluation-redesign', { recursive: true });
  await expect(page.locator('.draft-status')).toHaveAttribute('data-state', 'saved');
  await page.screenshot({ path: `../docs/images/evaluation-redesign/${name}.png`, animations: 'disabled' });
}
async function exported(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

for (const width of [1255, 390]) test.describe(`evaluation report ${width}`, () => {
  test.use({ viewport: { width, height: width === 390 ? 844 : 963 } });
  test('read separated feedback, expand criteria, inspect evidence and preserve the saved evaluation', async ({ page }) => {
    const calls = await load(page);
    await page.getByRole('button', { name: '現在の設計を評価する', exact: true }).click();
    const criteria = page.locator('.evaluation-criteria');
    await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
    await expect(criteria).not.toHaveAttribute('open', '');
    const chart = page.getByRole('img', { name: /^6つの観点のレーダー/ });
    await expect(chart).toBeInViewport();
    await expect(chart.locator('.recharts-radar-polygon')).toBeVisible();
    expect((await chart.boundingBox())!.width).toBeGreaterThan(240);
    expect((await chart.boundingBox())!.y + (await chart.boundingBox())!.height).toBeLessThanOrEqual((await criteria.boundingBox())!.y);
    await expect(page.locator('.evaluation-score-value')).toHaveText('66/ 100');
    expect((await page.locator('.evaluation-score-value > span').boundingBox())!.height).toBeLessThan(30);
    await expect(page.locator('.evaluation-dimension strong')).toHaveText(['60/100', '72/100', '68/100', '74/100', '64/100', '58/100']);
    const interview = page.getByRole('region', { name: '聞き取り到達度' });
    await expect(interview).toContainText('2 / 4項目');
    await expect(interview).toContainText('利用者と利用時間');
    await expect(interview).toContainText('停止できる時間');
    const good = page.getByRole('region', { name: '良い点・確認できたこと' });
    const issues = page.getByRole('region', { name: '改善が必要な点' });
    const unknown = page.getByRole('region', { name: 'まだ確認が必要なこと' });
    await expect(good).toContainText('保存する経路がつながっています');
    await expect(good).not.toContainText('1台停止');
    await expect(issues).toContainText('1台停止');
    await expect(issues).not.toContainText('復元する手順');
    await expect(unknown).toContainText('復元する手順');
    await capture(page, `${width}-overview`);
    await good.evaluate(el => el.scrollIntoView({ block: 'start' }));
    await capture(page, `${width}-feedback`);
    await criteria.locator('summary').click();
    await expect(criteria.getByText('詳しい設定は任意', { exact: true })).toBeVisible();
    await expect(criteria).toContainText('6軸を等しく扱い');
    await expect(criteria.locator('.evaluation-score-bands > div')).toHaveCount(5);
    await criteria.scrollIntoViewIfNeeded();
    await capture(page, `${width}-criteria`);
    await criteria.locator('summary').click();
    await expect(page.locator('.evaluation-chart')).toHaveCount(1);
    expect((await exported(page)).evaluation).toEqual(result);
    expect(calls()).toBe(1);
    expect(await page.locator('.evaluation-panel').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);

    // The reorganization must preserve existing references and stale-result safeguards.
    await good.getByRole('button', { name: 'App Server', exact: true }).click();
    await expect(page.getByLabel('表示名', { exact: true })).toBeFocused();
    await page.getByLabel('役割のメモ（任意）', { exact: true }).fill('停止後の処理先を検討する');
    await page.getByRole('button', { name: 'プロパティを閉じる' }).click();
    await page.getByRole('button', { name: '評価結果', exact: true }).click();
    await expect(page.getByText(/^変更前の設計に対する評価です/)).toBeVisible();
    await expect(page.getByRole('button', { name: '結果をシェア', exact: true })).toBeDisabled();
    await expect(good.getByRole('button', { name: 'App Server', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '再評価する', exact: true }).click();
    await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
    await expect(page.getByRole('button', { name: '結果をシェア', exact: true })).toBeEnabled();
    expect(calls()).toBe(2);
  });
});

test('legacy unclassified feedback and long content remain readable without external links or lost text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const feedback = '    重大な不足: インデント付きコード\n\n部品の役割を確認しました。\n\n' + '長い名前の部品についての記録。'.repeat(100) + '\n\n[偽の部品](#node=missing) [外部](https://evil.example)\n\n```text\n重大な不足: これはコードです\n```';
  const calls = await load(page, { ...project, evaluation: { ...result, feedback } });
  const general = page.getByRole('region', { name: 'AIからのフィードバック', exact: true });
  await expect(general).toContainText('部品の役割を確認しました');
  await expect(general).toContainText('重大な不足: これはコードです');
  await expect(general.locator('pre').first()).toHaveText('重大な不足: インデント付きコード\n');
  await expect(page.getByRole('region', { name: '改善が必要な点', exact: true })).toHaveCount(0);
  await expect(page.getByText(/^読み込んだ評価です/)).toBeVisible();
  expect((await page.locator('.evaluation-score-value > span').boundingBox())!.height).toBeLessThan(30);
  await expect(page.getByRole('button', { name: '結果をシェア', exact: true })).toBeDisabled();
  await expect(general.getByText('偽の部品（参照先未確認）')).toBeVisible();
  await expect(general.locator('a')).toHaveCount(0);
  expect(await page.locator('.evaluation-panel').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  expect(calls()).toBe(0);
});
