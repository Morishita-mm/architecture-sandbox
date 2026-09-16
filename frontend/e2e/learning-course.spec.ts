import { test, expect, type Page } from '@playwright/test';
import { connect, stop, balance, gateway, canvasReady } from './course-canvas-helpers';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const key = 'architecture-sandbox:component-stages:v4';
const button = async (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const answer = async (page: Page, name: string) => page.getByRole('radio', { name, exact: true }).check();
async function capture(page: Page, screen: string) {
  const directory = process.env.COURSE_CAPTURE_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const controls = page.locator('.learning-accessible-controls');
  if (await controls.count() && await controls.getAttribute('open') !== null) await controls.locator('summary').click();
  const count = await page.getByRole('progressbar', { name: 'クリアしたステージ' }).getAttribute('value');
  const device = page.viewportSize()!.width < 600 ? 'mobile' : 'desktop';
  await page.screenshot({ path: join(directory, `${device}-${count}-${screen}.png`), fullPage: true, animations: 'disabled' });
  if (count === '4' && screen === 'practice') await page.locator('.learning-canvas').screenshot({ path: join(directory, `${device}-vertical-canvas.png`), animations: 'disabled' });
}
async function visit(page: Page) {
  const requests: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) { requests.push(url.pathname); return route.abort(); }
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  return requests;
}
async function clear(page: Page, correct: string) {
  await canvasReady(page);
  const cleared = Number(await page.getByRole('progressbar', { name: 'クリアしたステージ' }).getAttribute('value'));
  await expect(page.locator('.learning-palette-items button')).toHaveCount(Math.min(8, cleared + 1));
  await answer(page, correct); await button(page, '練習の結果を確認する');
  await expect(page.getByRole('heading', { name: 'ステージクリア！' })).toBeVisible();
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  await capture(page, 'practice');
  await button(page, '次のステージへ');
}
async function basicStorage(page: Page) {
  await button(page, '記録を保存する'); await button(page, 'アプリを再起動する'); await button(page, '記録を読み出す');
}
for (const mobile of [false, true]) test.describe(mobile ? 'touch component stages' : 'desktop component stages', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1255, height: 963 }, isMobile: mobile, hasTouch: mobile });
  test('complete all eight stages and graduation, resume, and export the learned design without API calls', async ({ page }) => {
    test.setTimeout(240000); page.setDefaultTimeout(10000);
    const requests = await visit(page);
    await expect(page.getByRole('heading', { name: '学習マップ', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'App Serverの学習を始める' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /卒業課題：条件から設計を選ぶ/ })).toBeDisabled();
    await button(page, 'Web Browserの学習を始める'); await canvasReady(page); await connect(page, 'browser-1', 'responder');
    await button(page, '会場を調べる');
    await answer(page, '利用者の入力を受け取り、返事を画面に表示する');
    await capture(page, 'learn'); await button(page, '練習問題へ');
    await answer(page, '利用者の入力を受け取り、返事を画面に表示する');
    await button(page, '練習の結果を確認する');
    await expect(page.getByRole('heading', { name: 'まだ確かめたいことがあります' })).toBeVisible();
    await expect(page.getByRole('button', { name: '次のステージへ' })).toHaveCount(0);
    await button(page, 'Web Browserを追加'); await connect(page, 'browser-1', 'responder');
    await button(page, 'ボールの貸出状況を調べる');
    await answer(page, 'すべての利用者の記録を永続的に保存する'); await button(page, '練習の結果を確認する');
    await expect(page.getByRole('heading', { name: 'ステージクリア！' })).toHaveCount(0);
    await clear(page, '利用者の入力を受け取り、返事を画面に表示する');

    await expect(page.getByRole('heading', { level: 1, name: 'App Server' })).toBeFocused();
    await button(page, '会場を調べる');
    await expect(page.getByLabel('利用者の画面')).toHaveText('返事が届きませんでした');
    await connect(page, 'browser-1', 'app-1');
    await button(page, '会場を調べる');
    await answer(page, '届いた要求に応じて処理し、返事を作る'); await capture(page, 'learn'); await button(page, '練習問題へ');
    await button(page, 'App Serverを追加'); await connect(page, 'browser-1', 'app-1'); await button(page, '借りられる道具を調べる');
    await clear(page, '届いたお願いを処理し、結果をブラウザへ返す');

    await basicStorage(page);
    await page.reload(); await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'RDBMS (SQL)' })).toBeFocused();
    await expect(page.getByText('確認済み：', { exact: true })).toHaveCount(1);
    await button(page, 'RDBMS (SQL)を追加'); await button(page, '記録を保存する');
    await expect(page.getByRole('heading', { name: 'DBに届かず、処理できませんでした' })).toBeVisible();
    await connect(page, 'app-1', 'database-1'); await basicStorage(page);
    await answer(page, 'アプリとは別のDBに記録を残していたから'); await capture(page, 'learn'); await button(page, '練習問題へ');
    await button(page, 'RDBMS (SQL)を追加'); await connect(page, 'app-1', 'database-1'); await button(page, '記録を保存する'); await button(page, 'アプリを再起動する'); await button(page, '記録を読み出す');
    await expect(page.getByLabel('ブラウザに表示する内容')).toContainText('Aさんがボールを借りた');
    await clear(page, 'アプリとは別のDBに記録を残したから');

    await button(page, '見積もる'); await page.getByRole('slider', { name: /集中する時間の倍率/ }).press('End'); await button(page, '見積もる');
    await answer(page, '特定の時間に要求が集中すること'); await button(page, 'Load Balancerの体験へ');
    await button(page, '1秒分の要求を流す');
    await balance(page); await button(page, '1秒分の要求を流す');
    await page.getByLabel('DBが1秒に処理できる量').selectOption('8'); await button(page, '1秒分の要求を流す');
    await expect(page.getByRole('heading', { name: '今度はDBの上限が全体を制限しています' })).toBeVisible();
    await page.getByLabel('DBが1秒に処理できる量').selectOption('20');
    await stop(page, 'app-1', true);
    await page.getByRole('slider', { name: /この1秒に送る要求/ }).press('Home'); await button(page, '1秒分の要求を流す');
    await answer(page, '要求を分け、停止したアプリを避けられる。ただし残る能力やDBは別に考える'); await capture(page, 'learn'); await button(page, '練習問題へ');
    await balance(page); await button(page, '1秒分の要求を流す');
    await clear(page, '共通のDBや入口の故障、残ったアプリの能力');

    await button(page, 'お知らせを読む'); await button(page, 'Distributed Cacheを追加'); await connect(page, 'app-1', 'cache-1');
    await button(page, 'お知らせを読む'); await button(page, 'お知らせを読む'); await button(page, 'DBを更新する'); await button(page, 'お知らせを読む');
    await button(page, 'コピーを無効化する'); await button(page, 'お知らせを読む');
    await answer(page, 'どれくらい古い情報を許せるか、いつコピーを消すか'); await capture(page, 'learn'); await button(page, '練習問題へ');
    await connect(page, 'app-1', 'cache-1'); await button(page, '会場を読む'); await expect(page.getByLabel('表示したお知らせ')).toContainText('公園');
    await page.reload(); await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
    await expect(page.getByLabel('表示したお知らせ')).toContainText('公園');
    await button(page, 'コピーを無効化する'); await button(page, '会場を読む'); await expect(page.getByLabel('表示したお知らせ')).toContainText('体育館');
    await clear(page, 'いつ無効化するか、どの程度の古さを許容するか');

    await button(page, '通知を依頼する'); await button(page, 'Message Queueを追加'); await connect(page, 'app-1', 'queue-1');
    await button(page, '通知を依頼する'); await page.getByRole('checkbox', { name: '教材の通知担当を停止する' }).check(); await button(page, '1件処理する');
    await expect(page.getByRole('button', { name: '同じ仕事を再配信する' })).toHaveCount(0);
    await answer(page, 'Workerが処理するまで未完了の仕事として待機する'); await capture(page, 'learn'); await button(page, '練習問題へ');
    await button(page, 'Message Queueを追加'); await connect(page, 'app-1', 'queue-1'); await button(page, '通知を依頼する');
    await expect(page.getByLabel('待機中の仕事')).toContainText('通知を実行した回数：0回');
    await clear(page, '受付済み。通知の完了はまだ確認できていない');

    await expect(page.getByRole('heading', { level: 1, name: 'Worker (Async)' })).toBeFocused();
    await expect(page.getByRole('button', { name: '練習問題へ' })).toHaveCount(0);
    await button(page, 'Worker (Async)を追加'); await connect(page, 'queue-1', 'worker-1'); await button(page, '1件処理する'); await stop(page, 'worker-1', false); await button(page, '1件処理する');
    await button(page, '同じ仕事を再配信する'); await button(page, '1件処理する');
    await page.getByRole('checkbox', { name: '処理済みIDで重複を防ぐ' }).check(); await button(page, '同じ仕事を再配信する'); await button(page, '1件処理する');
    await answer(page, '未完了の仕事を把握し、同じ仕事が来ても安全に扱うこと'); await capture(page, 'learn'); await button(page, '練習問題へ');
    await button(page, 'Worker (Async)を追加'); await connect(page, 'queue-1', 'worker-1'); await stop(page, 'worker-1', false); await page.getByRole('checkbox', { name: '処理済みIDで重複を防ぐ' }).check();
    await button(page, '1件処理する'); await button(page, '1件処理する');
    await clear(page, '仕事IDと処理済み記録を使い、重複を安全に扱う');

    await button(page, '要求をまとめて送る'); await button(page, '仮想時間を1秒進める'); await gateway(page);
    await button(page, '要求をまとめて送る'); await button(page, '仮想時間を1秒進める'); await button(page, '見送り分を再試行する');
    await answer(page, '利用制限で断られた要求は、利用者側で再試行などの対応が必要'); await capture(page, 'learn'); await button(page, '練習問題へ');
    await gateway(page); await button(page, '7件の要求を送る');
    await button(page, '仮想時間を1秒進める'); await button(page, '見送り分を再試行する');
    await expect(page.getByRole('button', { name: '7件の要求を送る' })).toBeDisabled();
    await button(page, '仮想時間を1秒進める'); await button(page, '見送り分を再試行する');
    await clear(page, '利用者側で待ち、改めて要求を送ったから');

    await page.getByLabel('今回満たしたい条件').selectOption('peak'); await button(page, 'この構成を確かめる');
    await balance(page); await button(page, 'Distributed Cacheを追加'); await connect(page, 'app-1', 'cache-1'); await connect(page, 'app-2', 'cache-1'); await button(page, 'Message Queueを追加'); await connect(page, 'app-1', 'queue-1'); await connect(page, 'app-2', 'queue-1'); await button(page, 'Worker (Async)を追加'); await connect(page, 'queue-1', 'worker-1'); await stop(page, 'worker-1', false);
    await button(page, 'この構成を確かめる');
    await page.getByLabel('この構成を選ぶ理由').fill('集中する12件を2台へ分散する'); await page.getByLabel('残る課題・引き受ける負担').fill('DBの故障への備えが必要');
    await answer(page, '条件を満たす理由と、費用・運用・残る限界を説明できること');
    await canvasReady(page);
    const learned = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).diagrams.graduation, key); await capture(page, 'graduation'); await button(page, 'コースを修了する');
    await expect(page.getByRole('heading', { name: '入門コース修了！' })).toBeVisible(); await expect(page.locator('.stage-card.is-cleared')).toHaveCount(8);
    const progress = await page.evaluate(key => localStorage.getItem(key), key);
    await button(page, 'この構成で自由設計へ'); await expect(page.locator('.react-flow__node')).toHaveCount(8);
    const downloading = page.waitForEvent('download'); await button(page, 'プロジェクト保存');
    const file = await readFile((await (await downloading).path())!); const saved = JSON.parse(file.toString());
    expect(saved.diagram.nodes.map((n: { id: string; position: object }) => [n.id, n.position])).toEqual(learned.nodes.map((n: { id: string; x: number; y: number }) => [n.id, { x: n.x, y: n.y }]));
    expect(saved.diagram.edges.map((e: { source: string; target: string }) => [e.source, e.target])).toEqual(learned.edges.map((e: { source: string; target: string }) => [e.source, e.target]));
    expect(saved.memo).toContain('集中する12件を2台へ分散する'); expect(saved.memo).toContain('DBの故障への備えが必要');
    await page.getByTitle('シナリオ選択画面に戻る').click();
    await page.locator('input[type=file]').setInputFiles({ name: 'graduation.json', mimeType: 'application/json', buffer: file });
    await button(page, 'アーキテクチャ設計'); await expect(page.locator('.react-flow__node')).toHaveCount(8);
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(progress);
    expect(requests).toEqual([]);
  });
});

test('direct design remains available without clearing a stage', async ({ page }) => {
  const requests = await visit(page);
  await button(page, '設計課題に進む');
  await expect(page.getByRole('heading', { name: '設計するテーマを選ぶ' })).toBeFocused();
  await page.getByRole('button', { name: /^社内勤怠管理システム/ }).click(); await button(page, 'アーキテクチャ設計');
  await expect(page.getByRole('button', { name: '基本の8種類に戻す' })).toBeVisible();
  expect(requests).toEqual([]);
});

test('corrupt progress and storage failure keep practice usable and allow saving again', async ({ page }) => {
  await page.goto('/'); await page.evaluate(key => localStorage.setItem(key, '{invalid'), key);
  await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  await expect(page.getByRole('alert')).toContainText('前回の学習記録を読み込めませんでした');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{invalid');
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    (globalThis as typeof globalThis & { restore: () => void }).restore = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('QuotaExceeded', 'QuotaExceededError'); original.call(this, name, value); };
  }, key);
  await button(page, 'Web Browserの学習を始める'); await canvasReady(page); await connect(page, 'browser-1', 'responder'); await button(page, '会場を調べる');
  await expect(page.getByRole('alert')).toContainText('学習記録をブラウザに保存できません');
  await page.evaluate(() => (globalThis as typeof globalThis & { restore: () => void }).restore()); await button(page, '保存を再試行');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await page.getByRole('button', { name: /部品の役割から学ぶ/ }).click();
  await expect(page.getByLabel('利用者の画面')).toContainText('会場は体育館です');
});
