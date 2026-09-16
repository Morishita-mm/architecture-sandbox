import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const node = (id: string, type: string, label: string, x: number, y: number) => ({ id, type: 'custom', position: { x, y }, style: { zIndex: 10 }, data: { originalType: type, label, description: '' } });
const project = {
  schemaVersion: 3, version: '1.0', timestamp: '2026-09-15T00:00:00Z', projectId: 'diagram-visual-review',
  scenario: { id: 'internal_tool', title: '構成図のデザイン確認', description: 'ローカルの表示・接続テスト用' }, memo: '', chatHistory: [], evaluation: null,
  diagram: {
    nodes: [node('browser','Web Browser','Web Browser',300,0), node('lb','Load Balancer','Load Balancer',300,130), node('app-a','App Server','注文API',70,295), node('app-b','App Server','検索API',530,295), node('db','RDBMS (SQL)','注文データ',70,495), node('cache','Distributed Cache','検索キャッシュ',530,495)],
    edges: [
      {id:'browser-lb',source:'browser',target:'lb',data:{payload:'HTTPS リクエスト',mode:'sync'}},
      {id:'lb-a',source:'lb',target:'app-a'}, {id:'lb-b',source:'lb',target:'app-b'},
      {id:'a-db',source:'app-a',target:'db',data:{payload:'注文を保存',mode:'sync'}},
      {id:'b-cache',source:'app-b',target:'cache',data:{payload:'コピーを取得',mode:'sync'}},
      {id:'cache-db',source:'cache',target:'db'},
    ],
  },
};
for (const mobile of [false,true]) test.describe(mobile?'touch diagram visuals':'desktop diagram visuals',()=>{
  test.use({viewport:mobile?{width:390,height:844}:{width:1255,height:963},hasTouch:mobile,isMobile:mobile});
  test('new cards and routed wires preserve selection, editing and exported topology',async({page})=>{
    await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({name:'visual.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    await page.getByRole('button',{name:'アーキテクチャ設計',exact:true}).click();
    for (const name of ['コンポーネント','要件メモ']) {
      const toggle=page.locator('.workspace-panel-actions').getByRole('button',{name:`${name}の表示切り替え`,exact:true});
      if (await toggle.getAttribute('aria-expanded')==='true') await toggle.click();
    }
    await page.locator('.react-flow__controls-fitview').click();
    await expect(page.locator('.canvas-node-icon')).toHaveCount(6);
    await expect(page.locator('.diagram-edge-casing')).toHaveCount(6);
    const reverse=page.getByLabel('検索キャッシュから注文データへの接続',{exact:true});
    await expect(reverse.locator('.react-flow__edge-path')).toHaveAttribute('d',/ Q /);
    if (process.env.COURSE_CAPTURE_DIR) {
      await mkdir(process.env.COURSE_CAPTURE_DIR,{recursive:true});
      await page.screenshot({path:join(process.env.COURSE_CAPTURE_DIR,`polished-${mobile?'mobile':'desktop'}.png`),fullPage:true,animations:'disabled'});
      if (!mobile) await page.locator('.reactflow-wrapper').screenshot({path:join(process.env.COURSE_CAPTURE_DIR,'polished-canvas.png'),animations:'disabled'});
    }
    await reverse.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary',{name:'接続の設定'})).toBeVisible();
    await page.getByLabel('渡すもの',{exact:true}).fill('元データを確認');
    await page.getByRole('button',{name:'接続の設定を閉じる'}).click();
    const download=page.waitForEvent('download'); await page.getByRole('button',{name:'プロジェクト保存'}).click();
    const saved=JSON.parse(await readFile((await (await download).path())!,'utf8'));
    expect(saved.diagram.nodes).toEqual(project.diagram.nodes);
    expect(saved.diagram.edges.map((e:{id:string;source:string;target:string})=>[e.id,e.source,e.target])).toEqual(project.diagram.edges.map(e=>[e.id,e.source,e.target]));
    expect(saved.diagram.edges.find((e:{id:string})=>e.id==='cache-db').data.payload).toBe('元データを確認');
    expect(saved.diagram.edges.every((e:object)=>!('style' in e)&&!('markerEnd' in e))).toBe(true);
  });
});

test('adding the wider card near a group boundary expands the group and keeps the whole card inside', async ({page}) => {
  await page.setViewportSize({width:1255,height:963});
  await page.goto('/');
  const group = {id:'vpc',type:'group',position:{x:0,y:0},style:{width:300,height:200},data:{originalType:'VPC (Network)',label:'VPC'}};
  await page.locator('input[type=file]').setInputFiles({name:'group.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...project,diagram:{nodes:[group],edges:[]}}))});
  await page.getByRole('button',{name:'アーキテクチャ設計',exact:true}).click();
  const boundary=page.locator('.react-flow__node[data-id="vpc"]');
  await page.locator('.dndnode').getByText('App Server',{exact:true}).dragTo(boundary,{targetPosition:{x:250,y:155}});
  const card=page.locator('.react-flow__node-custom');
  await expect(card).toHaveCount(1);
  await expect.poll(async()=>{
    const outer=(await boundary.boundingBox())!, inner=(await card.boundingBox())!;
    return inner.x >= outer.x && inner.y >= outer.y && inner.x+inner.width <= outer.x+outer.width && inner.y+inner.height <= outer.y+outer.height;
  }).toBe(true);
});
