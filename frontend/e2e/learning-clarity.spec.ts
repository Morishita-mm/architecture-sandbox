import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { newStageProgress, STAGE_STORAGE_KEY as key } from '../src/utils/componentStages';
import { stageIds } from '../src/constants/componentStages';
import { button, connect, remove } from './course-canvas-helpers';

async function capture(page: Page, name: string) {
  if (!process.env.CLARITY_CAPTURE_DIR) return;
  await mkdir(process.env.CLARITY_CAPTURE_DIR, { recursive: true });
  await page.screenshot({ path: `${process.env.CLARITY_CAPTURE_DIR}/${page.viewportSize()!.width}-${name}.png`, fullPage: true, animations: 'disabled' });
}
for (const mobile of [false, true]) test.describe(mobile ? 'mobile learning clarity' : 'desktop learning clarity', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1255, height: 963 }, hasTouch: mobile, isMobile: mobile });
  test('home and themes are separate screens; theme selection and basic properties stay accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scenario-card')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Architecture Sandbox', exact: true })).not.toBeFocused();
    await capture(page, 'home');
    await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
    await expect(page.getByRole('heading', { name: '設計するテーマを選ぶ' })).toBeFocused();
    await expect(page.locator('.welcome-paths')).toHaveCount(0);
    await expect(page.locator('.scenario-card')).toHaveCount(3);
    await capture(page, 'themes');
    await button(page, 'ホーム');
    await expect(page.locator('.scenario-card')).toHaveCount(0);
    await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
    await page.getByRole('button', { name: /^カスタム設計/ }).click();
    await button(page, '戻る');
    await expect(page.getByRole('heading', { name: '設計するテーマを選ぶ' })).toBeFocused();
    await page.getByRole('button', { name: /^社内勤怠管理システム/ }).click();
    await button(page, '評価結果');
    const buttons = page.locator('.evaluation-start-actions button');
    const a = (await buttons.nth(0).boundingBox())!, b = (await buttons.nth(1).boundingBox())!;
    expect(Math.abs(a.width - b.width)).toBeLessThan(1);
    expect(Math.abs(a.height - b.height)).toBeLessThan(1);
    expect(mobile ? b.y - a.y - a.height : b.x - a.x - a.width).toBeGreaterThanOrEqual(10);
    await capture(page, 'evaluate');
    await button(page, 'アーキテクチャ設計');
    const toggle = page.getByRole('button', { name: 'コンポーネントの表示切り替え' });
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    await page.getByRole('button', { name: 'Web Browser', exact: true }).click();
    if (mobile) await page.locator('.react-flow__node').first().click();
    await expect(page.getByLabel('役割のメモ（任意）', { exact: true })).toBeVisible();
    await expect(page.getByLabel('実装方式・製品', { exact: true })).toBeHidden();
    const selector = page.getByLabel('この部品からの接続先');
    const add = page.getByRole('button', { name: '接続を追加', exact: true });
    await add.scrollIntoViewIfNeeded();
    const selectBounds = (await selector.boundingBox())!, addBounds = (await add.boundingBox())!;
    expect(addBounds.y - selectBounds.y - selectBounds.height).toBeGreaterThanOrEqual(8);
    await capture(page, 'properties');
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  });

  test('all map buttons align and the graduation card is one accessible action', async ({ page }) => {
    const p = newStageProgress(); p.cleared = ['browser'];
    await page.goto('/'); await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p });
    await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
    const cards = page.locator('.stage-card');
    if (!mobile) {
      const firstRow = await Promise.all([0, 1, 2].map(i => cards.nth(i).getByRole('button').boundingBox()));
      expect(Math.max(...firstRow.map(b => b!.y)) - Math.min(...firstRow.map(b => b!.y))).toBeLessThan(1);
      expect(Math.max(...firstRow.map(b => b!.height)) - Math.min(...firstRow.map(b => b!.height))).toBeLessThan(1);
    }
    const final = page.getByRole('button', { name: /卒業課題：条件から設計を選ぶ/ });
    await expect(final).toBeDisabled(); await expect(final.locator('button, a')).toHaveCount(0);
    await expect(page.getByLabel('到達目標：卒業')).toHaveText('卒業 🎉');
    await expect(page.getByText('教材はAI通信なしで動きます')).toHaveCount(0);
    await capture(page, 'map');
    p.cleared = [...stageIds];
    await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p });
    await page.reload(); await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
    await final.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: '卒業までにすること' })).toBeVisible();
    await expect(page.locator('.studio-mission')).toContainText('この構成を選ぶ理由を一言書く');
    await expect(page.locator('.studio-mission')).toContainText('最後に試した構成で、選んだ条件を満たす');
    await expect(page.getByRole('button', { name: 'コースを修了する' })).toHaveCount(0);
  });

  test('clear conditions precede the canvas and an answer is required after experimenting', async ({ page }) => {
    await page.goto('/'); await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
    await button(page, 'Web Browserの学習を始める');
    const goal = page.locator('.studio-mission'), canvas = page.locator('.learning-canvas');
    expect((await goal.boundingBox())!.y).toBeLessThan((await canvas.boundingBox())!.y);
    await expect(goal).toContainText('実験の下にある確認問題に正解する');
    await capture(page, 'learn');
    await connect(page, 'browser-1', 'responder');
    await button(page, '会場を調べる');
    await expect(page.getByRole('button', { name: '練習問題へ', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: '3. 確認問題' }).click();
    await expect(page.getByRole('heading', { name: '3. 確認問題に答える' })).toBeFocused();
    await page.getByRole('radio', { name: '利用者の入力を受け取り、返事を画面に表示する' }).check();
    await expect(goal.locator('li:not(.is-done)')).toHaveCount(0);
    await capture(page, 'answer');
    await button(page, '練習問題へ');
    await expect(goal).toContainText('練習の結果を確認する');
    await button(page, 'Web Browserを追加'); await connect(page, 'browser-1', 'responder');
    await button(page, 'ボールの貸出状況を調べる');
    await button(page, '練習の結果を確認する');
    await expect(page.getByRole('heading', { name: 'ステージクリア！' })).toHaveCount(0);
    await page.getByRole('radio', { name: '利用者の入力を受け取り、返事を画面に表示する' }).check();
    await button(page, '練習の結果を確認する');
    await expect(page.getByRole('heading', { name: 'ステージクリア！' })).toBeVisible();
    await expect(goal.locator('li:not(.is-done)')).toHaveCount(0);
    await capture(page, 'practice');
    await remove(page, 'browser-1--responder');
    await expect(goal.locator('li:not(.is-done)')).not.toHaveCount(0);
    await expect(page.getByRole('button', { name: '次のステージへ', exact: true })).toHaveCount(0);
  });
});
