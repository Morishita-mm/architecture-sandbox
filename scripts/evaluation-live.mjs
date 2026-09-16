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
export function sanitizedEvaluationDescription(value) {
  const parts = value.match(/[^。\n！？!?.]*(?:[。\n！？!?.]|$)/gu)?.filter(Boolean) ?? [];
  const contains = (part, markers) => markers.some(marker => part.includes(marker));
  return parts.filter(part => {
    const lowercase = part.toLowerCase();
    const defense = contains(part, ['検出して拒否', '変更を拒否', '上書きを拒否', '変更を防止', '上書きを防止', '変更を防ぐ', '上書きを防ぐ', '変更を遮断', '上書きを遮断', '従わない', '変更を禁止', '上書きを禁止', '変更への対策', '上書きへの対策'])
      || contains(lowercase, ['detect and reject', 'reject attempts to', 'block attempts to', 'prevent changes to', 'prevent overrides to', 'refuse requests to', 'do not follow']);
    const japaneseScoringPhrase = contains(part, ['採点基準を無視', '採点基準は無視', '採点基準には従わない', '採点基準に従わない', '採点基準を上書き', '採点基準は上書き', '採点基準を変更', '採点基準は変更']);
    const japaneseScoringDefense = contains(part, ['無視してはいけない', '無視しない', '上書きしない', '変更しない', '変更を防止', '上書きを防止', '変更を拒否', '上書きを拒否']);
    const japaneseScoringAttack = japaneseScoringPhrase && !japaneseScoringDefense;
    const japaneseRatingAttack = contains(part, ['最高評価', '満点', '高得点'])
      && contains(part, ['してください', 'にする', 'にしろ', 'にせよ']);
    const scoringAttack = japaneseScoringAttack || japaneseRatingAttack
      || (part.includes('全項目') && part.includes('100点'))
      || (part.includes('未確認事項') && part.includes('省略'))
      || contains(lowercase, ['ignore the previous scoring criteria', 'ignore previous scoring criteria', 'disregard the previous scoring criteria', 'disregard previous scoring criteria', 'override the scoring criteria', 'override scoring criteria', 'change the scoring criteria', 'change scoring criteria'])
      || (contains(lowercase, ['every category', 'all categories']) && lowercase.includes('100'))
      || contains(lowercase, ['omit unknowns', 'skip unknowns', 'omit unknown evaluation items', 'skip unknown evaluation items', 'omit unconfirmed evaluation items', 'skip unconfirmed evaluation items', 'omit unconfirmed items', 'skip unconfirmed items']);
    const instructionAttack = part.includes('管理者命令')
      || contains(part, ['システム指示を上書き', 'システム指示を無視', 'システム指示を回避', 'システム指示を変更', 'システム要件を上書き', 'システム要件を無視', 'システム要件を無効化', 'システム要件を変更'])
      || contains(lowercase, ['ignore system instructions', 'ignore the system instructions', 'disregard system instructions', 'disregard the system instructions', 'override system instructions', 'override the system instructions', 'change system instructions', 'change the system instructions', 'ignore system requirements', 'ignore the system requirements', 'disregard system requirements', 'disregard the system requirements', 'override system requirements', 'override the system requirements', 'invalidate system requirements', 'invalidate the system requirements', 'administrator instruction', 'admin instruction']);
    const attack = scoringAttack || (!defense && instructionAttack);
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
      const ids = new Map(expected.nodes.map((node,index) => [node.id,`provider-node-${String(index).padStart(4,'0')}`]));
      const expectedNodes = expected.nodes.map(n => ({...n,id:ids.get(n.id),label:sanitizedEvaluationDescription(n.label),description:sanitizedEvaluationDescription(n.description),parentNode:n.parentNode ? ids.get(n.parentNode) : null}));
      const expectedEdges = expected.edges.map(edge => ({source:ids.get(edge.source),target:ids.get(edge.target)}));
      if (!isDeepStrictEqual(design.nodes, expectedNodes) || !isDeepStrictEqual(design.edges,expectedEdges)
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
