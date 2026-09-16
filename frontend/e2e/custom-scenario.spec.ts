import { expect, test } from '@playwright/test';

async function openCustomSetup(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
  await page.getByRole('button', { name: /^カスタム設計/ }).click();
  await expect(page.getByRole('heading', { name: '自分のテーマで設計する' })).toBeVisible();
}

test('guided custom flow fixes a validated family and level for interview requests', async ({ page }) => {
  let posted: Record<string, unknown> | undefined;
  await page.route('**/api/chat', async route => {
    posted = route.request().postDataJSON();
    await route.fulfill({ json: { reply: '利用者は100万人で、イベント開始時に集中します。', coveredConditions: [{ id: 'users', label: '利用者と利用時間' }, { id: 'traffic', label: '利用量と集中する時間' }] } });
  });
  await openCustomSetup(page);
  await expect(page.getByRole('radio', { name: /条件をおまかせ/ })).toBeChecked();
  await page.getByLabel('テーマ名').fill('フリマアプリ');
  await page.getByLabel('利用者と、できるようにしたいこと').fill('利用者同士が商品の写真を載せて売買する。');
  await page.getByRole('radio', { name: /取引・予約/ }).check();
  await page.getByRole('radio', { name: /発展/ }).check();
  await page.getByRole('button', { name: /条件を固定して聞き取りへ/ }).click();
  await expect(page.getByRole('heading', { name: 'フリマアプリ' })).toBeVisible();
  await page.getByPlaceholder('要件について質問する').fill('利用規模を教えてください');
  await page.getByRole('button', { name: '送信' }).click();
  await expect.poll(() => posted).toBeTruthy();
  expect(posted?.scenario).toEqual({
    id: 'custom', title: 'フリマアプリ', description: '利用者同士が商品の写真を載せて売買する。',
    isCustom: true, difficulty: 'large', partnerRole: 'ceo', customMode: 'guided', scenarioFamily: 'transaction',
  });
  await expect(page.getByText('確認できた条件 2件')).toBeVisible();
  await expect(page.getByText('利用者と利用時間', { exact: true })).toBeVisible();
  await expect(page.getByText('利用量と集中する時間', { exact: true })).toBeVisible();
});

test('self-defined custom flow sends only the written specification and no hidden profile', async ({ page }) => {
  let posted: Record<string, unknown> | undefined;
  await page.route('**/api/chat', async route => {
    posted = route.request().postDataJSON();
    await route.fulfill({ json: { reply: '未定義の条件を一緒に整理します。' } });
  });
  await openCustomSetup(page);
  await page.getByRole('radio', { name: /自分で仕様を決める/ }).check();
  await expect(page.getByText('隠れた正解は作りません。')).toBeVisible();
  await expect(page.getByRole('radio', { name: /取引・予約/ })).toHaveCount(0);
  await page.getByLabel('テーマ名').fill('地域施設検索');
  await page.getByLabel('利用者・機能・わかっている条件').fill('住民が施設を検索する。保存期間は未定。');
  await page.getByRole('button', { name: /仕様を整理しながら始める/ }).click();
  await expect(page.getByText(/仕様を一緒に整理します/)).toBeVisible();
  await page.getByPlaceholder('要件について質問する').fill('何を決めればよいですか');
  await page.getByRole('button', { name: '送信' }).click();
  await expect.poll(() => posted).toBeTruthy();
  expect(posted?.scenario).toEqual({
    id: 'custom', title: '地域施設検索', description: '住民が施設を検索する。保存期間は未定。',
    isCustom: true, partnerRole: 'ceo', customMode: 'self_defined',
  });
});

test('custom setup remains readable without horizontal overflow on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCustomSetup(page);
  await expect(page.getByRole('radio', { name: /社内業務/ })).toBeVisible();
  expect(await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth')).toBe(true);
  await page.getByRole('radio', { name: /自分で仕様を決める/ }).check();
  await expect(page.getByLabel('利用者・機能・わかっている条件')).toBeVisible();
  expect(await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth')).toBe(true);
});
