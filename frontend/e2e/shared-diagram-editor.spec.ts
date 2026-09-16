import { test, expect, type Page } from '@playwright/test';
import { button, connect, editor, stop } from './course-canvas-helpers';
import { newStageProgress, STAGE_STORAGE_KEY as key } from '../src/utils/componentStages';
import { addPart } from '../src/utils/courseDiagram';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

async function browserLesson(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  await button(page, 'Web Browserの学習を始める');
}
async function appearance(page: Page) {
  return page.locator('.react-flow__node[data-id="browser-1"] .canvas-node').evaluate(element => {
    const computed = element.ownerDocument.defaultView!.getComputedStyle.bind(element.ownerDocument.defaultView);
    const style = computed(element);
    return { background: style.backgroundColor, borderRadius: style.borderRadius, padding: style.padding, minWidth: style.minWidth,
      labelSize: computed(element.querySelector('.canvas-node-name')!).fontSize,
      handles: [...element.querySelectorAll('.react-flow__handle')].map(h => ({ side: h.classList.contains('react-flow__handle-top') ? 'top' : 'bottom', size: computed(h).width })) };
  });
}
async function capture(page: Page, name: string) {
  if (!process.env.COURSE_CAPTURE_DIR) return;
  await mkdir(process.env.COURSE_CAPTURE_DIR, { recursive: true });
  await page.screenshot({ path: join(process.env.COURSE_CAPTURE_DIR, name + '.png'), fullPage: true, animations: 'disabled' });
}
for (const touch of [false, true]) test.describe(touch ? 'touch shared editor' : 'desktop shared editor', () => {
  test.use({ viewport: touch ? { width: 390, height: 844 } : { width: 1255, height: 963 }, hasTouch: touch, isMobile: touch });
  test('learning and free design render identical parts and connection handles', async ({ page }) => {
    await browserLesson(page);
    await expect(page.locator('.learning-part')).toHaveCount(0);
    const learning = await appearance(page);
    expect(learning.handles).toEqual([{ side: 'top', size: touch ? '28px' : '20px' }, { side: 'bottom', size: touch ? '28px' : '20px' }]);
    if (!touch) await capture(page, 'shared-learning');
    const project = {
      schemaVersion: 2, version: '1.0', timestamp: '2026-09-15T00:00:00Z', projectId: 'shared-node-comparison',
      scenario: { id: 'internal_tool', title: '社内勤怠管理システム', description: '勤怠管理' }, memo: '', chatHistory: [], evaluation: null,
      diagram: { nodes: [{ id: 'browser-1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Web Browser', originalType: 'Web Browser' } }], edges: [] },
    };
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({ name: 'same-part.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await button(page, 'アーキテクチャ設計');
    expect(await appearance(page)).toEqual(learning);
    if (!touch) await capture(page, 'shared-free-design');
  });
});

test('learning shares delete and history shortcuts, preserves its fixture and never undoes diagram edits from a form control', async ({ page }) => {
  await browserLesson(page); await connect(page, 'browser-1', 'responder');
  await page.getByRole('combobox', { name: '部品・接続を選ぶ', exact: true }).selectOption('responder');
  const fixture = page.locator('.react-flow__node[data-id="responder"]');
  await fixture.focus(); await page.keyboard.press('Delete');
  await expect(fixture).toHaveCount(1); await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '選択を削除', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: '部品・接続を選ぶ', exact: true }).selectOption('browser-1');
  await page.getByRole('combobox', { name: '接続元', exact: true }).press('ControlOrMeta+z');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  const node = page.locator('.react-flow__node[data-id="browser-1"]');
  await node.focus(); await page.keyboard.press('Delete');
  await expect(node).toHaveCount(0); await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.locator('.react-flow')).toBeFocused(); await page.keyboard.press('ControlOrMeta+z');
  await expect(node).toHaveCount(1); await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await node.focus(); await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(node).toHaveCount(0); await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await page.locator('.learning-flow').click({ position: { x: 10, y: 10 } }); await page.keyboard.press('ControlOrMeta+z');
  await expect(node).toHaveCount(1); await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});

test('stops share undo and redo while trace display does not enter history or v4 storage', async ({ page }) => {
  const p = newStageProgress(); p.cleared = ['browser', 'app', 'database', 'balancer', 'cache', 'queue']; p.current = 'worker'; p.view = 'learn';
  p.diagrams['worker-learn'] = addPart(p.diagrams['worker-learn'], 'worker', 'worker');
  await page.goto('/'); await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p });
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  await connect(page, 'queue-1', 'worker-1'); await stop(page, 'worker-1', false);
  await expect(page.locator('[data-id="worker-1"] .canvas-node-status')).toHaveCount(0);
  await button(page, '元に戻す'); await expect(page.locator('[data-id="worker-1"] .canvas-node-status')).toHaveText('停止中');
  await button(page, 'やり直す'); await expect(page.locator('[data-id="worker-1"] .canvas-node-status')).toHaveCount(0);
  await button(page, '1件処理する');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).diagrams['worker-learn'], key);
  await button(page, '次の動き');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).diagrams['worker-learn'], key)).toEqual(saved);
  await button(page, '元に戻す'); await expect(page.locator('[data-id="worker-1"] .canvas-node-status')).toHaveText('停止中');
  for (const n of saved.nodes) expect(Object.keys(n).sort()).toEqual(['id', 'kind', 'stopped', 'x', 'y']);
  await page.reload(); await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  await editor(page); await expect(page.locator('[data-id="worker-1"] .canvas-node-status')).toHaveText('停止中');
});
