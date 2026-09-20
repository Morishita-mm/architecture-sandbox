import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

for (const initial of ['light', 'dark'] as const) {
  test(`default follows ${initial} system mode; button only toggles light and dark`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: initial });
    await page.goto('/');
    const colors = { light: 'rgb(245, 246, 248)', dark: 'rgb(20, 22, 25)' };
    const labels = { light: 'ライト', dark: 'ダーク' };
    const opposite = initial === 'dark' ? 'light' : 'dark';
    const background = () => page.locator('.welcome-screen').evaluate(el => el.ownerDocument.defaultView!.getComputedStyle(el).backgroundColor);
    const toggle = page.getByRole('button', { name: /^表示モード:/ });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
    await expect.poll(background).toBe(colors[initial]);
    await expect(toggle).toHaveAccessibleName(`表示モード: ${labels[initial]}。${labels[opposite]}に切り替え`);
    // An OS change updates both the actual appearance and the button before a choice.
    await page.emulateMedia({ colorScheme: opposite });
    await expect.poll(background).toBe(colors[opposite]);
    await expect(toggle).toHaveAccessibleName(`表示モード: ${labels[opposite]}。${labels[initial]}に切り替え`);
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', initial);
    await expect.poll(background).toBe(colors[initial]);
    await page.reload();
    await expect.poll(background).toBe(colors[initial]);
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', opposite);
    await page.emulateMedia({ colorScheme: initial });
    await expect.poll(background).toBe(colors[opposite]);
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', initial);
    await expect.poll(background).toBe(colors[initial]);
  });
}

test('theme still works when localStorage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.removeItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: '表示モード: ライト。ダークに切り替え' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`chat status and expandable evidence work on mobile in ${colorScheme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/chat', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
      await waiting;
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: {
        reply: '月額の上限は5万円を想定しています。', coveredConditions: [{ id: 'cost', label: '月額予算' }],
      } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
    await page.getByRole('button', { name: /^社内勤怠管理システム/ }).click();
    const send = page.getByRole('button', { name: '送信', exact: true });
    await expect(send).toBeDisabled();
    await page.getByRole('textbox', { name: 'メッセージ', exact: true }).fill('月額の予算を教えてください');
    await send.click();
    await expect(page.getByRole('status').filter({ hasText: '回答を待っています' })).toBeVisible();
    await page.locator('.chat-thinking summary').click();
    await expect(page.getByText('質問を送信しました。相談相手からの回答を受信すると、ここに表示します。')).toBeVisible();
    expect(await page.locator('.chat-thinking-spinner').evaluate(el => el.ownerDocument.defaultView!.getComputedStyle(el).animationName)).toBe('none');
    release();
    await expect(page.locator('.chat-thinking')).toHaveCount(0);
    await expect(page.getByRole('log')).toContainText('月額の上限は5万円');
    const chip = page.locator('.chat-evidence-chip');
    await expect(chip).not.toHaveAttribute('open');
    await chip.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(chip).toHaveAttribute('open', '');
    await expect(chip).toContainText('月額の予算を教えてください');
    await expect(chip).toContainText('月額の上限は5万円');
    await expect(send).toBeInViewport();
    expect(await page.locator('html').evaluate(el => el.scrollWidth <= el.ownerDocument.defaultView!.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
    await expect(page.locator('.reactflow-wrapper')).toBeVisible();
    await page.getByRole('button', { name: '評価結果', exact: true }).click();
    await expect(page.locator('.evaluation-empty-card')).toBeVisible();
  });
}

for (const [role, label] of [['ceo', '非技術系CEO'], ['cto', '技術責任者（CTO）'], ['cfo', '財務担当（CFO）']]) {
  test(`chat shows the selected ${role} persona on each partner message`, async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({ name: 'persona.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
      schemaVersion: 2, version: '1.0', timestamp: '2026-09-20T00:00:00.000Z', projectId: `persona-${role}`,
      scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠管理', partnerRole: role },
      memo: '', diagram: { nodes: [], edges: [] }, evaluation: null,
      chatHistory: [{ role: 'model', content: '要件を確認しましょう。' }, { role: 'user', content: '利用人数は？' }, { role: 'model', content: '100人です。' }],
    })) });
    const log = page.getByRole('log');
    await expect(log.getByRole('img', { name: `${label}のアイコン`, exact: true })).toHaveCount(2);
    await expect(log.locator('.chat-message-user').getByRole('img')).toHaveCount(0);
    await expect(log.locator('.chat-message-model .chat-message-author').first()).toContainText(label);
  });
}
