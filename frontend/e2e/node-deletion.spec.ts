import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const project = {
  schemaVersion: 2, version: '1.0', timestamp: '2026-09-13T00:00:00.000Z',
  projectId: 'deletion-regression',
  scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠管理' },
  memo: '', chatHistory: [], evaluation: null,
  diagram: {
    nodes: [
      { id: 'app', type: 'custom', position: { x: 0, y: 0 }, style: { zIndex: 10 }, data: { originalType: 'App Server', label: 'API', description: '' } },
      { id: 'db', type: 'custom', position: { x: 0, y: 200 }, style: { zIndex: 10 }, data: { originalType: 'RDBMS (SQL)', label: 'DB', description: '' } },
    ],
    edges: [{ id: 'app-db', source: 'app', target: 'db' }],
  },
};

async function load(page: Page, data: unknown = project) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'design.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
}

async function save(page: Page): Promise<typeof project> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存' }).click();
  const path = await (await download).path();
  if (!path) throw new Error('Missing saved project');
  return JSON.parse(await readFile(path, 'utf8'));
}

for (const key of ['Delete', 'Backspace']) {
  test(`${key} deletes only the most recently dropped component without another click`, async ({ page }) => {
    await load(page, { ...project, diagram: { nodes: [], edges: [] } });
    const pane = page.locator('.react-flow__pane');
    await page.locator('.dndnode').getByText('Web Server', { exact: true }).dragTo(pane, { targetPosition: { x: 60, y: 100 } });
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await page.locator('.dndnode').getByText('App Server', { exact: true }).dragTo(pane, { targetPosition: { x: 60, y: 250 } });
    await expect(page.getByPlaceholder('名前を入力...')).toHaveValue('App Server');
    await page.keyboard.press(key);
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.getByPlaceholder('名前を入力...')).toBeHidden();
    expect((await save(page)).diagram.nodes.map(node => node.data.label)).toEqual(['Web Server']);
  });

  test(`${key} deletes a selected component and its connections`, async ({ page }) => {
    await load(page);
    await page.locator('.react-flow__node[data-id="app"]').click();
    await page.keyboard.press(key);
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
    await expect(page.getByPlaceholder('名前を入力...')).toBeHidden();
    expect((await save(page)).diagram).toEqual({ nodes: [project.diagram.nodes[1]], edges: [] });
  });
}

test('delete button removes the component and connections from saved and restored projects', async ({ page }) => {
  await load(page);
  await page.locator('.react-flow__node[data-id="app"]').click();
  await page.getByRole('button', { name: 'コンポーネントを削除', exact: true }).click();
  await expect(page.getByPlaceholder('名前を入力...')).toBeHidden();
  const saved = await save(page);
  expect(saved.diagram).toEqual({ nodes: [project.diagram.nodes[1]], edges: [] });
  await load(page, saved);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__node[data-id="db"]')).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});

test('deleting a group removes its children and their connections without affecting other nodes', async ({ page }) => {
  await load(page, {
    ...project,
    diagram: {
      nodes: [
        { id: 'group', type: 'group', position: { x: 0, y: 0 }, style: { width: 300, height: 200 }, data: { originalType: 'VPC (Network)', label: 'VPC' } },
        { ...project.diagram.nodes[0], parentNode: 'group', extent: 'parent', position: { x: 30, y: 60 } },
        { ...project.diagram.nodes[1], position: { x: 0, y: 350 } },
      ],
      edges: project.diagram.edges,
    },
  });
  await page.locator('.react-flow__node[data-id="group"]').getByText('VPC', { exact: true }).click();
  await expect(page.getByText('グループ内のコンポーネントと接続線も削除されます。')).toBeVisible();
  await page.getByRole('button', { name: 'グループを削除', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  expect((await save(page)).diagram).toEqual({ nodes: [{ ...project.diagram.nodes[1], position: { x: 0, y: 350 } }], edges: [] });
});

test('deletion keys edit text and cannot delete the hidden design from other tabs', async ({ page }) => {
  await load(page);
  await page.locator('.react-flow__node[data-id="app"]').click();
  const label = page.getByPlaceholder('名前を入力...');
  await label.fill('APIx');
  await label.press('Backspace');
  await expect(label).toHaveValue('API');
  await label.press('Home');
  await label.press('Delete');
  await expect(label).toHaveValue('PI');
  const description = page.getByPlaceholder('役割や詳細設定などを記述...');
  await description.fill('Memo!');
  await description.press('Backspace');
  await expect(description).toHaveValue('Memo');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  for (const name of ['要件定義・交渉', '評価結果']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    expect((await save(page)).diagram.nodes).toHaveLength(2);
  }
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
  await page.locator('.react-flow__node[data-id="app"]').click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});
