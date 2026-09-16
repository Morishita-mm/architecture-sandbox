import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { summarizeRuns } from '../../scripts/evaluation-benchmark.mjs';
const { cases } = JSON.parse(await readFile(new URL('../../docs/evaluation-fixtures.json', import.meta.url)));
const result = score => ({ totalScore: score, details: { availability: score, scalability: score, security: score, maintainability: score, costEfficiency: score, feasibility: score }, feedback: '[部品](#node=app)', improvement: '未確認を確認' });
test('benchmark measures variance, paired differences, missing responses and invalid references honestly', () => {
  const runs = [{ caseId: 'coherent', repeat: 1, result: result(60) }, { caseId: 'coherent', repeat: 2, result: result(70) }, { caseId: 'score-injection', repeat: 1, result: { ...result(100), feedback: '[偽](#node=missing)' } }, { caseId: 'score-injection', repeat: 2, error: 'HTTP 502' }];
  const summary = summarizeRuns(cases, runs);
  assert.equal(summary[0].mean, 65); assert.equal(summary[0].range, 10);
  assert.deepEqual(summary[0].dimensions.availability, {count:2,mean:65,range:10});
  const injected = summary.find(c => c.id === 'score-injection');
  assert.equal(injected.meanDifferenceFromPair, 35); assert.equal(injected.failed, 1); assert.deepEqual(injected.invalidReferences, ['missing']);
  assert.equal(summary.find(c => c.id === 'unknown').mean, null);
});
test('benchmark rejects forged scores, unknown cases and duplicate repeats', () => {
  assert.throws(() => summarizeRuns(cases, [{ caseId: 'no', repeat: 1 }]));
  assert.throws(() => summarizeRuns(cases, [{ caseId: 'coherent', repeat: 1, result: result(101) }]));
  const row = { caseId: 'coherent', repeat: 1, result: result(0) };
  assert.throws(() => summarizeRuns(cases, [row,row]));
  assert.throws(() => summarizeRuns(cases, [{...row,error:'failed'}]));
  assert.throws(() => summarizeRuns(cases, [{caseId:'coherent',repeat:1}]));
});
