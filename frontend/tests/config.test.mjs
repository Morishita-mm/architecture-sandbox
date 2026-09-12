import assert from 'node:assert/strict';
import { test } from 'node:test';
import process from 'node:process';
import { loadConfigFromFile } from 'vite';

// Exercise Vite's actual config loading, including its environment resolution.
for (const [api, mode, valid] of [
  ['', 'production', false],
  ['http://localhost:8080', 'production', false],
  ['https://localhost:8080', 'production', false],
  ['https://api.example.com/path', 'production', false],
  ['https://api.example.com', 'production', true],
  ['http://localhost:8080', 'development', true],
  ['ftp://localhost/', 'development', false],
]) {
  test(`API origin: ${mode} ${api || '(missing)'}`, async () => {
    const original = process.env.VITE_API_BASE_URL;
    process.env.VITE_API_BASE_URL = api;
    try {
      const load = () => loadConfigFromFile({ command: 'build', mode }, 'vite.config.ts');
      if (valid) await assert.doesNotReject(load);
      else await assert.rejects(load, /Set VITE_API_BASE_URL/);
    } finally {
      if (original === undefined) delete process.env.VITE_API_BASE_URL;
      else process.env.VITE_API_BASE_URL = original;
    }
  });
}

test('Cloudflare headers permit only the configured API, local assets and required inline styles', async () => {
  const { securityHeaders } = await import('../securityHeaders.ts');
  const headers = securityHeaders('https://api.example.com');
  assert.match(headers, /connect-src 'self' https:\/\/api\.example\.com;/);
  assert.match(headers, /script-src 'self';/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /Referrer-Policy: no-referrer/);
  assert.doesNotMatch(headers, /unsafe-eval|script-src[^;]*unsafe-inline/);
});
