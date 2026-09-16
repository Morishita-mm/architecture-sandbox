import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const project = {
  schemaVersion: 4,
  version: '1.0',
  timestamp: '2026-09-16T00:00:00.000Z',
  projectId: 'requirements-specification-test',
  scenario: {
    id: 'internal_tool',
    title: '社内勤怠管理システム',
    description: '24時間動く工場で、交代時の一斉打刻を受け付ける勤怠システム。',
    partnerRole: 'ceo',
    profileId: 'attendance-shift',
    acceptedNegotiationIds: [],
    specificationVersion: 1,
  },
  memo: '',
  diagram: {
    nodes: [{ id: 'browser', type: 'custom', position: { x: 80, y: 80 }, data: { label: 'Web Browser', originalType: 'Web Browser', description: '' } }],
    edges: [],
  },
  chatHistory: [],
  interviewEvidence: [],
  requirementRevisions: [],
  evaluation: null,
};

const evaluation = {
  totalScore: 60,
  details: { availability: 60, scalability: 60, security: 60, maintainability: 60, costEfficiency: 60, feasibility: 60 },
  weights: { availability: 75, scalability: 15, security: 0, maintainability: 10, costEfficiency: 0, feasibility: 0 },
  feedback: '確認した根拠: Web Browserを配置しています。',
  improvement: 'App Serverへの経路を追加してください。',
};

async function exportProject(page: import('@playwright/test').Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'プロジェクト保存', exact: true }).click();
  const path = await (await download).path();
  if (!path) throw new Error('Download file missing');
  return JSON.parse(await readFile(path, 'utf8'));
}

test('an approved server proposal becomes the saved specification used for weighted evaluation', async ({ page }) => {
  let evaluationRequest: Record<string, unknown> | undefined;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'content-type',
      },
    });
    if (url.pathname.endsWith('/api/chat')) return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        reply: '日次集計を翌朝8時までへ変更できます。確定しますか？',
        negotiationProposals: [{
          optionId: 'attendance-shift-report-8am',
          conditionId: 'response',
          label: '集計完了時刻',
          currentValue: '日次集計は翌朝6時まで',
          proposedValue: '日次集計は翌朝8時まで',
        }],
      },
    });
    if (url.pathname.endsWith('/api/evaluate')) {
      evaluationRequest = route.request().postDataJSON();
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: evaluation });
    }
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });

  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'fixed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.getByText('24時間の交代勤務', { exact: true })).toBeVisible();
  await expect(page.getByText('v1', { exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: 'メッセージ', exact: true }).fill('日次集計を8時までにできますか？');
  await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(page.getByRole('complementary', { name: '合意仕様の変更' })).toContainText('日次集計は翌朝8時まで');
  await page.getByRole('button', { name: 'この内容で仕様を確定', exact: true }).click();
  await expect(page.getByText('v2', { exact: true })).toBeVisible();

  const saved = await exportProject(page);
  expect(saved.scenario).toMatchObject({
    profileId: 'attendance-shift',
    acceptedNegotiationIds: ['attendance-shift-report-8am'],
    specificationVersion: 2,
  });
  expect(saved.requirementRevisions).toEqual([expect.objectContaining({ optionId: 'attendance-shift-report-8am', version: 2 })]);

  await page.getByRole('button', { name: '評価結果', exact: true }).click();
  await page.getByRole('button', { name: '現在の設計を評価する', exact: true }).click();
  await expect(page.getByText('今回のケースの重点配分で算出した仕様v2の評価です。', { exact: true })).toBeVisible();
  await expect(page.getByText('重点 75%', { exact: true })).toBeVisible();
  expect(evaluationRequest?.scenario).toMatchObject({
    profileId: 'attendance-shift',
    acceptedNegotiationIds: ['attendance-shift-report-8am'],
    specificationVersion: 2,
  });
});
