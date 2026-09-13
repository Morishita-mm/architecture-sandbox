export async function postJson(url: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(55000);
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('利用が集中しています。時間を置いて再度お試しください。');
    if (response.status === 400 || response.status === 413 || response.status === 422) throw new Error('入力内容またはサイズを確認してください。');
    throw new Error('応答を取得できませんでした。時間を置いて再度お試しください。');
  }
  return response.json();
}
