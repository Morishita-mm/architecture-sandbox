import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { newStageProgress, STAGE_STORAGE_KEY as key } from '../src/utils/componentStages';
import { button, connect, remove } from './course-canvas-helpers';
import { connectParts, diagramSignature } from '../src/utils/courseDiagram';

async function appLesson(page: Page) {
  const p = newStageProgress(); p.cleared = ['browser']; p.current = 'app'; p.view = 'learn';
  const requests: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) { requests.push(url.pathname); return route.abort(); }
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/'); await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p });
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  return requests;
}
async function capture(page: Page, name: string, selector?: string) {
  if (!process.env.FIXED_SCENARIO_CAPTURE_DIR) return;
  await mkdir(process.env.FIXED_SCENARIO_CAPTURE_DIR, { recursive: true });
  const path = join(process.env.FIXED_SCENARIO_CAPTURE_DIR, `${page.viewportSize()!.width}-${name}.png`);
  if (selector) await page.locator(selector).screenshot({ path }); else await page.screenshot({ path, fullPage: true });
}

for (const touch of [false, true]) test.describe(touch ? 'touch tutorial' : 'desktop tutorial', () => {
  test.use({ viewport: touch ? { width: 390, height: 844 } : { width: 1255, height: 963 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  test('request and reply are in one editor, step playback is read-only, and answers explicitly report correctness', async ({ page }) => {
    const requests = await appLesson(page);
    await button(page, '会場を調べる');
    await expect(page.locator('.diagram-packet')).toHaveCount(0);
    await button(page, '次の動き'); await expect(page.locator('.learning-playback-caption')).toContainText('経路がありません');
    await connect(page, 'browser-1', 'app-1');
    await page.locator('.learning-accessible-controls summary').click();
    await expect(page.locator('.learning-canvas input:not([type=radio]):not([type=checkbox])')).toHaveCount(0);
    await page.locator('[data-id="browser-1"] button').click();
    const saved = await page.evaluate(key => localStorage.getItem(key), key);
    await expect(page.locator('.learning-canvas .studio-controls')).toHaveCount(0);
    await expect(page.locator('.react-flow')).toHaveCount(1);
    await button(page, '次の動き');
    await expect(page.locator('.diagram-packet')).toHaveAttribute('data-direction', 'forward');
    await expect(page.locator('.learning-playback-caption')).toContainText('会場を教えてください');
    await expect(page.locator('.diagram-packet')).toHaveCSS('animation-name', 'none');
    await page.waitForTimeout(1550);
    await expect(page.locator('.learning-playback-phase')).toContainText('2 / 5');
    await button(page, '次の動き'); await expect(page.locator('.learning-playback-caption')).toContainText('アプリが要求を処理');
    await button(page, '次の動き');
    await expect(page.locator('.diagram-packet')).toHaveAttribute('data-direction', 'reverse');
    await expect(page.locator('.diagram-packet')).toHaveAttribute('data-kind', 'response');
    await expect(page.locator('.learning-playback-caption')).toContainText('App Server A → Web Browser');
    await expect(page.getByLabel('利用者の画面')).toHaveText('返事を待っています…');
    await button(page, '次の動き');
    await expect(page.getByLabel('利用者の画面')).toHaveText('会場は体育館です');
    await capture(page, 'reply', '.learning-canvas');
    await button(page, 'もう一度見る');
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toEqual(saved);
    await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeEnabled();
    await page.getByRole('radio', { name: '利用者の操作と、画面への表示を担当する', exact: true }).check();
    await expect(page.locator('.answer-feedback')).toContainText('不正解');
    await expect(page.getByRole('button', { name: '練習問題へ', exact: true })).toHaveCount(0);
    await capture(page, 'incorrect', '.course-reflection');
    await page.getByRole('radio', { name: '届いた要求に応じて処理し、返事を作る', exact: true }).check();
    await expect(page.locator('.answer-feedback')).toContainText('正解！');
    await expect(page.getByRole('button', { name: '練習問題へ', exact: true })).toBeVisible();
    await capture(page, 'correct', '.course-reflection');
    await remove(page, 'browser-1--app-1');
    await expect(page.locator('.diagram-packet')).toHaveCount(0);
    await expect(page.locator('.learning-playback-caption')).toHaveCount(0);
    await button(page, '会場を調べる'); await button(page, '次の動き');
    await expect(page.getByLabel('利用者の画面')).toHaveText('返事が届きませんでした');
    await capture(page, 'disconnected', '.learning-canvas');
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    expect(requests).toEqual([]);
  });

  test('tutorial guide opens from the course with its stages, progress rules and separate storage scope', async ({ page }) => {
    await appLesson(page);
    const trigger = page.getByRole('button', { name: '操作ガイド', exact: true }); await trigger.click();
    const guide = page.getByRole('dialog', { name: 'ユーザーガイド', exact: true });
    await expect(guide.getByRole('heading', { name: 'チュートリアルの進め方', exact: true })).toBeFocused();
    await guide.getByText('8ステージで学ぶ部品', { exact: true }).click();
    await expect(guide.locator('.help-tutorial-components > li')).toHaveCount(8);
    await expect(guide).toContainText('学習記録は設計プロジェクトのJSON保存には含まれません');
    await expect(guide).toContainText('正解でも実験の条件が残っていればクリアにはなりません');
    await guide.locator('.help-content').evaluate(el => { el.scrollTop = 0; });
    await capture(page, 'guide', '.help-dialog');
    await guide.getByRole('button', { name: '目次に戻る', exact: true }).click();
    await expect(guide.getByRole('button', { name: /チュートリアルの進め方/ })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await trigger.click(); await expect(guide.getByRole('heading', { name: 'チュートリアルの進め方', exact: true })).toBeFocused();
  });
});

test('automatic playback moves a packet, can pause and resume, and stops when reduced motion is enabled', async ({ page }) => {
  await appLesson(page); await connect(page, 'browser-1', 'app-1'); await button(page, '会場を調べる');
  await expect(page.locator('.diagram-packet')).toHaveAttribute('data-direction', 'forward', { timeout: 4000 });
  await button(page, '一時停止');
  const phase = await page.locator('.learning-playback-phase').textContent();
  await page.waitForTimeout(1600); await expect(page.locator('.learning-playback-phase')).toHaveText(phase!);
  await button(page, '流れを再生');
  await expect(page.locator('.diagram-packet')).toHaveAttribute('data-direction', 'reverse', { timeout: 6000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: '一時停止', exact: true })).toHaveCount(0);
  await expect(page.locator('.diagram-packet')).toHaveCSS('animation-name', 'none');
});

test('practice grades the submitted answer explicitly and preserves the experiment while retrying an answer', async ({ page }) => {
  const p = newStageProgress(); p.view = 'practice'; p.browser = { ...p.browser, sent: '質問', reply: '返事', displayed: '返事' }; p.browserAnswer = 'display';
  p.diagrams['browser-learn'] = connectParts(p.diagrams['browser-learn'], 'browser-1', 'responder'); p.diagrams['browser-learn'].checked = diagramSignature(p.diagrams['browser-learn']);
  await page.goto('/'); await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p });
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  await button(page, 'Web Browserを追加'); await connect(page, 'browser-1', 'responder'); await button(page, 'ボールの貸出状況を調べる');
  await page.getByRole('radio', { name: 'すべての利用者の記録を永続的に保存する', exact: true }).check();
  await expect(page.locator('.answer-feedback')).toHaveCount(0);
  await button(page, '練習の結果を確認する'); await expect(page.locator('.answer-feedback')).toContainText('不正解');
  await expect(page.getByRole('heading', { name: 'ステージクリア！' })).toHaveCount(0);
  await page.getByRole('radio', { name: '利用者の入力を受け取り、返事を画面に表示する', exact: true }).check();
  await expect(page.locator('.answer-feedback')).toHaveCount(0);
  await button(page, '練習の結果を確認する'); await expect(page.locator('.answer-feedback')).toContainText('正解！');
  await expect(page.getByRole('heading', { name: 'ステージクリア！' })).toBeVisible();
});
