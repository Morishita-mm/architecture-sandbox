import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('renamed nodes keep their incoming connection handle visible and usable', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const project = {
    schemaVersion: 2, version: '1.0', timestamp: '2026-09-13T00:00:00.000Z',
    projectId: 'connection-regression',
    scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠管理' },
    memo: '', chatHistory: [], evaluation: null,
    diagram: { nodes: [
      { id: 'app', type: 'custom', position: { x: 0, y: 0 }, data: { originalType: 'App Server', label: 'API' } },
      { id: 'db', type: 'custom', position: { x: 0, y: 200 }, data: { originalType: 'RDBMS (SQL)', label: 'DB' } },
    ], edges: [] },
  };
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'nodes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
  const source = page.locator('[data-nodeid="app"].source');
  const target = page.locator('[data-nodeid="db"].target');
  // A renamed type badge previously covered the target: visible in the DOM,
  // but impossible to hit with the pointer. Check actual hit testing.
  await expect.poll(() => target.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.ownerDocument.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
  })).toBe(true);
  await source.hover();
  await page.mouse.down();
  await target.hover();
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存' }).click();
  const path = await (await download).path();
  if (!path) throw new Error('Missing saved project');
  const saved = JSON.parse(await readFile(path, 'utf8'));
  expect(saved.diagram.edges).toEqual([expect.objectContaining({ source: 'app', target: 'db' })]);
});
