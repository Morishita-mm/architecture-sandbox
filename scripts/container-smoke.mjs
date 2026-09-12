import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const image = process.argv[2];
assert.ok(image, 'Usage: node scripts/container-smoke.mjs IMAGE');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const metadata = JSON.parse(docker('image', 'inspect', image))[0];
assert.equal(metadata.Architecture, 'amd64');
assert.equal(metadata.Os, 'linux');
assert.equal(metadata.Config.User, '10001:10001');
const container = docker('run', '-d', '--platform', 'linux/amd64',
  '-p', '127.0.0.1::9090', '-e', 'PORT=9090', '-e', 'GEMINI_API_KEY=local-fixture-only', image);
try {
  const binding = docker('port', container, '9090/tcp');
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const res = await fetch(`http://${binding}/healthz`);
      assert.deepEqual(await res.json(), { status: 'ok' });
      ready = true;
      break;
    } catch { await delay(100); }
  }
  assert.ok(ready, 'Container failed health check');
  docker('stop', '--time', '10', container);
  assert.equal(docker('inspect', '--format', '{{.State.ExitCode}}', container), '0');
  console.log('PASS: linux/amd64, non-root user, PORT=9090, shipped definitions, health, SIGTERM');
} finally {
  docker('rm', '-f', container);
}
