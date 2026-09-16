import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { newStageProgress, STAGE_STORAGE_KEY as key } from '../src/utils/componentStages';
import { stageIds, type StageId } from '../src/constants/componentStages';
import { addPart, connectParts } from '../src/utils/courseDiagram';
import { button } from './course-canvas-helpers';

async function openLesson(page: Page, p: ReturnType<typeof newStageProgress>) {
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' && !new URL(r.request().url()).pathname.startsWith('/api/') ? r.continue() : r.abort());
  await page.goto('/'); await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p });
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
}
function lesson(stage: StageId) {
  const p = newStageProgress(); p.current = stage; p.view = 'learn'; p.cleared = stageIds.slice(0, stageIds.indexOf(stage));
  return p;
}
async function capture(page: Page, name: string) {
  if (!process.env.MOTION_CAPTURE_DIR) return;
  await mkdir(process.env.MOTION_CAPTURE_DIR, { recursive: true });
  await page.locator('.learning-canvas').screenshot({ path: join(process.env.MOTION_CAPTURE_DIR, `${page.viewportSize()!.width}-${name}.png`) });
}
async function motionSamples(page: Page): Promise<number[]> {
  // Exercise the actual browser animation at controlled instants, not a copy of the routing math.
  return page.evaluate(`(async () => {
    const packet = document.querySelector('.diagram-packet');
    const animation = packet.getAnimations()[0];
    if (!animation) throw new Error('Expected a packet animation');
    animation.pause();
    const samples = [];
    for (let time = 0; time <= 1200; time += 100) {
      animation.currentTime = time;
      await new Promise(requestAnimationFrame);
      const box = packet.getBoundingClientRect();
      samples.push(box.y + box.height / 2);
    }
    return samples;
  })()`);
}
for (const offset of [0, 240]) test(`a short ${offset ? 'bent' : 'straight'} wire never doubles back during sending or responding`, async ({ page }) => {
  await page.setViewportSize({ width: 1255, height: 963 });
  const p = lesson('app');
  const g = connectParts(p.diagrams['app-learn'], 'browser-1', 'app-1');
  g.nodes[0].x = 300; g.nodes[0].y = 40; g.nodes[1].x = 300 + offset; g.nodes[1].y = 155;
  p.diagrams['app-learn'] = g;
  await openLesson(page, p);
  const browser = (await page.locator('[data-id="browser-1"] .canvas-node').boundingBox())!;
  const app = (await page.locator('[data-id="app-1"] .canvas-node').boundingBox())!;
  expect(app.y - browser.y - browser.height).toBeGreaterThan(0);
  expect(app.y - browser.y - browser.height).toBeLessThan(56);
  const path = await page.evaluate<number[]>(`(() => {
    const path = document.querySelector('.react-flow__edge-path');
    const length = path.getTotalLength();
    return Array.from({length:101}, (_, i) => path.getPointAtLength(length * i / 100).y);
  })()`);
  for (let i = 1; i < path.length; i++) expect(path[i]).toBeGreaterThanOrEqual(path[i - 1] - .01);
  await button(page, '会場を調べる');
  await expect(page.locator('.diagram-packet')).toHaveAttribute('data-direction', 'forward');
  await button(page, '一時停止');
  await expect(page.locator('.learning-playback-phase')).toContainText('要求（送信）');
  const forward = await motionSamples(page);
  expect(forward.at(-1)! - forward[0]).toBeGreaterThan(5);
  for (let i = 1; i < forward.length; i++) expect(forward[i]).toBeGreaterThanOrEqual(forward[i - 1] - .1);
  await button(page, '次の動き');
  await expect(page.locator('.diagram-packet')).toHaveCount(0);
  await button(page, '次の動き');
  await expect(page.locator('.diagram-packet')).toHaveAttribute('data-direction', 'reverse');
  await expect(page.locator('.learning-playback-phase')).toContainText('返事（応答）');
  const reverse = await motionSamples(page);
  expect(reverse[0] - reverse.at(-1)!).toBeGreaterThan(5);
  for (let i = 1; i < reverse.length; i++) expect(reverse[i]).toBeLessThanOrEqual(reverse[i - 1] + .1);
});

for (const touch of [false, true]) test.describe(touch ? 'touch sample spacing' : 'desktop sample spacing', () => {
  test.use({ viewport: touch ? { width: 390, height: 844 } : { width: 1255, height: 963 }, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
  test('intro samples leave a readable travel lane and distinguish sending from responding', async ({ page }) => {
    for (const stage of ['browser', 'app'] as const) {
      const p = lesson(stage), target = stage === 'browser' ? 'responder' : 'app-1';
      p.diagrams[`${stage}-learn`] = connectParts(p.diagrams[`${stage}-learn`], 'browser-1', target);
      await openLesson(page, p);
      const browser = (await page.locator('[data-id="browser-1"] .canvas-node').boundingBox())!;
      const other = (await page.locator(`[data-id="${target}"] .canvas-node`).boundingBox())!;
      expect(other.y - browser.y - browser.height).toBeGreaterThan(110);
      await button(page, '会場を調べる'); await button(page, '次の動き');
      await expect(page.locator('.diagram-packet')).toHaveCSS('animation-name', 'none');
      await expect(page.locator('.diagram-packet')).toHaveAttribute('data-kind', 'request');
      await capture(page, `${stage}-request`);
      await button(page, '次の動き'); await button(page, '次の動き');
      await expect(page.locator('.diagram-packet')).toHaveAttribute('data-kind', 'response');
      await capture(page, `${stage}-response`);
      expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    }
  });
  test('parallel samples have aligned app branches and room between cards', async ({ page }) => {
    const p = lesson('balancer');
    let g = addPart(addPart(p.diagrams['balancer-learn'], 'balancer', 'app'), 'balancer', 'balancer');
    g.edges = g.edges.filter(e => e.id !== 'browser-1--app-1');
    for (const [s, t] of [['browser-1', 'balancer-1'], ['balancer-1', 'app-1'], ['balancer-1', 'app-2'], ['app-2', 'database-1']]) g = connectParts(g, s, t);
    p.diagrams['balancer-learn'] = g;
    await openLesson(page, p);
    const a = (await page.locator('[data-id="app-1"] .canvas-node').boundingBox())!;
    const b = (await page.locator('[data-id="app-2"] .canvas-node').boundingBox())!;
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    expect(b.x - a.x - a.width).toBeGreaterThan(touch ? 45 : 80);
    await capture(page, 'parallel');
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  });
});
