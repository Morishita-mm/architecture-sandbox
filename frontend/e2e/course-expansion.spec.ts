import { test, expect } from '@playwright/test';
import { connectParts, diagramSignature } from '../src/utils/courseDiagram';
import { newCourse } from '../src/utils/learningCourse';
import { newStageProgress, newAttempt, operateBrowser, newBrowser } from '../src/utils/componentStages';
const key = 'architecture-sandbox:component-stages:v4';
for (const version of [1, 2]) test(`v${version} course migration preserves observed work and starts new stage exercises honestly`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 }); await page.goto('/');
  const old = newCourse(); old.current = 'storage'; old.lessons.storage.draft = '以前の入力'; old.lessons.storage.sawVolatileLoss = true;
  const legacy = JSON.stringify(version === 1 ? { version, current: old.current, lessons: old.lessons } : old);
  const legacyKey = `architecture-sandbox:learning-course:v${version}`;
  await page.evaluate(({ legacy, legacyKey }) => localStorage.setItem(legacyKey, legacy), { legacy, legacyKey });
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  await expect(page.getByText('以前の体験とクリア履歴を引き継ぎました。新しい図は、部品をつないで試してから練習へ進めます。')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'クリアしたステージ' })).toHaveAttribute('value', '0');
  await expect(page.getByRole('button', { name: 'RDBMS (SQL)の学習を始める' })).toBeDisabled();
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  await page.getByRole('button', { name: 'Web Browserの学習を始める' }).click();
  const current = JSON.parse((await page.evaluate(key => localStorage.getItem(key), key))!);
  expect(current.learning.lessons.storage).toEqual(old.lessons.storage);
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe(legacy);
});

test('a cleared stage can be retried without erasing earned access or other practice; blocked practice cannot be resumed', async ({ page }) => {
  const p = newStageProgress();
  p.diagrams['browser-learn'] = connectParts(p.diagrams['browser-learn'], 'browser-1', 'responder'); p.diagrams['browser-learn'].checked = diagramSignature(p.diagrams['browser-learn']);
  p.cleared = ['browser']; p.browser = operateBrowser(operateBrowser(newBrowser(), 'send').state, 'display').state; p.browserAnswer = 'display';
  p.attempts.browser.answer = 'display'; p.attempts.app.model = { kind: 'request', value: { ...p.learning.lessons.request, draft: 'ほかの練習' } };
  await page.goto('/'); await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p });
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click(); await page.getByRole('button', { name: 'Web Browserの復習' }).click();
  await page.getByRole('button', { name: '2. 練習で確かめる' }).click();
  await page.getByRole('button', { name: '練習をやり直す' }).click(); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.getByRole('radio', { name: '利用者の入力を受け取り、返事を画面に表示する' })).toBeChecked();
  await page.getByRole('button', { name: '練習をやり直す' }).click(); await page.getByRole('button', { name: '図と実験を最初に戻す' }).click();
  const saved = JSON.parse((await page.evaluate(key => localStorage.getItem(key), key))!);
  expect(saved.attempts.browser).toEqual(newAttempt('browser')); expect(saved.attempts.app).toEqual(p.attempts.app); expect(saved.cleared).toEqual(['browser']);
  await page.getByRole('button', { name: '学習マップ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'App Serverの学習を始める' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'RDBMS (SQL)の学習を始める' })).toBeDisabled();
});
