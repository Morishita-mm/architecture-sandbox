import { test, expect, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
  await page.getByRole('button', { name: /^社内勤怠管理システム/ }).click();
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'touch component help' : 'desktop component help', () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });

    test('integrated help browses all components without adding or changing the diagram', async ({ page }) => {
      await start(page);
      const sidebar = page.getByRole('complementary', { name: 'コンポーネント', exact: true });
      const add = sidebar.getByRole('button', { name: 'App Server', exact: true });
      if (mobile) {
        await add.tap();
        await page.getByRole('button', { name: 'コンポーネントの表示切り替え' }).tap();
      } else await add.click();
      await expect(page.locator('.react-flow__node')).toHaveCount(1);
      const info = sidebar.getByRole('button', { name: 'App Serverの説明', exact: true });
      await info.scrollIntoViewIfNeeded();
      const card = (await add.boundingBox())!;
      const icon = (await info.boundingBox())!;
      expect(icon.x).toBeGreaterThanOrEqual(card.x);
      expect(icon.x + icon.width).toBeLessThanOrEqual(card.x + card.width);
      expect(icon.y).toBeGreaterThanOrEqual(card.y);
      expect(icon.y + icon.height).toBeLessThanOrEqual(card.y + card.height);
      await expect(sidebar.getByText('必要な部品だけ選べます。説明は「？」から。')).toHaveCount(0);
      const before = await page.locator('.component-list').evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight }));
      if (mobile) await info.tap();
      else { await info.focus(); await info.press('Enter'); }

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'App Server', exact: true })).toBeVisible();
      await expect(dialog.getByText('勤怠の登録や注文などのルールを実行し、データを読み書きします。')).toBeVisible();
      const titleSize = await dialog.getByRole('heading', { name: 'App Server', exact: true }).evaluate(el => parseFloat(el.ownerDocument.defaultView!.getComputedStyle(el).fontSize));
      const subtitleSize = await dialog.getByText('業務の処理を行う', { exact: true }).evaluate(el => parseFloat(el.ownerDocument.defaultView!.getComputedStyle(el).fontSize));
      expect(titleSize).toBeGreaterThan(subtitleSize);
      await expect(dialog.getByRole('img', { name: 'Web Server → 処理を依頼 → App Server → 読み書き → RDBMS (SQL)' })).toBeVisible();
      const bounds = (await dialog.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      await expect(dialog.getByRole('button', { name: '部品の説明を閉じる' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: '次の部品' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button', { name: '部品の説明を閉じる' })).toBeFocused();
      for (const key of ['Delete', 'Backspace', 'Control+z', 'Meta+z']) await page.keyboard.press(key);
      await expect(page.locator('.react-flow__node')).toHaveCount(1);

      const picker = dialog.getByRole('combobox', { name: '別の部品の説明を見る' });
      await expect(picker.locator('option')).toHaveCount(32);
      const footerY = (await dialog.getByRole('contentinfo').boundingBox())!.y;
      // Every entry has a readable example, including scopes, associations and fan-out.
      for (const type of await picker.locator('option').evaluateAll(options => options.map(option => option.getAttribute('value')!))) {
        await picker.selectOption(type);
        await expect(dialog.getByRole('heading', { name: type, exact: true })).toBeVisible();
        const example = dialog.getByRole('figure');
        await expect(example.getByRole('img')).toHaveAccessibleName(new RegExp(type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        const sizes = await dialog.getByRole('region', { name: '部品の説明' }).evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
        expect(sizes.content).toBeLessThanOrEqual(sizes.width);
      }
      await picker.selectOption('VPC (Network)');
      await expect(dialog.getByRole('button', { name: '前の部品' })).toBeDisabled();
      await dialog.getByRole('button', { name: '次の部品' }).click();
      await expect(picker).toHaveValue('Availability Zone');
      await expect(dialog.getByRole('heading', { name: 'Availability Zone' })).toBeVisible();
      await picker.selectOption('Health Checker');
      await expect(dialog.getByRole('button', { name: '次の部品' })).toBeDisabled();
      await dialog.getByRole('button', { name: '前の部品' }).click();
      await expect(picker).toHaveValue('Alert Manager');
      expect(Math.abs((await dialog.getByRole('contentinfo').boundingBox())!.y - footerY)).toBeLessThan(1);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(info).toBeFocused();
      await expect(sidebar).toBeVisible();
      expect(await page.locator('.component-list').evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight }))).toEqual(before);
      await expect(page.locator('.react-flow__node')).toHaveCount(1);

      await info.click();
      await expect(dialog.getByRole('heading', { name: 'App Server', exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: '部品の説明を閉じる' }).click();
      await add.click();
      await expect(page.locator('.react-flow__node')).toHaveCount(2);
    });
  });
}

test('backdrop dismisses the help and restores the filtered component list', async ({ page }) => {
  await start(page);
  const sidebar = page.getByRole('complementary', { name: 'コンポーネント', exact: true });
  await sidebar.getByRole('searchbox').fill('関係をたどる');
  const info = sidebar.getByRole('button', { name: 'NoSQL (Graph)の説明', exact: true });
  await info.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'NoSQL (Graph)' })).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(info).toBeFocused();
  await expect(sidebar.getByRole('searchbox')).toHaveValue('関係をたどる');
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
});
