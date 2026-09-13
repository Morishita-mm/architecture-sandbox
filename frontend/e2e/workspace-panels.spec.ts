import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const project = {
  schemaVersion: 2, version: '1.0', timestamp: '2026-09-14T00:00:00.000Z',
  projectId: 'panels-regression',
  scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠管理' },
  memo: '既存メモ', chatHistory: [], evaluation: null,
  diagram: {
    nodes: [
      { id: 'app', type: 'custom', position: { x: 0, y: 0 }, data: { originalType: 'App Server', label: 'API', description: '' } },
      { id: 'db', type: 'custom', position: { x: 0, y: 200 }, data: { originalType: 'RDBMS (SQL)', label: 'DB', description: '' } },
    ],
    edges: [{ id: 'app-db', source: 'app', target: 'db' }],
  },
};

async function visit(page: Page) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const mobile = viewport.width < 760;
  test(`side panels retain content, close and reopen from either side at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await visit(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    const memo = page.getByRole('textbox', { name: '要件メモ', exact: true });
    const memoToggle = page.getByRole('button', { name: '要件メモの表示切り替え' });
    const componentsToggle = page.getByRole('button', { name: 'コンポーネントの表示切り替え' });
    await expect(memo).toBeVisible();
    await expect(memoToggle).toHaveAttribute('aria-expanded', 'true');
    const memoPanel = page.getByRole('complementary', { name: '要件メモ', exact: true });
    await expect.poll(async () => {
      const panel = await memoPanel.boundingBox();
      return Math.abs(panel!.x + panel!.width - viewport.width);
    }).toBeLessThan(2);
    const panel = await memoPanel.boundingBox();
    const work = await page.locator('.workspace-content').boundingBox();
    expect(Math.abs(panel!.y - work!.y)).toBeLessThan(2);
    expect(Math.abs(panel!.x + panel!.width - viewport.width)).toBeLessThan(2);
    await memo.fill('予算を確認する\nバックアップ方針も確認する');
    await page.getByRole('button', { name: '要件メモを閉じる', exact: true }).click();
    await expect(memo).toBeHidden();
    await expect(memoToggle).toBeFocused();
    const draft = page.getByRole('textbox', { name: 'メッセージ', exact: true });
    await draft.fill('未送信の質問');
    await memoToggle.click();
    await expect(memo).toHaveValue('予算を確認する\nバックアップ方針も確認する');
    await memo.press('Escape');
    await expect(memo).toBeHidden();
    await expect(draft).toHaveValue('未送信の質問');
    await memoToggle.click();

    await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
    await expect(componentsToggle).toHaveAttribute('aria-expanded', 'true');
    if (mobile) await expect(memo).toBeHidden();
    else await expect(memo).toBeVisible();
    const components = page.getByRole('complementary', { name: 'コンポーネント', exact: true });
    await expect.poll(async () => (await components.boundingBox())!.x).toBe(0);
    const category = components.getByRole('button', { name: /Client \/ User/ });
    await category.click();
    await expect(category).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'コンポーネントを閉じる', exact: true }).click();
    await expect(components).toBeHidden();
    await componentsToggle.click();
    await expect(category).toHaveAttribute('aria-expanded', 'false');
    if (mobile) {
      await memoToggle.click();
      await expect(components).toBeHidden();
      await expect(memo).toBeVisible();
      await page.getByRole('button', { name: 'サイドパネルを閉じる', exact: true }).click({ position: { x: 12, y: 20 } });
      await expect(memo).toBeHidden();
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'プロジェクト保存', exact: true }).click();
    const file = await (await download).path();
    const saved = JSON.parse(await readFile(file!, 'utf8'));
    expect(saved.memo).toBe('予算を確認する\nバックアップ方針も確認する');
    expect(saved.diagram.nodes.map((node: { id: string }) => node.id)).toEqual(['app', 'db']);
    expect(saved.diagram.edges).toHaveLength(1);

    await page.getByRole('button', { name: 'Architecture Sandbox ホームへ戻る', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Architecture Sandbox', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'morimizu.dev', exact: true })).toHaveAttribute('href', 'https://morimizu.dev/');
  });

  test(`guide contents and articles support keyboard return at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await visit(page);
    const trigger = page.getByRole('button', { name: '操作ガイド', exact: true });
    await trigger.click();
    const guide = page.getByRole('dialog', { name: 'ユーザーガイド', exact: true });
    const contents = guide.getByRole('navigation', { name: 'ガイドの目次' });
    await expect(contents.getByRole('button')).toHaveCount(5);
    await guide.getByRole('button', { name: '操作ガイドを閉じる' }).focus();
    await expect(guide).toHaveJSProperty('open', true);
    await page.keyboard.press('Tab');
    await expect(contents.getByRole('button', { name: /基本的な流れ/ })).toBeFocused();
    await contents.getByRole('button', { name: /キャンバス操作/ }).click();
    await expect(guide.getByRole('heading', { name: 'キャンバスの操作方法' })).toBeVisible();
    await expect(contents).toBeHidden();
    await guide.getByRole('button', { name: '次の項目' }).click();
    await expect(guide.getByRole('button', { name: '目次に戻る' })).toBeVisible();
    await guide.getByRole('button', { name: '目次に戻る' }).click();
    await expect(contents.getByRole('button', { name: /AI活用のコツ/ })).toBeFocused();
    await contents.getByRole('button', { name: /共有と挑戦/ }).click();
    await expect(guide.getByRole('button', { name: '次の項目' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(guide).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(contents).toBeVisible();
  });
}
