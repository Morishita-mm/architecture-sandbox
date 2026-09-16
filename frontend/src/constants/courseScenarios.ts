/** Authored examples: learners change the architecture, not the exercise's wording. */
export const venueScenario = { action: '会場を調べる', request: '会場を教えてください', reply: '会場は体育館です' };
export const loanScenario = { action: 'ボールの貸出状況を調べる', request: 'ボールは借りられますか', reply: 'ボールは貸出中です' };
export const equipmentScenario = { action: '借りられる道具を調べる', request: '貸出できる道具を教えてください', reply: 'ラケットを借りられます' };
export function introScenario(stage: 'browser' | 'app', practice: boolean) {
  return !practice ? venueScenario : stage === 'browser' ? loanScenario : equipmentScenario;
}
export const storageRecord = (practice: boolean) => practice ? 'Aさんがボールを借りた' : '会場は体育館です';
export const updatedAnnouncement = '集合は12時です';
export function requestReply(request: string) {
  // Keep previously saved, custom lesson messages readable as well.
  return [venueScenario, loanScenario, equipmentScenario].find(s => s.request === request.trim())?.reply ?? `「${request.trim()}」を受け取りました`;
}
