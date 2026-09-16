import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const project = {
  schemaVersion: 2, version: '1.0', timestamp: '2026-09-15T00:00:00.000Z', projectId: 'design-notes-test',
  scenario: { id: 'custom', title: '備品の貸し出し', description: '備品の貸出と返却を記録する。', isCustom: true, difficulty: 'small', partnerRole: 'ceo' },
  memo: '元の自由メモ\n  空白も残す\n', chatHistory: [{ role: 'user', content: '返却は誰が確認しますか？' }], evaluation: null,
  diagram: { nodes: [
    { id: 'app', type: 'custom', position: { x: 40, y: 40 }, data: { originalType: 'App Server', label: '貸出API', description: '貸出手続きを担当' } },
    { id: 'db', type: 'custom', position: { x: 40, y: 240 }, data: { originalType: 'RDBMS (SQL)', label: '貸出DB', description: '記録を保存' } },
  ], edges: [{ id: 'link', source: 'app', target: 'db' }] },
};
async function load(page: Page, memo = project.memo) {
  const requests: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) { requests.push(url.pathname); return route.abort(); }
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...project, memo })) });
  await expect(page.getByRole('textbox', { name: 'メッセージ', exact: true })).toBeVisible();
  return requests;
}
async function download(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存', exact: true }).click();
  const file = await downloading;
  return await readFile((await file.path())!);
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'touch design records' : 'desktop design records', () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1255, height: 963 }, hasTouch: mobile, isMobile: mobile });
    test('manually records evidence and design changes, preserves work, and resumes from JSON', async ({ page }) => {
      const requests = await load(page);
      await expect(page.locator('#chat-input-help')).toHaveCount(0);
      const composer = page.getByRole('textbox', { name: 'メッセージ', exact: true });
      await composer.fill('未送信の質問は残す');
      const memo = page.getByRole('textbox', { name: '要件メモ', exact: true });
      if (mobile) await page.getByRole('button', { name: '要件メモの表示切り替え' }).click();
      const trigger = page.getByRole('button', { name: '要件と設計を記録', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: '要件と設計を記録', exact: true });
      const condition = dialog.getByLabel('条件・確かめたいこと', { exact: true });
      await expect(condition).toBeFocused();
      await expect(dialog.getByRole('radio', { name: '未確認', exact: true })).toBeChecked();
      await condition.fill('貸出記録をあとで確認したい');
      await dialog.getByRole('radio', { name: '確認済み', exact: true }).check();
      const evidence = dialog.getByLabel('確認した根拠（会話・題材の説明など）', { exact: true });
      await dialog.getByRole('button', { name: 'メモに追加', exact: true }).click();
      await expect(evidence).toBeFocused();
      await evidence.fill('依頼者が返却確認に使うと回答した');
      await dialog.getByLabel('関連する部品', { exact: false }).selectOption('db');
      await dialog.getByLabel('設計理由・対応方針', { exact: false }).fill('あとから確認できるようにDBへ保存する');
      await dialog.getByText('変更前後・次に確かめること', { exact: true }).click();
      await dialog.getByLabel('変更前の構成・困っていたこと', { exact: false }).fill('入力結果を画面に表示するだけ');
      await dialog.getByLabel('変更後の構成・期待する違い', { exact: false }).fill('APIからDBへ保存し、あとで読み出せるようにする');
      await dialog.getByLabel('次に確かめること', { exact: false }).fill('記録をいつまで残すか');
      await dialog.getByText('追加する内容を見る', { exact: true }).click();
      await expect(dialog.locator('pre')).toContainText('関連する部品: 貸出DB（RDBMS (SQL)）');
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await dialog.getByRole('button', { name: '記録を閉じる', exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: 'メモに追加', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button', { name: '記録を閉じる', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(memo).toHaveValue(project.memo);
      await trigger.click();
      await expect(condition).toHaveValue('貸出記録をあとで確認したい');
      await expect(evidence).toHaveValue('依頼者が返却確認に使うと回答した');
      await dialog.getByRole('button', { name: 'メモに追加', exact: true }).click();
      await expect(dialog).toBeHidden();
      const expected = project.memo + '\n\n' + [
        '【確認済み】貸出記録をあとで確認したい', '関連する部品: 貸出DB（RDBMS (SQL)）',
        '確認した根拠: 依頼者が返却確認に使うと回答した', '設計理由・対応方針: あとから確認できるようにDBへ保存する',
        '変更前: 入力結果を画面に表示するだけ', '変更後: APIからDBへ保存し、あとで読み出せるようにする', '次に確かめること: 記録をいつまで残すか',
      ].join('\n');
      await expect(memo).toHaveValue(expected);
      await expect(page.locator('.draft-status')).toHaveAttribute('data-state', 'saved');
      if (mobile) await page.getByRole('button', { name: '要件メモの表示切り替え' }).click();
      await expect(composer).toHaveValue('未送信の質問は残す');
      const file = await download(page);
      const saved = JSON.parse(file.toString('utf8'));
      expect(saved.memo).toBe(expected);
      expect(saved.diagram).toMatchObject(project.diagram);
      expect(saved.chatHistory).toEqual(project.chatHistory);
      await page.reload();
      await page.getByRole('button', { name: /備品の貸し出しを再開/ }).click();
      if (mobile) await page.getByRole('button', { name: '要件メモの表示切り替え' }).click();
      await expect(memo).toHaveValue(expected);
      await page.getByTitle('シナリオ選択画面に戻る').click();
      await page.locator('input[type=file]').setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: file });
      if (mobile) await page.getByRole('button', { name: '要件メモの表示切り替え' }).click();
      await expect(memo).toHaveValue(expected);
      expect(requests).toEqual([]);
    });
  });
}

test('capacity failure preserves input and existing memo; an unconfirmed record can be added after editing the memo', async ({ page }) => {
  const fullMemo = 'あ'.repeat(99995);
  await load(page, fullMemo);
  const trigger = page.getByRole('button', { name: '要件と設計を記録', exact: true });
  const memo = page.getByRole('textbox', { name: '要件メモ', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '要件と設計を記録', exact: true });
  await dialog.getByLabel('条件・確かめたいこと', { exact: true }).fill('保存期間を確かめる');
  await dialog.getByRole('button', { name: 'メモに追加', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('文字数上限');
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(memo).toHaveValue(fullMemo);
  await memo.fill('整理したメモ');
  await trigger.click();
  await expect(dialog.getByLabel('条件・確かめたいこと', { exact: true })).toHaveValue('保存期間を確かめる');
  await dialog.getByRole('button', { name: 'メモに追加', exact: true }).click();
  await expect(memo).toHaveValue('整理したメモ\n\n【未確認】保存期間を確かめる\n関連する部品: 設計全体・まだ決めていない');
});

test('a removed component must be chosen again and dialog shortcuts do not change the graph', async ({ page }) => {
  await load(page);
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
  const trigger = page.getByRole('button', { name: '要件と設計を記録', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '要件と設計を記録', exact: true });
  await dialog.getByLabel('条件・確かめたいこと', { exact: true }).fill('記録を残す');
  await dialog.getByLabel('関連する部品', { exact: false }).selectOption('db');
  await dialog.getByRole('button', { name: '記録を閉じる', exact: true }).focus();
  for (const key of ['Delete', 'Backspace', 'Control+z', 'Meta+z']) await page.keyboard.press(key);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  // Browser text undo may affect the last edited form field, even from a button.
  await dialog.getByLabel('条件・確かめたいこと', { exact: true }).fill('記録を残す');
  await page.keyboard.press('Escape');
  await page.locator('.react-flow__node[data-id=db]').click();
  await page.getByRole('button', { name: 'コンポーネントを削除', exact: true }).click();
  await trigger.click();
  await expect(dialog.getByRole('alert')).toContainText('この部品は削除されました');
  await expect(dialog.getByRole('button', { name: 'メモに追加', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '記録を閉じる', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '閉じる', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '記録を閉じる', exact: true })).toBeFocused();
  await dialog.getByLabel('関連する部品', { exact: false }).selectOption('app');
  await dialog.getByRole('button', { name: 'メモに追加', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '要件メモ', exact: true })).toHaveValue(/関連する部品: 貸出API/);
});
