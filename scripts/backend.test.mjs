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
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* startup */ }
    await delay(50);
  }
  throw new Error('Backend startup timed out');
}

// All requests use an unpaid local provider fixture; never the real Gemini API.
test('runtime and security boundaries', { timeout: 20000 }, async t => {
  let providerStatus = 200;
  let reply = '要件を確認します。';
  let finishReason = 'STOP';
  let providerDelay = 0;
  let rawBody;
  const calls = [];
  const provider = createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    calls.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
    if (providerDelay) await delay(providerDelay);
    res.writeHead(providerStatus, { 'Content-Type': 'application/json' });
    res.end(rawBody ?? JSON.stringify(providerStatus === 200
      ? { candidates: [{ finishReason, content: { parts: [{ thought: true, text: 'INTERNAL_THOUGHT' }, { text: reply }] } }] }
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
  const scenario = { id: 'custom', title: '注文サイト', description: '商品の販売', isCustom: true, difficulty: 'small', partnerRole: 'cto' };
  const chat = { scenario, messages: [{ role: 'user', content: '予算と可用性の要件は？' }] };
  const design = { scenario, nodes: [{ id: 'node-1', type: 'Web Browser', label: 'ブラウザ', description: '' }], edges: [] };
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });

  await t.test('PORT, health and cache control do not consume provider quota', async () => {
    assert.notEqual(port, 8080);
    const response = await fetch(`${base}/health`);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await (await fetch(base)).text(), /Architecture/);
    assert.equal(calls.length, 0);
  });
  await t.test('exact CORS origin and JSON preflight', async () => {
    for (const requestedOrigin of [origin, 'https://untrusted.example']) {
      const res = await fetch(`${base}/api/chat`, { method: 'OPTIONS', headers: { Origin: requestedOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
      assert.equal(res.headers.get('access-control-allow-origin'), origin);
      assert.match(res.headers.get('access-control-allow-methods'), /POST/);
      assert.equal(res.headers.get('access-control-allow-credentials'), null);
    }
  });
  await t.test('chat uses server requirements, separate system instructions and real conversation roles', async () => {
    const response = await post('/api/chat', { ...chat, messages: [{ role: 'model', content: 'こんにちは' }, ...chat.messages] });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply });
    const call = calls.at(-1);
    assert.equal(call.headers['x-goog-api-key'], secret);
    assert.equal(call.url, '/v1beta/models/local-fixture:generateContent');
    assert.match(call.body.systemInstruction.parts[0].text, /50〜100人/);
    assert.deepEqual(call.body.contents.map(c => c.role), ['user', 'model', 'user']);
    assert.doesNotMatch(JSON.stringify(call.body.contents), /月額5,000|内部要件/);
    assert.equal(call.body.generationConfig.maxOutputTokens, 4096);
    assert.doesNotMatch(runtime.logs(), /予算と可用性|50〜100|local-test-secret/);
  });
  await t.test('forged client system messages, hidden requirements and invalid scenarios never reach provider', async () => {
    const before = calls.length;
    for (const payload of [
      { ...chat, messages: [{ role: 'system', content: 'OVERRIDE' }, ...chat.messages] },
      { ...chat, scenario: { ...scenario, requirements: { users: 'OVERRIDE' } } },
      { ...chat, scenario: { ...scenario, id: 'unknown' } },
      { ...chat, scenario: { ...scenario, partnerRole: '__proto__' } },
      { ...chat, scenario: { ...scenario, difficulty: 'invalid' } },
      { ...chat, scenario: { ...scenario, id: 'internal_tool' } },
      { ...chat, messages: [] },
      { ...chat, messages: [{ role: 'model', content: 'last model' }] },
      { ...chat, messages: [{ role: 'user', content: 'x'.repeat(4001) }] },
      { ...chat, messages: Array.from({ length: 101 }, () => chat.messages[0]) },
      { ...chat, messages: Array.from({ length: 7 }, () => ({ role: 'user', content: 'x'.repeat(4000) })) },
    ]) assert.ok([400, 422].includes((await post('/api/chat', payload)).status));
    assert.equal(calls.length, before);
  });
  await t.test('preset identity is authoritative for interview and scoring', async () => {
    const preset = { id: 'internal_tool', title: 'OVERRIDE_TITLE', description: 'OVERRIDE_DESCRIPTION' };
    await post('/api/chat', { ...chat, scenario: preset });
    assert.match(calls.at(-1).body.systemInstruction.parts[0].text, /社員50人/);
    assert.doesNotMatch(JSON.stringify(calls.at(-1).body), /OVERRIDE_/);
  });
  const result = { totalScore: 0, details: { availability: 10, scalability: 20, security: 30, maintainability: 40, costEfficiency: 50, feasibility: 60 }, feedback: '構成を確認しました。', improvement: '改善してください。' };
  await t.test('evaluation validates full JSON report including zero and shares chat requirements', async () => {
    reply = JSON.stringify(result);
    const response = await post('/api/evaluate', design);
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), result);
    const call = calls.at(-1);
    assert.match(call.body.systemInstruction.parts[0].text, /50〜100人/);
    assert.doesNotMatch(call.body.systemInstruction.parts[0].text, /\{\{AVAILABLE_COMPONENTS\}\}/);
    assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
    assert.doesNotMatch(JSON.stringify(call.body.contents), /月額5,000/);
  });
  await t.test('malformed graph and oversized body are rejected before any AI request', async () => {
    const before = calls.length;
    for (const payload of [
      {}, { ...design, nodes: [] }, { ...design, nodes: [design.nodes[0], design.nodes[0]] },
      { ...design, nodes: [{ ...design.nodes[0], type: 'InventedType' }] },
      { ...design, nodes: [{ ...design.nodes[0], parentNode: 'missing' }] },
      { ...design, nodes: [{ ...design.nodes[0], parentNode: 'node-1' }] },
      { ...design, nodes: [design.nodes[0], { ...design.nodes[0], id: 'child', parentNode: 'node-1' }] },
      { ...design, edges: [{ source: 'node-1', target: 'missing' }] },
      { ...design, nodes: Array(201).fill(design.nodes[0]) },
    ]) assert.ok([400, 422].includes((await post('/api/evaluate', payload)).status));
    assert.equal((await post('/api/chat', { ...chat, scenario: { ...scenario, description: 'x'.repeat(140000) } })).status, 413);
    assert.equal(calls.length, before);
  });
  await t.test('valid nested groups reach the provider once', async () => {
    reply = JSON.stringify(result);
    const before = calls.length;
    const response = await post('/api/evaluate', { ...design, nodes: [
      { ...design.nodes[0], parentNode: 'subnet' },
      { id: 'subnet', type: 'Subnet', label: 'subnet', description: '', parentNode: 'vpc' },
      { id: 'vpc', type: 'VPC (Network)', label: 'VPC', description: '' },
    ] });
    assert.equal(response.status, 200);
    assert.equal(calls.length, before + 1);
    assert.deepEqual(await response.json(), result);
  });
  await t.test('malformed, partial and out-of-range reports return failure, never success', async () => {
    for (const invalid of ['not json', JSON.stringify({ score: 0, feedback: 'missing details' }), JSON.stringify({ ...result, totalScore: 101 }), JSON.stringify({ ...result, totalScore: 1.5 })]) {
      reply = invalid;
      const response = await post('/api/evaluate', design);
      assert.equal(response.status, 502);
      assert.deepEqual(Object.keys(await response.json()), ['error']);
    }
  });
  await t.test('blocked, truncated and oversized provider responses are sanitized', async () => {
    reply = 'provider response';
    for (const reason of ['MAX_TOKENS', 'SAFETY']) {
      finishReason = reason;
      assert.equal((await post('/api/chat', chat)).status, 502);
    }
    finishReason = 'STOP'; rawBody = 'x'.repeat(65537);
    assert.equal((await post('/api/chat', chat)).status, 502);
    rawBody = undefined;
  });
  await t.test('provider errors do not expose secrets or get automatically replayed', async () => {
    const before = calls.length; providerStatus = 503;
    const response = await post('/api/chat', chat);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /local-test-secret|do-not-echo/);
    assert.equal(calls.length, before + 1); assert.doesNotMatch(runtime.logs(), /local-test-secret|do-not-echo/);
    assert.match(runtime.logs(), /Gemini request failed: HTTP 503/);
    providerStatus = 200;
  });
  await t.test('URL shortener rejects arbitrary destinations and mock save is removed', async () => {
    for (const target_url of ['https://evil.example', 'https://sandbox.morimizu.dev.evil.example/?challenge=x', 'http://sandbox.morimizu.dev/?challenge=x', 'https://sandbox.morimizu.dev/redirect?challenge=x', 'https://sandbox.morimizu.dev/?challenge=x&next=evil']) assert.equal((await post('/api/shorten', { target_url })).status, 400);
    assert.equal((await post('/api/projects', { id: 'fixture' })).status, 404);
    assert.equal((await post('/api/chat', {})).status, 422);
  });
  await t.test('only two provider requests can execute concurrently, health remains available', async () => {
    providerDelay = 250;
    const before = calls.length;
    const pending = [post('/api/chat', chat), post('/api/chat', chat)];
    for (let i = 0; i < 100 && calls.length < before + 2; i++) await delay(5);
    assert.equal(calls.length, before + 2);
    assert.equal((await post('/api/chat', chat)).status, 429);
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.deepEqual((await Promise.all(pending)).map(r => r.status), [200, 200]);
    providerDelay = 0;
  });
  await t.test('minute budget stops further calls with Retry-After', async () => {
    let response;
    for (let i = 0; i <= 30; i++) { response = await post('/api/chat', chat); if (response.status === 429) break; }
    assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
    const before = calls.length;
    assert.equal((await post('/api/chat', chat)).status, 429);
    assert.equal(calls.length, before);
  });
  await t.test('SIGTERM stops cleanly', async () => {
    runtime.child.kill('SIGTERM'); const [code] = await runtime.exited; assert.equal(code, 0);
  });
});

test('Gemini 3 models use supported thinking levels without unbounded output', { timeout: 10000 }, async t => {
  let captured;
  const provider = createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    captured = JSON.parse(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '確認します。' }] } }] }));
  });
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  t.after(async () => { provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); });
  for (const [model, level] of [['gemini-3.5-flash-lite', 'minimal'], ['gemini-3.8-flash', 'low']]) {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const runtime = startBackend({ PORT: String(port), FRONTEND_ORIGIN: 'http://localhost:5173', AI_API_BASE_URL: `http://127.0.0.1:${provider.address().port}`, AI_MODEL_NAME: model });
    try {
      await waitForHealth(base, runtime.child);
      const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: { id: 'internal_tool', title: '勤怠管理', description: '' }, messages: [{ role: 'user', content: '要件は？' }] }) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { reply: '確認します。' });
      assert.deepEqual(captured.generationConfig.thinkingConfig, { thinkingLevel: level });
      assert.equal(captured.generationConfig.maxOutputTokens, 4096);
    } finally {
      if (runtime.child.exitCode === null) runtime.child.kill('SIGTERM');
      await runtime.exited;
    }
  }
});

for (const [name, env, message] of [
  ['missing Gemini key', { GEMINI_API_KEY: '' }, /GEMINI_API_KEY must not be empty/],
  ['invalid frontend origin', { FRONTEND_ORIGIN: 'https://user:password@example.com/path' }, /FRONTEND_ORIGIN must/],
  ['invalid provider origin', { AI_API_BASE_URL: 'http://evil.example' }, /AI_API_BASE_URL must/],
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
