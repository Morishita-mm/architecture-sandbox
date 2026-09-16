import { test, expect } from '@playwright/test';
import { newStageProgress, STAGE_STORAGE_KEY as key } from '../src/utils/componentStages';
import { addPart, connectParts, diagramSignature } from '../src/utils/courseDiagram';
import { labLessons } from '../src/constants/courseCurriculum';
import { button, remove } from './course-canvas-helpers';

for (const touch of [false, true]) test.describe(touch ? 'touch vertical course' : 'desktop vertical course', () => {
  test.use({ viewport: touch ? { width: 390, height: 844 } : { width: 1255, height: 963 }, hasTouch: touch, isMobile: touch });
  test('an existing practice can be arranged vertically, undone, redone and restored without changing its work', async ({ page }) => {
    const p = newStageProgress(); p.cleared = ['browser', 'app', 'database', 'balancer']; p.current = 'balancer'; p.view = 'practice';
    let g = addPart(addPart(p.diagrams['balancer-practice'], 'balancer', 'app'), 'balancer', 'balancer');
    g.edges = g.edges.filter(e => e.id !== 'browser-1--app-1');
    for (const [s,t] of [['browser-1','balancer-1'],['balancer-1','app-1'],['balancer-1','app-2'],['app-2','database-1']]) g = connectParts(g,s,t);
    g.nodes.forEach((n,i) => { n.x = i * 240; n.y = 150; }); g.checked = diagramSignature(g); p.diagrams['balancer-practice'] = g;
    p.diagrams['balancer-learn'] = structuredClone(g); p.diagrams.estimate.checked = diagramSignature(p.diagrams.estimate);
    for (const id of ['estimate', 'balance'] as const) { p.learning.labs[id].observed = labLessons[id].checks.map(c => c.id); p.learning.labs[id].answer = labLessons[id].correct; }
    await page.goto('/'); await page.evaluate(({key,p}) => localStorage.setItem(key,JSON.stringify(p)),{key,p});
    await page.getByRole('button',{name:/部品の役割から学ぶ/}).click();
    const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!),key);
    await expect(page.locator('.react-flow__node')).toHaveCount(5);
    const before = await saved(); expect(before.diagrams['balancer-practice']).toEqual(g);
    await button(page,'縦に整列');
    await expect.poll(async () => (await saved()).diagrams['balancer-practice'].nodes[0].y).not.toBe(150);
    const after = await saved(), arranged = after.diagrams['balancer-practice'];
    expect({ ...after, diagrams: { ...after.diagrams, 'balancer-practice': g } }).toEqual(before);
    expect(arranged.edges).toEqual(g.edges); expect(arranged.checked).toBe(g.checked);
    for (const e of arranged.edges) expect(arranged.nodes.find((n: {id:string}) => n.id === e.target).y).toBeGreaterThan(arranged.nodes.find((n: {id:string}) => n.id === e.source).y);
    const apps = arranged.nodes.filter((n: {kind:string}) => n.kind === 'app'); expect(apps[0].y).toBe(apps[1].y); expect(Math.abs(apps[0].x-apps[1].x)).toBeGreaterThan(208);
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    await button(page,'元に戻す'); await expect.poll(async () => (await saved()).diagrams['balancer-practice']).toEqual(g);
    await button(page,'やり直す'); await expect.poll(async () => (await saved()).diagrams['balancer-practice']).toEqual(arranged);
    await page.reload(); await page.getByRole('button',{name:/部品の役割から学ぶ/}).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(5); expect((await saved()).diagrams['balancer-practice']).toEqual(arranged);
    await remove(page,'app-2'); await button(page,'縦に整列');
    const single = (await saved()).diagrams['balancer-practice'];
    await button(page,'App Serverを追加'); await expect(page.locator('.react-flow__node')).toHaveCount(5);
    const paired = (await saved()).diagrams['balancer-practice'];
    expect(paired.nodes.find((n: {id:string}) => n.id === 'app-1').x).not.toBe(single.nodes.find((n: {id:string}) => n.id === 'app-1').x);
    await button(page,'元に戻す'); await expect.poll(async () => (await saved()).diagrams['balancer-practice']).toEqual(single);
    await button(page,'やり直す'); await expect.poll(async () => (await saved()).diagrams['balancer-practice']).toEqual(paired);
  });
});
