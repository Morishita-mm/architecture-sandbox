import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';

const binary = resolve('backend/target/debug/app');
const definitions = resolve('frontend/src/constants/architecture_defs.json');
const secret = 'local-test-secret-never-log';

async function freePort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}

function startBackend(env) {
  const child = spawn(binary, [], {
    env: { ...process.env, GEMINI_API_KEY: secret, ARCH_DEFS_PATH: definitions, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  return { child, exited: once(child, 'exit'), logs: () => output };
}

async function waitForHealth(base, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Backend exited before health check');
    try { if ((await fetch(`${base}/healthz`)).ok) return; } catch { /* startup */ }
    await delay(50);
  }
  throw new Error('Backend startup timed out');
}

// Uses a local fake provider: no Gemini tokens, user data, or paid calls.
test('Cloud Run runtime, CORS and existing API contracts', { timeout: 20000 }, async t => {
  let providerStatus = 200;
  let reply = '要件を確認します。';
  let calls = [];
  const provider = createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    calls.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
    res.writeHead(providerStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(providerStatus === 200
      ? { candidates: [{ content: { parts: [{ text: reply }] } }] }
      : { error: { message: `do-not-echo-${secret}` } }));
  });
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const origin = 'https://sandbox.morimizu.dev';
  const runtime = startBackend({ PORT: String(port), FRONTEND_ORIGIN: origin,
    AI_API_BASE_URL: `http://127.0.0.1:${provider.address().port}`, AI_MODEL_NAME: 'local-fixture' });
  t.after(async () => {
    if (runtime.child.exitCode === null) runtime.child.kill('SIGTERM');
    await runtime.exited;
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
  });
  await waitForHealth(base, runtime.child);

  await t.test('PORT override, health and legacy root', async () => {
    assert.notEqual(port, 8080);
    assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { status: 'ok' });
    assert.match(await (await fetch(base)).text(), /Architecture/);
    assert.equal(calls.length, 0, 'Health checks must not call Gemini');
  });
  await t.test('exact CORS origin and JSON preflight', async () => {
    for (const requestedOrigin of [origin, 'https://untrusted.example']) {
      const res = await fetch(`${base}/api/chat`, { method: 'OPTIONS', headers: {
        Origin: requestedOrigin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      } });
      assert.equal(res.headers.get('access-control-allow-origin'), origin);
      assert.match(res.headers.get('access-control-allow-methods'), /POST/);
      assert.equal(res.headers.get('access-control-allow-credentials'), null);
    }
  });
  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
  await t.test('chat forwards provider key in header and returns Japanese response', async () => {
    const res = await post('/api/chat', { scenario_id: 'custom', partner_role: 'cto', messages: [
      { role: 'system', content: 'private-scenario-marker' },
      { role: 'user', content: '予算と可用性の要件は？' },
    ] });
    assert.deepEqual(await res.json(), { reply, status: 'success' });
    const call = calls.at(-1);
    assert.equal(call.headers['x-goog-api-key'], secret);
    assert.equal(call.url, '/v1beta/models/local-fixture:generateContent');
    assert.match(call.body.contents[0].parts[0].text, /予算と可用性/);
    assert.doesNotMatch(runtime.logs(), /private-scenario-marker/);
  });
  await t.test('evaluation loads shipped definitions and preserves JSON response', async () => {
    const result = { score: 82, totalScore: 82, feedback: '構成を確認しました。' };
    reply = `\`\`\`json\n${JSON.stringify(result)}\n\`\`\``;
    const res = await post('/api/evaluate', { nodes: [], edges: [], scenario: {
      isCustom: true, difficulty: 'small', requirements: {},
    } });
    assert.deepEqual(await res.json(), result);
    const prompt = calls.at(-1).body.contents[0].parts[0].text;
    assert.doesNotMatch(prompt, /\{\{AVAILABLE_COMPONENTS\}\}/);
    assert.match(prompt, /50〜100人/);
  });
  await t.test('non-JSON evaluation preserves partial-success fallback', async () => {
    reply = '設計をもう少し詳しく説明してください。';
    assert.deepEqual(await (await post('/api/evaluate', {})).json(), {
      score: 0, feedback: reply, status: 'partial_success',
    });
  });
  await t.test('provider errors remain sanitized and server stays healthy', async () => {
    providerStatus = 400;
    const res = await post('/api/chat', { scenario_id: 'internal_tool', messages: [] });
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.doesNotMatch(JSON.stringify(body), /local-test-secret|do-not-echo/);
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.doesNotMatch(runtime.logs(), /local-test-secret|do-not-echo/);
  });
  await t.test('project mock and malformed requests retain contracts', async () => {
    assert.equal((await (await post('/api/projects', { id: 'fixture' })).json()).id, 'fixture');
    assert.equal((await post('/api/chat', {})).status, 422);
    assert.equal((await post('/api/shorten', {})).status, 422);
    assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
  });
  await t.test('SIGTERM stops cleanly within Cloud Run grace period', async () => {
    runtime.child.kill('SIGTERM');
    const [code] = await runtime.exited;
    assert.equal(code, 0);
  });
});

for (const [name, env, message] of [
  ['missing Gemini key', { GEMINI_API_KEY: '' }, /GEMINI_API_KEY must not be empty/],
  ['invalid port', { PORT: 'invalid' }, /PORT must be an integer/],
  ['zero port', { PORT: '0' }, /PORT must not be zero/],
  ['missing definitions', { ARCH_DEFS_PATH: '/nonexistent/architecture_defs.json' }, /Invalid architecture definitions/],
]) {
  test(`startup rejects ${name}`, { timeout: 5000 }, async () => {
    const runtime = startBackend(env);
    const [code] = await runtime.exited;
    assert.notEqual(code, 0);
    assert.match(runtime.logs(), message);
    assert.doesNotMatch(runtime.logs(), new RegExp(secret));
  });
}
