// These are form fields, not a new project schema. Records stay editable as ordinary memo text.
export interface DesignNoteDraft {
  status: 'unconfirmed' | 'confirmed';
  condition: string;
  evidence: string;
  reason: string;
  before: string;
  after: string;
  next: string;
}

export function formatDesignNote(note: DesignNoteDraft, component: string): string {
  const lines = [
    `【${note.status === 'confirmed' ? '確認済み' : '未確認'}】${note.condition.trim()}`,
    `関連する部品: ${component || '設計全体・まだ決めていない'}`,
  ];
  const fields = [
    ['確認した根拠', note.status === 'confirmed' ? note.evidence : ''], ['設計理由・対応方針', note.reason],
    ['変更前', note.before], ['変更後', note.after], ['次に確かめること', note.next],
  ];
  for (const [label, value] of fields) if (value.trim()) lines.push(`${label}: ${value.trim()}`);
  return lines.join('\n');
}

export function appendDesignNote(memo: string, record: string): string {
  const next = memo + (memo ? '\n\n' : '') + record;
  if (next.length > 100000) throw new Error('要件メモの文字数上限を超えます。入力は残っています。メモを整理してから追加してください。');
  return next;
}
