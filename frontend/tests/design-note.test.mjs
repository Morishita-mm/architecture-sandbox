import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendDesignNote, formatDesignNote } from '../src/utils/designNote.ts';
import { parseProject, serializeProject } from '../src/utils/projectFormat.ts';

const note = { status: 'confirmed', condition: '貸出記録をあとで確認する', evidence: '依頼者との会話で確認', reason: '履歴を保存するためDBへ渡す', before: '画面にだけ表示', after: 'DBに保存し再表示', next: '保存期間を確認する' };

test('one editable record keeps the condition, evidence, component, reason and changes together', () => {
  assert.equal(formatDesignNote(note, '貸出DB（RDBMS (SQL)）'), [
    '【確認済み】貸出記録をあとで確認する', '関連する部品: 貸出DB（RDBMS (SQL)）',
    '確認した根拠: 依頼者との会話で確認', '設計理由・対応方針: 履歴を保存するためDBへ渡す',
    '変更前: 画面にだけ表示', '変更後: DBに保存し再表示', '次に確かめること: 保存期間を確認する',
  ].join('\n'));
  const unconfirmed = formatDesignNote({ ...note, status: 'unconfirmed', reason: '', before: '', after: '', next: '' }, '');
  assert.equal(unconfirmed, '【未確認】貸出記録をあとで確認する\n関連する部品: 設計全体・まだ決めていない');
});

test('appending preserves all existing free-form memo text and can use the exact capacity', () => {
  const memo = '既存メモ\n  書式と空白を残す\n';
  assert.equal(appendDesignNote(memo, '次の記録'), memo + '\n\n次の記録');
  assert.equal(appendDesignNote('', '最初の記録'), '最初の記録');
  assert.equal(appendDesignNote('あ'.repeat(99997), '新').length, 100000);
  assert.throws(() => appendDesignNote('あ'.repeat(99998), '新'), /文字数上限/);
});

test('records round trip through the existing project format without changing the graph or history', () => {
  const project = {
    schemaVersion: 2, projectId: 'notes', version: '1.0', timestamp: '2026-09-15T00:00:00.000Z',
    scenario: { id: 'custom', title: '備品管理', description: '備品の貸し出しを記録する。', isCustom: true },
    memo: appendDesignNote('元のメモ', formatDesignNote(note, '貸出DB')),
    chatHistory: [{ role: 'user', content: '記録はあとでも必要ですか？' }],
    diagram: { nodes: [], edges: [] }, evaluation: null,
  };
  const restored = parseProject(serializeProject(project));
  assert.equal(restored.memo, project.memo);
  assert.deepEqual(restored.diagram, project.diagram);
  assert.deepEqual(restored.chatHistory, project.chatHistory);
  assert.equal(restored.schemaVersion, 2);
});
