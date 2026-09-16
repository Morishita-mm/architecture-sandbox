// Offline aggregation only; evaluation-live.mjs owns all explicit provider execution.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseEvaluation } from '../frontend/src/utils/projectFormat.ts';

const dimensions = ['availability', 'scalability', 'security', 'maintainability', 'costEfficiency', 'feasibility'];
const statistics = values => ({ count: values.length, mean: values.length ? values.reduce((a,b) => a+b,0) / values.length : null, range: values.length ? Math.max(...values)-Math.min(...values) : null });

export function summarizeRuns(cases, runs) {
  runs = runs.map(run => ({ ...run, ...(run.result ? { result: parseEvaluation(run.result) } : {}) }));
  const seen = new Set();
  for (const run of runs) {
    if (!cases.some(c => c.id === run.caseId) || !Number.isInteger(run.repeat) || run.repeat < 1 || seen.has(`${run.caseId}:${run.repeat}`)) throw new Error('Unknown case or duplicate/invalid repeat.');
    seen.add(`${run.caseId}:${run.repeat}`);
    if (Boolean(run.result) === (typeof run.error === 'string')) throw new Error('Each run needs exactly one result or error.');
  }
  const summaries = cases.map(c => {
    const rows = runs.filter(r => r.caseId === c.id);
    const values = rows.filter(r => r.result).map(r => r.result.totalScore);
    const references = rows.flatMap(r => [...`${r.result?.feedback ?? ''}\n${r.result?.improvement ?? ''}`.matchAll(/\]\(#node=([^)]*)\)/g)])
      .map(match => { try { return decodeURIComponent(match[1]); } catch { return ''; } });
    const invalidReferences = references.filter(id => !c.input.nodes.some(n => n.id === id));
    const mean = values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
    return { id: c.id, attempts: rows.length, successful: values.length, failed: rows.length-values.length, mean, range: values.length ? Math.max(...values)-Math.min(...values) : null,
      dimensions: Object.fromEntries(dimensions.map(name => [name, statistics(rows.filter(r => r.result).map(r => r.result.details[name]))])),
      latencyMilliseconds: statistics(rows.filter(r => r.result && Number.isFinite(r.milliseconds)).map(r => r.milliseconds)),
      invalidReferences: [...new Set(invalidReferences)], responsesWithoutReferences: rows.filter(r => r.result && !/\]\(#node=/.test(r.result.feedback + r.result.improvement)).length, reviewQuestions: c.reviewQuestions };
  });
  return summaries.map(row => {
    const paired = summaries.find(other => other.id === cases.find(c => c.id === row.id)?.pairedWith);
    return { ...row, meanDifferenceFromPair: paired?.mean != null && row.mean != null ? row.mean-paired.mean : null };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i+1]; };
  const fixtureBytes = await readFile(new URL('../docs/evaluation-fixtures.json', import.meta.url));
  const { cases } = JSON.parse(fixtureBytes);
  const prompt = await readFile(new URL('../backend/src/infrastructure/gemini/system_prompt.txt', import.meta.url));
  const output = value('--out');
  if (!output) throw new Error('Pass --out /tmp/evaluation-report.json. Use --responses FILE for offline analysis.');
  if (!value('--responses') || args.includes('--endpoint') || args.includes('--allow-api')) throw new Error('Use --responses FILE for offline analysis. Explicit API runs use evaluation-live.mjs.');
  const recorded = JSON.parse(await readFile(value('--responses'), 'utf8'));
  const runs = recorded.runs;
  if (!Array.isArray(runs)) throw new Error('responses file must contain runs[].');
  const provenance = { mode: 'offline-analysis', source: recorded.provenance ?? 'not supplied' };
  const summaries = summarizeRuns(cases, runs);
  let changesFromBaseline;
  if (value('--baseline')) {
    const baseline = JSON.parse(await readFile(value('--baseline'), 'utf8'));
    if (!Array.isArray(baseline.summaries)) throw new Error('Baseline needs summaries[].');
    changesFromBaseline = summaries.map(current => { const previous = baseline.summaries.find(c => c.id === current.id); return { id: current.id, meanDelta: current.mean != null && previous?.mean != null ? current.mean-previous.mean : null }; });
  }
  const report = { createdAt: new Date().toISOString(), provenance, localPromptSha256: createHash('sha256').update(prompt).digest('hex'), fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'), note: 'Local source hashes do not prove which code/model the endpoint runs. Ranges and references are measurements, not expert judgment or proof of injection resistance.', summaries, changesFromBaseline, runs };
  await writeFile(output, JSON.stringify(report, null, 2)+'\n', { flag: 'wx' });
  process.stdout.write(`Analyzed ${runs.length} recorded attempts. No API requests were made.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
