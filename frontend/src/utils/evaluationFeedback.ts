export type FeedbackKind = 'general' | 'strengths' | 'issues' | 'unknowns';
export interface FeedbackSection { kind: FeedbackKind; body: string }

/** Use only explicit headings supplied by the evaluator; never infer sentiment from prose. */
export function splitEvaluationFeedback(text: string): FeedbackSection[] {
  // Keep indentation on the first content line: it can be Markdown code.
  const trimBlankLines = (body: string) => body.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd();
  let fence: { char: string; size: number } | null = null;
  const masked = text.split(/(?<=\n)/).map(line => {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (delimiter && delimiter[1][0] === fence.char && delimiter[1].length >= fence.size) fence = null;
      return line.replace(/[^\r\n]/g, ' ');
    }
    if (delimiter) {
      fence = { char: delimiter[1][0], size: delimiter[1].length };
      return line.replace(/[^\r\n]/g, ' ');
    }
    if (/^(?: {4}|\t| {0,3}>)/.test(line)) return line.replace(/[^\r\n]/g, ' ');
    return line.replace(/(`+).*?\1/g, value => ' '.repeat(value.length));
  }).join('');
  const labels: Record<string, FeedbackKind> = {
    '確認した根拠': 'strengths', '良い点': 'strengths',
    '重大な不足': 'issues', '改善が必要な点': 'issues', '未確認事項': 'unknowns',
  };
  const marker = /(^|[\r\n]|[。！？][ \t]*)([ \t]*(?:(?:#{1,6}|[-+*]|\d+[.)])\s+)?(?:\*\*|__)?)(確認した根拠|良い点|重大な不足|改善が必要な点|未確認事項)(?:\*\*|__)?[ \t]*(?:[:：](?:\*\*|__)?[ \t]*|(?=\r?$))/gm;
  const bodies: Partial<Record<FeedbackKind, string[]>> = {};
  let kind: FeedbackKind = 'general', start = 0;
  for (const match of masked.matchAll(marker)) {
    const end = match.index! + match[1].length;
    const body = trimBlankLines(text.slice(start, end));
    if (body || kind !== 'general') (bodies[kind] ??= []).push(body);
    kind = labels[match[3]];
    start = match.index! + match[0].length;
  }
  const body = trimBlankLines(text.slice(start));
  if (body || kind !== 'general') (bodies[kind] ??= []).push(body);
  return (['general', 'strengths', 'issues', 'unknowns'] as const)
    .filter(key => bodies[key])
    .map(key => ({ kind: key, body: trimBlankLines(bodies[key]!.join('\n\n')) }));
}
