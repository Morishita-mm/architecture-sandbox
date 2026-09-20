import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localChatReply } from '../src/utils/localChat.ts';

test('local chat returns a labeled sample without inventing confirmed conditions', async () => {
  const result = await localChatReply(new AbortController().signal);
  assert.match(result.reply, /ローカル動作確認用の定型応答/);
  assert.equal(result.coveredConditions, undefined);
  assert.equal(result.negotiationProposals, undefined);
});

test('leaving during a local reply cancels it', async () => {
  const controller = new AbortController();
  const reply = localChatReply(controller.signal);
  controller.abort('leave');
  await assert.rejects(reply, reason => reason === 'leave');
  await assert.rejects(localChatReply(controller.signal), reason => reason === 'leave');
});
