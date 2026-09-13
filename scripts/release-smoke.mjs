import assert from 'node:assert/strict';

// No Gemini requests: health and invalid-input checks exercise release boundaries.
const { API_URL, FRONTEND_URL, ID_TOKEN } = process.env;
assert.match(API_URL ?? '', /^https:\/\/[a-z0-9-]+\.a\.run\.app$/);
const headers = ID_TOKEN ? { Authorization: `Bearer ${ID_TOKEN}` } : {};
async function request(url, options = {}) {
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
}
const health = await request(`${API_URL}/health`, { headers });
assert.equal(health.status, 200, 'API health');
assert.deepEqual(await health.json(), { status: 'ok' });
assert.equal(health.headers.get('cache-control'), 'no-store');
const invalid = await request(`${API_URL}/api/chat`, { method: 'POST', headers: {
  ...headers, 'Content-Type': 'application/json', Origin: 'https://sandbox.morimizu.dev',
}, body: '{}' });
assert.ok([400, 422].includes(invalid.status), 'Invalid input must fail before any AI call');
assert.equal(invalid.headers.get('access-control-allow-origin'), 'https://sandbox.morimizu.dev');
if (FRONTEND_URL) {
  assert.equal(FRONTEND_URL, 'https://sandbox.morimizu.dev');
  for (const path of ['/', '/release-check']) {
    const response = await request(`${FRONTEND_URL}${path}`);
    assert.equal(response.status, 200, 'SPA route');
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.ok(response.headers.get('content-security-policy')?.includes(API_URL), 'CSP must allow the deployed API');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await response.text(), /<div id="root"><\/div>/);
  }
}
console.log('Release smoke passed; no Gemini requests were sent.');
