// Runs the real local backend through a loopback recorder. The CLI forwards only to Google.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { parseEvaluation } from '../frontend/src/utils/projectFormat.ts';
import { summarizeRuns } from './evaluation-benchmark.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const root = fileURLToPath(new URL('..', import.meta.url));
const model = 'gemini-3.5-flash-lite';
const apiPath = `/v1beta/models/${model}:generateContent`;
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; }
async function boundedBody(stream, limit) { const chunks = []; let size = 0; for await (const chunk of stream) { size += chunk.length; if (size > limit) throw new Error('body-limit'); chunks.push(Buffer.from(chunk)); } return Buffer.concat(chunks); }
function sanitizedEvaluationDescription(value) {
  const parts = value.match(/[^。\n！？!?.]*(?:[。\n！？!?.]|$)/gu)?.filter(Boolean) ?? [];
  const contains = (part, markers) => markers.some(marker => part.includes(marker));
  return parts.filter(part => {
    const attack = part.includes('プロンプトインジェクション') || part.includes('不正な指示文')
      || part.includes('ユーザーデータに含まれる指示やルール変更の試み')
      || part.includes('指示変更を試みる記述')
      || (part.includes('システム指示') && contains(part, ['上書き', '無視', '回避', '変更', '優先']))
      || (part.includes('システム要件') && contains(part, ['上書き', '無効化', '変更']))
      || (part.includes('採点基準') && contains(part, ['無視', '上書き', '変更']))
      || part.includes('管理者命令') || (part.includes('全項目') && part.includes('100点'))
      || (part.includes('未確認事項') && part.includes('省略'));
    return !attack;
  }).join('').trim();
}

export function tokenEstimate(usage) {
  if (!usage || ![usage.promptTokenCount, usage.totalTokenCount].every(n => Number.isInteger(n) && n >= 0) || usage.totalTokenCount < usage.promptTokenCount) return null;
  const outputIncludingThinking = usage.totalTokenCount - usage.promptTokenCount;
  return { input: usage.promptTokenCount, outputIncludingThinking, standardPaidUsd: (usage.promptTokenCount * .30 + outputIncludingThinking * 2.50) / 1e6 };
}

/** provider is injected only by local tests; the CLI has no arbitrary upstream option. */
export async function runLocalEvaluation({ output, provider, providerKind = 'unpaid-fixture', fixtureFile = 'docs/evaluation-fixtures.json', repeats = 3, pauseMs = 2100, progress = () => {} }) {
  if (![2,3,4].includes(repeats) || !Number.isFinite(pauseMs) || pauseMs < 0) throw new Error('Invalid run limits');
  if (!['docs/evaluation-fixtures.json', 'docs/evaluation-fixtures-sns.json'].includes(fixtureFile)) throw new Error('Invalid fixture file');
  // Reserve before starting a process or making a potentially billable request.
  await mkdir(output, { mode: 0o700 });
  const fixtureBytes = await readFile(join(root, fixtureFile));
  const { cases } = JSON.parse(fixtureBytes);
  const sourceHashes = {};
  for (const file of ['backend/target/debug/app', 'backend/src/infrastructure/gemini/client.rs', 'backend/src/infrastructure/gemini/system_prompt.txt', 'backend/src/infrastructure/gemini/evaluation.schema.json', 'backend/src/domain/model/evaluation.rs', 'backend/src/domain/model/scenario.rs', 'frontend/src/constants/architecture_defs.json', 'scripts/evaluation-live.mjs', 'scripts/evaluation-benchmark.mjs']) sourceHashes[file] = sha(await readFile(join(root,file)));
  const plan = Array.from({length:repeats},(_,round) => cases.map((_,i) => ({caseId:cases[(i+round*2)%cases.length].id,repeat:round+1}))).flat();
  const report = { createdAt:new Date().toISOString(), provenance:{ mode:'local-backend-recording', providerKind, requestedModel:model, fixtureFile, fixtureSha256:sha(fixtureBytes), sourceHashes, repeats, maxCalls:plan.length, automaticRetries:0 }, plan, runs:[], complete:false, summaries:[] };
  async function save() { await writeFile(join(output,'report.next.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600}); await rename(join(output,'report.next.json'),join(output,'report.json')); }
  await save();
  const token = randomUUID(); let active, child, exited, calls = 0, stopped = false;
  const server = createServer(async (req,res) => {
    try {
      if (req.method !== 'POST' || req.url !== apiPath || req.headers['x-goog-api-key'] !== token || !active || active.forwarded || calls >= plan.length || stopped) { res.writeHead(403).end(); return; }
      const body = await boundedBody(req, 32768), data = JSON.parse(body);
      const design = JSON.parse(data.contents[0].parts[0].text);
      const expected = cases.find(c => c.id === active.caseId).input;
      const expectedNodes = expected.nodes.map(n => ({...n,label:sanitizedEvaluationDescription(n.label),description:sanitizedEvaluationDescription(n.description),parentNode:n.parentNode ?? null}));
      if (!isDeepStrictEqual(design.nodes, expectedNodes) || !isDeepStrictEqual(design.edges,expected.edges)
          || data.generationConfig.maxOutputTokens !== 4096 || data.generationConfig.responseMimeType !== 'application/json' || data.tools || data.cachedContent) throw new Error('unexpected-request');
      active.forwarded = true; active.requestSha256 = sha(body); active.systemSha256 = sha(JSON.stringify(data.systemInstruction)); active.generationConfig = data.generationConfig;
      calls++; report.providerCalls = calls; await save();
      const reply = await provider(body);
      const responseBody = Buffer.from(reply.body);
      active.providerStatus = reply.status;
      if (responseBody.length > 65536) throw new Error('upstream-body-limit');
      if (reply.status === 200) {
        const parsed = JSON.parse(responseBody);
        active.modelVersion = typeof parsed.modelVersion === 'string' ? parsed.modelVersion : null;
        active.usage = parsed.usageMetadata ?? null; active.tokenEstimate = tokenEstimate(active.usage);
        active.finishReason = parsed.candidates?.[0]?.finishReason ?? null;
        active.providerText = (parsed.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
      }
      await save(); res.writeHead(reply.status,{'content-type':'application/json'}).end(responseBody);
    } catch {
      if (active) active.transportError = 'upstream request, bounds or validation failed';
      stopped = true; res.writeHead(502,{'content-type':'application/json'}).end('{}');
    }
  });
  try {
    const proxy = await listen(server);
    const reservation = createServer(), base = await listen(reservation);
    await new Promise(resolve => reservation.close(resolve));
    const env = {...process.env, GEMINI_API_KEY:token, ARCH_DEFS_PATH:join(root,'frontend/src/constants/architecture_defs.json'), PORT:new URL(base).port, FRONTEND_ORIGIN:'http://localhost:5173', AI_API_BASE_URL:proxy, AI_MODEL_NAME:model};
    delete env.GOOGLE_API_KEY;
    child = spawn(join(root,'backend/target/debug/app'),[],{env,stdio:['ignore','ignore','ignore']}); exited = once(child,'exit');
    let ready = false;
    for (let i=0;i<100;i++) { if(child.exitCode !== null) throw new Error('Backend exited'); try { if ((await fetch(`${base}/health`)).ok) {ready=true;break;} } catch { /* startup only; no provider calls */ } await delay(50); }
    if (!ready) throw new Error('Backend startup timeout');
    for (const entry of plan) {
      if (report.runs.length) await delay(pauseMs);
      active = {...entry,startedAt:new Date().toISOString(),status:'pending'}; report.runs.push(active); await save();
      const start = performance.now();
      try {
        const result = await fetch(`${base}/api/evaluate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cases.find(c => c.id === entry.caseId).input),signal:AbortSignal.timeout(55000),redirect:'error'});
        if (!result.ok) throw new Error(`backend-http-${result.status}`);
        active.result = parseEvaluation(await result.json()); active.status='complete';
        if (!active.forwarded) throw new Error('No provider response');
      } catch (error) {
        delete active.result; active.status='failed'; active.error=error instanceof Error && /^backend-http-\d+$/.test(error.message) ? error.message : 'request-failed-or-invalid-response'; stopped=true;
      }
      active.milliseconds = Math.round(performance.now()-start);
      report.summaries = summarizeRuns(cases,report.runs); await save(); progress({caseId:entry.caseId,repeat:entry.repeat,status:active.status,score:active.result?.totalScore,providerCalls:calls});
      if (stopped) break;
      active = undefined;
    }
    report.complete = !stopped && report.runs.length === plan.length;
  } catch {
    report.error='local-run-failed';
  } finally {
    stopped=true;
    if(child && child.exitCode === null) child.kill('SIGTERM');
    if(exited) await exited;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    report.finishedAt=new Date().toISOString(); await save();
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2), output = args[args.indexOf('--out')+1];
  const repeatIndex = args.indexOf('--repeats');
  const repeats = repeatIndex < 0 ? 3 : Number(args[repeatIndex+1]);
  const fixtureIndex = args.indexOf('--fixture');
  const fixtureName = fixtureIndex < 0 ? 'attendance' : args[fixtureIndex+1];
  const fixtureFile = {attendance:'docs/evaluation-fixtures.json',sns:'docs/evaluation-fixtures-sns.json'}[fixtureName];
  if (!args.includes('--allow-api') || !args.includes('--out') || !output || output.startsWith('--') || !fixtureFile || !process.env.GEMINI_API_KEY?.trim()) throw new Error('Use --allow-api --out NEW_DIRECTORY [--fixture attendance|sns] with GEMINI_API_KEY set. Build the backend first.');
  const apiKey = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  const report = await runLocalEvaluation({output:resolve(output),fixtureFile,repeats,providerKind:'google-gemini-api',provider:async body => {
    const reply = await fetch(`https://generativelanguage.googleapis.com${apiPath}`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey},body,signal:AbortSignal.timeout(43000),redirect:'error'});
    return {status:reply.status,body:reply.ok ? await boundedBody(reply.body,65536) : Buffer.from('{}')};
  },progress:value=>process.stdout.write(JSON.stringify(value)+'\n')});
  process.stdout.write(`Saved ${report.runs.length} attempts; complete=${report.complete}. No requests were retried.\n`);
  if(!report.complete) process.exitCode=1;
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(()=>{process.stderr.write('Evaluation did not complete. Check the private report or local configuration; credentials are never printed.\n');process.exitCode=1;});
