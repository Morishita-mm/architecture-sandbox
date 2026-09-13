import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/deploy-backend.sh');
const sha = 'a'.repeat(40);
const revision = `architecture-sandbox-api-${sha.slice(0, 7)}-123-1`;
async function fixture(t, changes = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'architecture-release-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  // Read-only CLI fixtures: tests cannot authenticate, access a network, or deploy.
  const executable = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RELEASE_TEST_LOG, JSON.stringify({name,args})+'\\n');
if (name==='curl') process.exit(process.env.PUBLIC_READY==='false'?22:0);
if (name==='docker') {
 if(args[0]==='image') console.log(process.env.SOURCE_SHA);
 if(args[0]==='login') { process.stdin.resume(); process.stdin.on('end',()=>process.exit(0)); }
} else if (name==='gcloud') {
 if(args[0]==='auth') console.log('fixture-token');
 else if(args[0]==='artifacts') console.log('sha256:'+'b'.repeat(64));
 else if(args.includes('update') && process.env.DEPLOY_FAIL==='true') process.exit(1);
 else if(args.includes('describe')) {
  if(args.includes('--format=value(status.url)')) console.log('https://architecture-fixture-an.a.run.app');
  else console.log(JSON.stringify({status:{traffic:[{percent:100,revisionName:'architecture-sandbox-api-previous'},{tag:'candidate',revisionName:process.env.CANDIDATE_REVISION,url:'https://candidate---architecture-fixture-an.a.run.app'}]}}));
 }
}
`;
  for (const name of ['gcloud', 'docker', 'curl']) await writeFile(join(dir, name), executable, { mode: 0o700 });
  const output = join(dir, 'output'); const log = join(dir, 'calls');
  await writeFile(output, ''); await writeFile(log, '');
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, GCP_PROJECT_ID: 'sandbox-test-project', GCP_REGION: 'asia-northeast1', GITHUB_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_OUTPUT: output, RELEASE_TEST_LOG: log, SOURCE_SHA: sha, CANDIDATE_REVISION: revision, ...changes };
  return {
    run: phase => spawnSync('bash', [script, phase], { env, encoding: 'utf8' }),
    calls: async () => (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse),
    output: () => readFile(output, 'utf8'),
  };
}
test('a successful candidate uses the tested source/digest and receives no production traffic', async t => {
  const f = await fixture(t); const result = f.run('candidate');
  assert.equal(result.status, 0, result.stderr);
  const calls = await f.calls();
  const deploy = calls.find(c => c.name === 'gcloud' && c.args.includes('update'));
  assert.ok(deploy.args.includes('--no-traffic'));
  assert.ok(deploy.args.includes(`--image=asia-northeast1-docker.pkg.dev/sandbox-test-project/architecture-sandbox/backend@sha256:${'b'.repeat(64)}`));
  assert.ok(!calls.some(c => c.args.includes('update-traffic')));
  assert.match(await f.output(), new RegExp(`revision=${revision}`));
  assert.doesNotMatch(await f.output(), /fixture-token/);
});
for (const [name, changes] of [
  ['private API', { PUBLIC_READY: 'false' }],
  ['untested image source', { SOURCE_SHA: 'c'.repeat(40) }],
]) test(`${name} fails before registry or service mutation`, async t => {
  const f = await fixture(t, changes); assert.notEqual(f.run('candidate').status, 0);
  assert.ok(!(await f.calls()).some(c => c.args.some(a => ['push','update','update-traffic'].includes(a))));
  assert.equal(await f.output(), '');
});
test('failed candidate deployment has no output or traffic promotion', async t => {
  const f = await fixture(t, { DEPLOY_FAIL: 'true' }); assert.notEqual(f.run('candidate').status, 0);
  assert.equal(await f.output(), '');
  assert.ok(!(await f.calls()).some(c => c.args.includes('update-traffic')));
});
test('a mismatched revision cannot be accepted as this run’s candidate', async t => {
  const f = await fixture(t, { CANDIDATE_REVISION: 'architecture-sandbox-api-other' });
  assert.notEqual(f.run('candidate').status, 0); assert.equal(await f.output(), '');
});
test('promotion targets only the revision derived from this release and leaves IAM alone', async t => {
  const f = await fixture(t); const result = f.run('promote');
  assert.equal(result.status, 0, result.stderr);
  const calls = await f.calls(); assert.equal(calls.length, 1);
  assert.ok(calls[0].args.includes(`--to-revisions=${revision}=100`));
  assert.ok(calls[0].args.includes('--remove-tags=candidate'));
  assert.ok(calls[0].args.includes('--project=sandbox-test-project'));
});
