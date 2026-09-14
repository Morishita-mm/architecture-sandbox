import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const question = 'タブを移動しても回答を保存してください\n予算についても教えてください';
const reply = '遅延した回答を一度だけ保存しました';
const project = {
  schemaVersion: 2, version: '1.0', timestamp: '2026-09-13T00:00:00.000Z',
  projectId: 'existing-project-id',
  scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠管理' },
  memo: '既存メモ', diagram: { nodes: [], edges: [] }, chatHistory: [], evaluation: null,
};
async function load(page: Page) {
  // No external service is contacted, including the AI provider and shortener.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'existing.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.getByPlaceholder('要件について質問する（例：予算はどのくらいですか？）')).toBeVisible();
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
async function save(page: Page) {
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存' }).click();
  const path = await (await downloaded).path();
  if (!path) throw new Error('Download file missing');
  return JSON.parse(await readFile(path, 'utf8'));
}

test('chat input grows from one to three lines, then scrolls and shrinks when cleared', async ({ page }) => {
  await load(page);
  const input = page.getByRole('textbox', { name: 'メッセージ', exact: true });
  const visibleRows = () => input.evaluate(el => {
    const style = el.ownerDocument.defaultView!.getComputedStyle(el);
    return (el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / parseFloat(style.lineHeight);
  });
  await expect.poll(visibleRows).toBe(1);
  await input.fill('1行目');
  for (const rows of [2, 3, 4, 5]) {
    await input.press('Shift+Enter');
    await input.pressSequentially(`${rows}行目`);
    await expect.poll(visibleRows).toBe(Math.min(rows, 3));
  }
  await expect(input).toHaveValue('1行目\n2行目\n3行目\n4行目\n5行目');
  await expect.poll(() => input.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await input.hover();
  await page.mouse.wheel(0, 200);
  await expect.poll(() => input.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await input.fill('1行に戻す');
  await expect.poll(visibleRows).toBe(1);
  // Wrapped text also grows and remains capped after the hidden chat is resized.
  await input.fill('長い文章の折り返しも確認します。'.repeat(20));
  await expect.poll(visibleRows).toBe(3);
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
  await page.setViewportSize({ width: 900, height: 720 });
  await page.getByRole('button', { name: '要件定義・交渉', exact: true }).click();
  await expect.poll(visibleRows).toBe(3);
  await input.fill('');
  await expect.poll(visibleRows).toBe(1);
});

test('delayed chat survives design/evaluation tab changes and is saved once', async ({ page }) => {
  await load(page);
  const seen = deferred(); const release = deferred(); let requests = 0;
  await page.route('**/api/chat', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
    requests++; seen.resolve(); await release.promise;
    await route.fulfill({ json: { reply }, headers: { 'access-control-allow-origin': '*' } });
  });
  const input = page.getByPlaceholder('要件について質問する（例：予算はどのくらいですか？）');
  const [firstLine, secondLine] = question.split('\n');
  await input.fill(firstLine);
  await input.press('Shift+Enter');
  await expect(input).toHaveValue(`${firstLine}\n`);
  expect(requests).toBe(0);
  await input.pressSequentially(secondLine);
  await input.press('Enter');
  await seen.promise;
  await expect(input).toHaveValue('');
  await expect(input).toHaveJSProperty('clientHeight', 48);
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
  await expect(input).toBeHidden();
  release.resolve();
  await page.getByRole('button', { name: '評価結果', exact: true }).click();
  await page.getByRole('button', { name: '要件定義・交渉', exact: true }).click();
  await expect(page.getByText(reply, { exact: true })).toHaveCount(1);
  await expect(input).toBeEnabled();
  const saved = await save(page);
  expect(saved.projectId).toBe(project.projectId);
  expect(saved.memo).toBe(project.memo);
  expect(saved.chatHistory).toEqual([{ role: 'user', content: question }, { role: 'model', content: reply }]);
  expect(requests).toBe(1);
});

test('IME confirmation does not send; the send button preserves the multiline message', async ({ page }) => {
  await load(page);
  const received: unknown[] = [];
  await page.route('**/api/chat', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
    received.push(route.request().postDataJSON().messages);
    await route.fulfill({ json: { reply }, headers: { 'access-control-allow-origin': '*' } });
  });
  const input = page.getByPlaceholder('要件について質問する（例：予算はどのくらいですか？）');
  await input.fill(question);
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  await expect(input).toHaveValue(question);
  expect(received).toHaveLength(0);
  await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  expect(received).toEqual([[{ role: 'user', content: question }]]);
  expect((await save(page)).chatHistory).toEqual([{ role: 'user', content: question }, { role: 'model', content: reply }]);
});

test('leaving a project aborts its request and never inserts an old reply in a new project', async ({ page }) => {
  await load(page);
  const seen = deferred(); const release = deferred();
  await page.route('**/api/chat', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
    seen.resolve(); await release.promise;
    await route.fulfill({ json: { reply }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.getByPlaceholder('要件について質問する（例：予算はどのくらいですか？）').fill(question);
  await page.getByRole('button', { name: '送信', exact: true }).click(); await seen.promise;
  const failed = page.waitForEvent('requestfailed', request => request.url().endsWith('/api/chat'));
  await page.getByTitle('シナリオ選択画面に戻る').click();
  release.resolve(); await failed;
  await page.getByText('社内勤怠管理システム', { exact: true }).click();
  await expect(page.getByPlaceholder('要件について質問する（例：予算はどのくらいですか？）')).toBeEnabled();
  expect((await save(page)).chatHistory.some((m: { content: string }) => m.content === reply || m.content === question)).toBe(false);
});
