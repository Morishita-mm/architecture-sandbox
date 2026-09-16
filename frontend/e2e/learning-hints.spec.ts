import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function visit(page: Page) {
  const apiRequests: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) { apiRequests.push(url.pathname); return route.abort(); }
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/');
  return apiRequests;
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'touch learning hints' : 'desktop learning hints', () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });

    test('optional progressive hints preserve work and make no API requests', async ({ page }) => {
      const apiRequests = await visit(page);
      const firstGuide = page.getByRole('button', { name: '設計のヒント', exact: true });
      await firstGuide.click();
      const dialog = page.getByRole('dialog', { name: 'ユーザーガイド', exact: true });
      const areas = dialog.getByRole('group', { name: 'ヒントの種類' });
      await expect(areas.getByRole('button', { name: '学ぶこと', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByRole('heading', { name: '設計のヒント', exact: true })).toBeFocused();
      await expect(dialog.getByText(/プログラミングの知識は必要ありません/)).toBeVisible();
      await expect(dialog.getByText(/まずは10〜15分/)).toBeVisible();
      await areas.getByRole('button', { name: '聞くこと', exact: true }).click();
      const topic = dialog.locator('details.learning-hint').filter({ has: page.locator('summary', { hasText: '誰が、何をしたい？' }) });
      const title = topic.locator(':scope > summary');
      if (mobile) await title.tap();
      else { await title.focus(); await title.press('Enter'); }
      await expect(topic.getByText(/この仕組みを使う人と/)).toBeVisible();
      await expect(topic.getByText(/使う人と目的がわかると/)).toBeHidden();
      await topic.getByText('設計にどう関わる？', { exact: true }).click();
      await expect(topic.getByText(/使う人と目的がわかると/)).toBeVisible();
      await expect(topic.getByText(/「このテーマの利用者」は/)).toBeHidden();
      await topic.getByText('考える問いを見る', { exact: true }).click();
      await expect(topic.getByText(/「このテーマの利用者」は/)).toBeVisible();
      expect(await dialog.locator('.help-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const bounds = (await dialog.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      await dialog.getByRole('button', { name: '操作ガイドを閉じる' }).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: '閉じる', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button', { name: '操作ガイドを閉じる' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(firstGuide).toBeFocused();
      await expect(dialog).toBeHidden();

      await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
  await page.getByRole('button', { name: /^社内勤怠管理システム/ }).click();
      const input = page.getByRole('textbox', { name: 'メッセージ', exact: true });
      const draft = 'この題材で利用者が行いたいことを確認したいです。';
      await input.fill(draft);
      const trigger = page.getByRole('button', { name: '設計のヒント', exact: true });
      await trigger.click();
      await expect(areas.getByRole('button', { name: '聞くこと', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(input).toHaveValue(draft);

      await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
      await page.getByRole('complementary', { name: 'コンポーネント', exact: true }).getByRole('button', { name: 'App Server', exact: true }).click();
      await trigger.click();
      await expect(areas.getByRole('button', { name: '図にする', exact: true })).toHaveAttribute('aria-pressed', 'true');
      for (const key of ['Delete', 'Backspace', 'Control+z', 'Meta+z']) await page.keyboard.press(key);
      await expect(page.locator('.react-flow__node')).toHaveCount(1);
      await areas.getByRole('button', { name: '振り返る', exact: true }).click();
      await expect(dialog.getByText('一つの部品が止まったら？', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await trigger.click();
      await expect(areas.getByRole('button', { name: '図にする', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
      await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: '評価結果', exact: true }).click();
      await trigger.click();
      await expect(areas.getByRole('button', { name: '振り返る', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '要件定義・交渉', exact: true }).click();
      await expect(input).toHaveValue(draft);
      expect(apiRequests).toEqual([]);
    });
  });
}

test('an unfamiliar custom theme can start without guidance and use hints offline without changing its saved data', async ({ page, context }) => {
  const apiRequests = await visit(page);
  const project = {
    schemaVersion: 2, version: '1.0', timestamp: '2026-09-14T00:00:00.000Z', projectId: 'custom-hints',
    scenario: { id: 'custom', title: '山小屋の備品貸し出し', description: '山小屋で借りた備品と返却を記録する仕組みを考える。', isCustom: true, difficulty: 'small', partnerRole: 'ceo' },
    memo: '返却が遅れたときの対応は未確認',
    chatHistory: [{ role: 'user', content: '誰が貸し出しを記録しますか？' }, { role: 'model', content: '小屋の管理人です。' }],
    evaluation: null,
    diagram: { nodes: [], edges: [] },
  };
  await page.locator('input[type=file]').setInputFiles({ name: 'custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.getByRole('textbox', { name: 'メッセージ', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await context.setOffline(true);
  await page.getByRole('button', { name: '設計のヒント', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const label of ['聞くこと', '図にする', '振り返る']) {
    await dialog.getByRole('button', { name: label, exact: true }).click();
    for (const detail of await dialog.locator('.learning-hint').all()) {
      await detail.locator(':scope > summary').click();
      await detail.getByText('設計にどう関わる？', { exact: true }).click();
      await detail.getByText('考える問いを見る', { exact: true }).click();
      await expect(detail.locator('.learning-hint-prompt')).toBeVisible();
    }
  }
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存', exact: true }).click();
  const saved = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
  expect(saved.scenario).toEqual(project.scenario);
  expect(saved.memo).toBe(project.memo);
  expect(saved.chatHistory).toEqual(project.chatHistory);
  expect(saved.diagram).toEqual(project.diagram);
  expect(saved.evaluation).toBeNull();
  expect(apiRequests).toEqual([]);
});
