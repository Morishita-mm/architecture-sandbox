// Development-only replies let the conversation UI run without a backend or API key.
export function localChatReply(signal: AbortSignal): Promise<{ reply: string }> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve({ reply: '質問を受け取りました。これはローカル動作確認用の定型応答です。\n\n要件を整理するには、「誰が使うか」「どれくらいの人数が使うか」「どんな操作をするか」を順に確認してみましょう。実際の要件は、この応答では確定しません。' });
    }, 800);
    signal.addEventListener('abort', abort, { once: true });
  });
}
