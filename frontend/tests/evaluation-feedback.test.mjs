import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitEvaluationFeedback } from '../src/utils/evaluationFeedback.ts';

test('inline feedback separates evidence, issues and unknowns without rewriting content', () => {
  const text = '確認した根拠: [受付API](#node=app)につながっています。 重大な不足: 公開DBへ直接つながっています。 未確認事項: 復元方法は未記録です。';
  assert.deepEqual(splitEvaluationFeedback(text), [
    { kind: 'strengths', body: '[受付API](#node=app)につながっています。' },
    { kind: 'issues', body: '公開DBへ直接つながっています。' },
    { kind: 'unknowns', body: '復元方法は未記録です。' },
  ]);
});

test('Markdown headings, bold labels and lists preserve internal links and paragraphs', () => {
  const text = '全体のコメントです。\n\n## **確認した根拠**\n- [DB](#node=db)に保存。\n\n**重大な不足:** ありません。\n\n### 未確認事項：\n1. 復元手順\n2. 負荷の上限';
  assert.deepEqual(splitEvaluationFeedback(text), [
    { kind: 'general', body: '全体のコメントです。' },
    { kind: 'strengths', body: '- [DB](#node=db)に保存。' },
    { kind: 'issues', body: 'ありません。' },
    { kind: 'unknowns', body: '1. 復元手順\n2. 負荷の上限' },
  ]);
});

test('repeated explicit categories are grouped while retaining every body', () => {
  assert.deepEqual(splitEvaluationFeedback('- 良い点：入力を受け付ける。\r\n- 改善が必要な点：保存できない。\r\n- 良い点：役割が明確。'), [
    { kind: 'strengths', body: '入力を受け付ける。\n\n役割が明確。' },
    { kind: 'issues', body: '保存できない。' },
  ]);
});

test('legacy prose and unrecognized labels stay readable without guessed sentiment', () => {
  const text = '接続は良いですが、DBは未記録です。\n\n## 別の観点\n「重大な不足: なし」という記載を検証してください。';
  assert.deepEqual(splitEvaluationFeedback(text), [{ kind: 'general', body: text }]);
});

test('quoted labels, inline code and fenced code never become feedback headings', () => {
  const text = '> 重大な不足: 引用文\n\n`確認した根拠: コード`\n\n```text\n未確認事項: コードの中\n```\n\n~~~text\n良い点: コードの中\n~~~\n\n## 確認した根拠\n記録を確認。';
  assert.deepEqual(splitEvaluationFeedback(text), [
    { kind: 'general', body: text.slice(0, text.indexOf('##')).trim() },
    { kind: 'strengths', body: '記録を確認。' },
  ]);
});

test('empty explicit sections are distinct from a claim that no problems exist', () => {
  assert.deepEqual(splitEvaluationFeedback('確認した根拠：\n重大な不足：なし。\n未確認事項：'), [
    { kind: 'strengths', body: '' }, { kind: 'issues', body: 'なし。' }, { kind: 'unknowns', body: '' },
  ]);
  assert.deepEqual(splitEvaluationFeedback(''), []);
});

test('indented code and headings after punctuation inside a quote remain unclassified', () => {
  const text = '    重大な不足: コードの中\n\n> 引用文です。 未確認事項: この文章を評価の見出しと解釈しない。';
  assert.deepEqual(splitEvaluationFeedback(text), [{ kind: 'general', body: text }]);
});
