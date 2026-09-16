import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const project = {
  schemaVersion: 2, version: '1.0', timestamp: '2026-09-14T00:00:00.000Z', projectId: 'learning-test',
  scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠' }, memo: '', chatHistory: [], evaluation: null,
  diagram: { nodes: [
    { id: 'app', type: 'custom', position: { x: 40, y: 40 }, data: { originalType: 'App Server', label: '受付API', description: '' } },
    { id: 'db', type: 'custom', position: { x: 40, y: 240 }, data: { originalType: 'RDBMS (SQL)', label: '勤怠DB', description: '' } },
  ], edges: [{ id: 'link', source: 'app', target: 'db' }] },
};
const result = { totalScore: 85, details: { availability: 80, scalability: 80, security: 80, maintainability: 90, costEfficiency: 90, feasibility: 90 }, feedback: '構成を確認しました。', improvement: '復元方針を確認しましょう。' };

async function visit(page: Page) {
  await page.route('**/*', route => {
    if (route.request().url().endsWith('/api/evaluate')) return route.fulfill({ json: result });
    return new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/');
}
async function load(page: Page, data: unknown = project) {
  await visit(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'design.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}
async function design(page: Page) { await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click(); }
async function exported(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存', exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}
async function exportDraftFile(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSONファイルを保存', exact: true }).click();
  const download = await downloading;
  const buffer = await readFile((await download.path())!);
  return { name: download.suggestedFilename(), buffer, project: JSON.parse(buffer.toString('utf8')) };
}
async function storedDrafts(page: Page) {
  return page.evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('architecture-sandbox-drafts', 1);
    request.onsuccess = () => {
      const db = request.result;
      const rows = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      rows.onsuccess = () => { db.close(); resolve(rows.result); };
      rows.onerror = () => { db.close(); reject(rows.error); };
    };
    request.onerror = () => reject(request.error);
  })`);
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'touch draft backup' : 'desktop draft backup', () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1255, height: 963 }, hasTouch: mobile, isMobile: mobile });

    test('download from deletion confirmation preserves the draft and restores the work after deletion', async ({ page }) => {
      const data = {
        ...project,
        scenario: { id: 'custom', title: '貸出の記録', description: '貸した備品と返却日を記録する。', isCustom: true, difficulty: 'small', partnerRole: 'ceo' },
        memo: '返却日の通知は未確認。\n貸出記録を保存する。',
        chatHistory: [{ role: 'user', content: '記録はあとでも必要ですか？' }, { role: 'model', content: '返却を確認するために必要です。' }],
        diagram: { ...project.diagram, nodes: project.diagram.nodes.map(node => ({ ...node, data: { ...node.data, description: '貸出記録をあとで確認できるようにする。' } })) },
      };
      await load(page, data);
      await page.getByTitle('シナリオ選択画面に戻る').click();
      const before = await storedDrafts(page);
      await page.getByRole('button', { name: '貸出の記録の保存データを削除', exact: true }).click();
      const file = await exportDraftFile(page);
      // Importing opens the next working version; exporting the draft keeps that version.
      expect(file.name).toBe('貸出の記録_v2.0.json');
      expect(file.project).toMatchObject({ schemaVersion: 2, projectId: data.projectId, version: '2.0', scenario: data.scenario, memo: data.memo, chatHistory: data.chatHistory, diagram: data.diagram, evaluation: null });
      await expect(page.getByRole('status')).toContainText('JSONのダウンロードを開始しました');
      await expect(page.getByRole('button', { name: /貸出の記録を再開/ })).toBeVisible();
      expect(await storedDrafts(page)).toEqual(before);
      expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
      await page.getByRole('button', { name: 'ブラウザから削除する', exact: true }).click();
      await expect(page.getByRole('button', { name: /貸出の記録を再開/ })).toBeHidden();
      await page.reload();
      await expect(page.getByRole('button', { name: /貸出の記録を再開/ })).toBeHidden();
      await page.locator('input[type=file]').setInputFiles({ name: file.name, mimeType: 'application/json', buffer: file.buffer });
      await expect(page.getByText('記録はあとでも必要ですか？', { exact: true })).toBeVisible();
      await expect(page.getByText('返却を確認するために必要です。', { exact: true })).toBeVisible();
      if (mobile) await page.getByRole('button', { name: '要件メモの表示切り替え' }).click();
      await expect(page.getByRole('textbox', { name: '要件メモ', exact: true })).toHaveValue(data.memo);
      if (mobile) await page.getByRole('button', { name: '要件メモの表示切り替え' }).click();
      await design(page);
      if (mobile) {
        const components = page.getByRole('button', { name: 'コンポーネントの表示切り替え' });
        await expect(components).toHaveAttribute('aria-expanded', 'true');
        await components.click();
      }
      await expect(page.locator('.react-flow__node')).toHaveCount(2);
      await expect(page.locator('.react-flow__edge')).toHaveCount(1);
      await page.locator('.react-flow__node[data-id=db]').click();
      await expect(page.getByLabel('役割のメモ（任意）', { exact: true })).toHaveValue(data.diagram.nodes[1].data.description);
    });
  });
}

test('draft downloads include only an evaluation matched to the saved design', async ({ page }) => {
  await load(page, { ...project, evaluation: result });
  const homeExport = async () => {
    await page.getByTitle('シナリオ選択画面に戻る').click();
    await page.getByRole('button', { name: '社内勤怠管理システムの保存データを削除', exact: true }).click();
    return (await exportDraftFile(page)).project;
  };
  expect((await homeExport()).evaluation).toBeNull();
  await expect(page.getByRole('status')).toContainText('変更前・対応未確認の評価は含めていません');
  await page.getByRole('button', { name: /社内勤怠管理システムを再開/ }).click();
  await design(page);
  await page.getByRole('button', { name: '設計完了（評価する）', exact: true }).click();
  await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
  expect((await homeExport()).evaluation).toEqual(result);
  await page.getByRole('button', { name: /社内勤怠管理システムを再開/ }).click();
  await design(page);
  await page.locator('.react-flow__node[data-id=db]').click();
  await page.getByLabel('役割のメモ（任意）', { exact: true }).fill('復元の手順を変更した');
  const stale = await homeExport();
  expect(stale.evaluation).toBeNull();
  expect(stale.diagram.nodes.find((node: { id: string }) => node.id === 'db').data.description).toBe('復元の手順を変更した');
});

test('a failed draft download shows an error and allows retry without deleting the draft', async ({ page }) => {
  await load(page);
  await page.getByTitle('シナリオ選択画面に戻る').click();
  await page.getByRole('button', { name: '社内勤怠管理システムの保存データを削除', exact: true }).click();
  const before = await storedDrafts(page);
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => { URL.createObjectURL = original; throw new Error('Simulated download failure'); };
  });
  await page.getByRole('button', { name: 'JSONファイルを保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('JSONファイルを保存できませんでした');
  expect(await storedDrafts(page)).toEqual(before);
  expect((await exportDraftFile(page)).project.projectId).toBe(project.projectId);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('JSONのダウンロードを開始しました');
  expect(await storedDrafts(page)).toEqual(before);
});

test('mobile opens the conversation without a memo overlay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await visit(page);
  await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
  await page.getByRole('button', { name: /^社内勤怠管理システム/ }).click();
  await expect(page.getByRole('textbox', { name: 'メッセージ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'サイドパネルを閉じる' })).toBeHidden();
  await expect(page.getByRole('button', { name: '要件メモの表示切り替え' })).toHaveAttribute('aria-expanded', 'false');
  await design(page);
  await page.getByRole('button', { name: '要件定義・交渉', exact: true }).click();
  await expect(page.getByRole('button', { name: 'サイドパネルを閉じる' })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'メッセージ', exact: true })).toBeVisible();
});

test.describe('touch connection targets', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('connection points use the larger touch size', async ({ page }) => {
    await load(page); await design(page);
    await page.getByRole('button', { name: 'コンポーネントの表示切り替え' }).tap();
    await expect(page.locator('.react-flow__handle').first()).toHaveCSS('width', '28px');
    await expect(page.locator('.react-flow__handle').first()).toHaveCSS('height', '28px');
  });
});

test('component explanations work before adding, and Japanese search includes advanced types', async ({ page }) => {
  await load(page); await design(page);
  const sidebar = page.getByRole('complementary', { name: 'コンポーネント', exact: true });
  await expect(sidebar.getByRole('button', { name: '基本の8種類に戻す' })).toHaveAttribute('aria-pressed', 'true');
  await sidebar.getByRole('button', { name: '基本の8種類に戻す' }).click();
  await expect(sidebar.locator('.dndnode')).toHaveCount(8);
  const info = sidebar.getByRole('button', { name: 'Message Queueの説明', exact: true });
  await info.focus(); await info.press('Enter');
  const help = page.getByRole('dialog', { name: 'Message Queue', exact: true });
  await expect(help.getByText('誰が受け取り、失敗した仕事をどう再実行しますか？')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(info).toBeFocused();
  await sidebar.getByRole('searchbox', { name: '部品を検索' }).fill('関係をたどる');
  await expect(sidebar.getByRole('button', { name: 'NoSQL (Graph)', exact: true })).toBeVisible();
  await sidebar.getByRole('searchbox').fill('該当なしの部品');
  await expect(sidebar.getByText(/該当する部品がありません/)).toBeVisible();
});

test('deletion, connection and description edits can be undone and redone', async ({ page }) => {
  await load(page); await design(page);
  await page.locator('.react-flow__node[data-id=db]').click();
  await page.getByRole('button', { name: 'コンポーネントを削除', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await page.locator('.react-flow__node[data-id=db]').click();
  const description = page.getByLabel('役割のメモ（任意）', { exact: true });
  await description.fill('バックアップから復元する');
  await page.getByRole('button', { name: 'プロパティを閉じる' }).click();
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await page.locator('.react-flow__node[data-id=db]').click();
  await expect(description).toHaveValue('');
  expect((await exported(page)).diagram.edges).toHaveLength(1);
});

test('connections can be added from labelled controls and have a direction and readable name', async ({ page }) => {
  await load(page, { ...project, diagram: { ...project.diagram, edges: [] } }); await design(page);
  await expect(page.locator('.react-flow__handle').first()).toHaveCSS('width', '20px');
  const source = page.locator('.react-flow__node[data-id=app]');
  await expect(source).toBeVisible();
  await source.focus();
  await expect(source).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('表示名', { exact: true })).toBeFocused();
  const target = page.getByLabel('この部品からの接続先', { exact: true });
  await target.selectOption('db'); await target.press('Tab');
  await expect(page.getByRole('button', { name: '接続を追加' })).toBeFocused();
  await page.keyboard.press('Enter');
  // A vertical SVG path has a zero-width geometry box even though its stroke is visible.
  await expect(page.getByRole('button', { name: '受付APIから勤怠DBへの接続', exact: true })).toBeAttached();
  await expect(page.locator('.react-flow__edge-path')).toHaveAttribute('marker-end', /arrowclosed/);
  expect(await page.locator('.react-flow__edge-path').evaluate(path => (path as unknown as { getTotalLength(): number }).getTotalLength())).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '接続を追加' })).toBeDisabled();
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});

test('autosave restores memo, topology and details after reload', async ({ page }) => {
  await load(page);
  await page.getByRole('textbox', { name: '要件メモ', exact: true }).fill('復元できることを確認する');
  await design(page);
  await page.locator('.react-flow__node[data-id=db]').click();
  await page.getByLabel('役割のメモ（任意）', { exact: true }).fill('復元手順を定期確認する');
  await expect(page.locator('.draft-status')).toHaveAttribute('data-state', 'saved');
  await page.reload();
  await page.getByRole('button', { name: /社内勤怠管理システムを再開/ }).click();
  await expect(page.getByRole('textbox', { name: '要件メモ', exact: true })).toHaveValue('復元できることを確認する');
  await design(page);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.locator('.react-flow__node[data-id=db]').click();
  await expect(page.getByLabel('役割のメモ（任意）', { exact: true })).toHaveValue('復元手順を定期確認する');
});

test('a changed graph marks the report stale, excludes it from export, and undo restores its correspondence', async ({ page }) => {
  await load(page); await design(page);
  await page.getByRole('button', { name: '設計完了（評価する）', exact: true }).click();
  await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
  await expect(page.getByRole('button', { name: '結果をシェア', exact: true })).toBeEnabled();
  await design(page);
  await page.locator('.react-flow__node[data-id=db]').click();
  await page.getByRole('button', { name: 'コンポーネントを削除', exact: true }).click();
  await page.getByRole('button', { name: '評価結果', exact: true }).click();
  await expect(page.getByText(/^変更前の設計に対する評価です/)).toBeVisible();
  await expect(page.getByRole('button', { name: '結果をシェア', exact: true })).toBeDisabled();
  expect((await exported(page)).evaluation).toBeNull();
  await design(page); await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await page.getByRole('button', { name: '評価結果', exact: true }).click();
  await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
  await expect(page.locator('.draft-status')).toHaveAttribute('data-state', 'saved');
  await page.reload();
  await page.getByRole('button', { name: /社内勤怠管理システムを再開/ }).click();
  await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
});

test('a report imported from JSON remains unverified until this design is evaluated', async ({ page }) => {
  await load(page, { ...project, evaluation: result });
  await expect(page.getByText(/^読み込んだ評価です/)).toBeVisible();
  await expect(page.getByRole('button', { name: '結果をシェア', exact: true })).toBeDisabled();
  expect((await exported(page)).evaluation).toBeNull();
  await design(page);
  await page.getByRole('button', { name: '設計完了（評価する）', exact: true }).click();
  await expect(page.getByText(/^現在の設計に対する評価です/)).toBeVisible();
  await expect(page.getByRole('button', { name: '結果をシェア', exact: true })).toBeEnabled();
});

test('storage failures stay visible and do not prevent downloading a JSON backup', async ({ page }) => {
  await page.addInitScript("Object.defineProperty(indexedDB, 'open', { value() { throw new DOMException('Blocked', 'QuotaExceededError'); } });");
  await load(page);
  await expect(page.locator('.draft-status')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('button', { name: '保存を再試行' })).toBeVisible();
  expect((await exported(page)).diagram.nodes).toHaveLength(2);
  await page.getByTitle('シナリオ選択画面に戻る').click();
  await expect(page.getByText('保存できなかった変更は失われます。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'ブラウザに保存せずホームへ戻る', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Architecture Sandbox', exact: true })).toBeVisible();
});

test('a saved draft can be deleted with confirmation without deleting another project', async ({ page }) => {
  await load(page);
  await page.getByTitle('シナリオ選択画面に戻る').click();
  await page.getByRole('button', { name: /設計課題に取り組む/ }).click();
  await page.getByRole('button', { name: /^画像投稿SNS.*設計を開始/ }).click();
  await page.getByTitle('シナリオ選択画面に戻る').click();
  await page.getByRole('button', { name: '社内勤怠管理システムの保存データを削除', exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.getByRole('button', { name: /社内勤怠管理システムを再開/ })).toBeVisible();
  await page.getByRole('button', { name: '社内勤怠管理システムの保存データを削除', exact: true }).click();
  await page.getByRole('button', { name: 'ブラウザから削除する', exact: true }).click();
  await expect(page.getByRole('button', { name: /社内勤怠管理システムを再開/ })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: /社内勤怠管理システムを再開/ })).toBeHidden();
  await expect(page.getByRole('button', { name: /画像投稿SNS.*を再開/ })).toBeVisible();
});

test('an unreadable draft does not hide other recoverable projects', async ({ page }) => {
  await load(page);
  await expect(page.locator('.draft-status')).toHaveAttribute('data-state', 'saved');
  await page.evaluate(`(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('architecture-sandbox-drafts', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('projects', 'readwrite');
        tx.objectStore('projects').put({ project: { projectId: 'corrupt', schemaVersion: 999 } });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      request.onerror = () => reject(request.error);
    });
  })()`);
  await page.reload();
  await expect(page.getByText(/1件の保存データを読み込めませんでした/)).toBeVisible();
  await page.getByRole('button', { name: /社内勤怠管理システムを再開/ }).click();
  await design(page);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});
