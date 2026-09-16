import { test, expect } from '@playwright/test';
import { button, editor, connect, remove } from './course-canvas-helpers';
import { newStageProgress, STAGE_STORAGE_KEY as key } from '../src/utils/componentStages';
import { connectParts, diagramSignature } from '../src/utils/courseDiagram';

test('canvas supports handles, pointer and keyboard moves, undo/redo and restoration without opening later parts', async ({ page }) => {
  await page.setViewportSize({ width: 1255, height: 963 }); await page.goto('/');
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click(); await button(page,'Web Browserの学習を始める');
  await expect(page.locator('.learning-palette-items button')).toHaveCount(1);
  const from=page.locator('[data-id="browser-1"] .react-flow__handle.source'), to=page.locator('[data-id="responder"] .react-flow__handle.target');
  await from.scrollIntoViewIfNeeded(); const a=(await from.boundingBox())!, b=(await to.boundingBox())!;
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down(); await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12}); await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  const node=page.locator('.react-flow__node[data-id="browser-1"]'); const initial=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).diagrams['browser-learn'],key);
  const n=(await node.locator('.canvas-node-heading').boundingBox())!; await page.mouse.move(n.x+n.width/2,n.y+n.height/2); await page.mouse.down(); await page.mouse.move(n.x+n.width/2+70,n.y+n.height/2-45,{steps:10}); await page.mouse.up();
  const moved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).diagrams['browser-learn'],key); expect(moved.nodes[0].x).not.toBe(initial.nodes[0].x);
  await button(page,'元に戻す'); expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).diagrams['browser-learn'].nodes[0].x,key)).toBe(initial.nodes[0].x);
  await button(page,'やり直す'); await expect(node).toBeVisible(); await node.focus(); await expect(node).toBeFocused(); await page.keyboard.press('Enter'); await expect(node).toHaveClass(/selected/); await page.keyboard.press('ArrowRight');
  const keyed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).diagrams['browser-learn'],key); expect(keyed.nodes[0].x).toBeGreaterThan(moved.nodes[0].x);
  await page.keyboard.press('Delete'); await expect(node).toHaveCount(0); await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await button(page,'元に戻す'); await expect(node).toHaveCount(1); await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.reload(); await page.getByRole('button',{name:/部品の役割から学ぶ/}).click();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).diagrams['browser-learn'].nodes,key)).toEqual(keyed.nodes);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await button(page,'会場を調べる'); await button(page,'次の動き'); await expect(page.locator('.learning-playback-caption')).toContainText('Web Browser → 教材の応答先'); await expect(page.locator('.diagram-packet')).toHaveAttribute('data-direction', 'forward'); for (let i=0; i<3; i++) await button(page,'次の動き'); await expect(page.getByLabel('利用者の画面')).toHaveText('会場は体育館です');
});

test('changing a practiced graph requires another experiment, and reset preserves learning', async ({ page }) => {
  const p=newStageProgress(); p.cleared=['browser']; p.current='browser'; p.view='practice'; p.browser={...p.browser,sent:'質問',reply:'返事',displayed:'返事'}; p.browserAnswer='display';
  p.diagrams['browser-learn']=connectParts(p.diagrams['browser-learn'],'browser-1','responder'); p.diagrams['browser-learn'].checked=diagramSignature(p.diagrams['browser-learn']);
  await page.goto('/'); await page.evaluate(({key,p})=>localStorage.setItem(key,JSON.stringify(p)),{key,p}); await page.getByRole('button',{name:/部品の役割から学ぶ/}).click();
  await button(page,'Web Browserを追加'); await connect(page,'browser-1','responder'); await button(page,'ボールの貸出状況を調べる');
  await page.getByRole('radio',{name:'利用者の入力を受け取り、返事を画面に表示する'}).check(); await button(page,'練習の結果を確認する'); await expect(page.getByRole('heading',{name:'ステージクリア！'})).toBeVisible();
  await remove(page,'browser-1--responder'); await button(page,'練習の結果を確認する'); await expect(page.getByRole('heading',{name:'まだ確かめたいことがあります'})).toBeVisible();
  await connect(page,'browser-1','responder'); await button(page,'練習の結果を確認する'); await expect(page.getByRole('heading',{name:'ステージクリア！'})).toHaveCount(0);
  await button(page,'練習をやり直す'); await button(page,'図と実験を最初に戻す'); await expect(page.locator('.react-flow__node')).toHaveCount(1);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key); expect(saved.diagrams['browser-learn']).toEqual(p.diagrams['browser-learn']); expect(saved.cleared).toEqual(['browser']);
});

test('v3 achievements migrate into v4 and invalid future parts do not load', async ({ page }) => {
  const p={...newStageProgress(),version:3,cleared:['browser'],diagrams:undefined}; await page.goto('/');
  await page.evaluate(p=>localStorage.setItem('architecture-sandbox:component-stages:v3',JSON.stringify(p)),p);
  await page.getByRole('button',{name:/部品の役割から学ぶ/}).click(); await expect(page.getByRole('progressbar',{name:'クリアしたステージ'})).toHaveAttribute('value','1');
  await button(page,'Web Browserの復習'); await expect(page.getByRole('button',{name:'2. 練習で確かめる'})).toBeDisabled();
  await editor(page); await expect(page.locator('.learning-palette-items button')).toHaveCount(1);
  await page.evaluate(key=>{ const p=JSON.parse(localStorage.getItem(key)!); p.diagrams['browser-learn'].nodes.push({id:'gateway-1',kind:'gateway',x:0,y:0,stopped:false});localStorage.setItem(key,JSON.stringify(p)); },key);
  await page.reload(); await page.getByRole('button',{name:/部品の役割から学ぶ/}).click(); await expect(page.getByRole('alert')).toContainText('前回の学習記録を読み込めませんでした');
});
