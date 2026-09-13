import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const gap of [200, 60]) {
test(`renamed nodes keep both connection handles usable with ${gap}px vertical spacing`, async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const project = {
    schemaVersion: 2, version: '1.0', timestamp: '2026-09-13T00:00:00.000Z',
    projectId: 'connection-regression',
    scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠管理' },
    memo: '', chatHistory: [], evaluation: null,
    diagram: { nodes: [
      { id: 'app', type: 'custom', position: { x: 0, y: 0 }, data: { originalType: 'App Server', label: 'API' } },
      { id: 'db', type: 'custom', position: { x: 0, y: gap }, data: { originalType: 'RDBMS (SQL)', label: 'DB' } },
    ], edges: [] },
  };
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'nodes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole('button', { name: 'アーキテクチャ設計', exact: true }).click();
  const source = page.locator('[data-nodeid="app"].source');
  const target = page.locator('[data-nodeid="db"].target');
  // Check both actual hit targets: the badge must neither cover its own input
  // nor intercept the preceding node's output in a compact layout.
  for (const handle of [source, target]) {
    await expect.poll(() => handle.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.ownerDocument.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
    })).toBe(true);
  }
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
}
