import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';
import { Report } from '../src/report.mjs';
import { createWorkflow } from '../src/workflow.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function createSampleEnvelope() {
  const flow = createWorkflow({ Settings, Shopping, Metrics, History, Report });
  const prepared = flow.prepare({ spreadsheet_id: 'fixture-preview-only', keywords: ['wireless earbuds', 'standing desk'], target_name: 'JBL', brand_aliases: ['JBL'], product_ids: [], country: 'us', language: 'en', shelf_depth: 20, run_anchor: '2026-11-05T09:00:00.000Z', enable_ai: false, enable_slack: false }, 'fixture-report-preview')[0].json;
  const baselines = flow.baselines(prepared, [])[0].json;
  const jobs = flow.searches(baselines, []).map(item => item.json);
  const fixtures = ['shopping-earbuds.json', 'shopping-standing-desk.json'].map(name => JSON.parse(readFileSync(resolve(root, 'tests', 'fixtures', name), 'utf8')));
  const normalized = flow.normalize(jobs, jobs.map((job, index) => ({ query_id: job.query_id, response: fixtures[index] })))[0].json;
  return flow.report(flow.measure(normalized)[0].json, [])[0].json;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sample = createSampleEnvelope();
  mkdirSync(resolve(root, 'artifacts'), { recursive: true });
  for (const [name, content] of [['sample-report.html', sample.report.html], ['sample-report.md', sample.report.markdown]]) writeFileSync(resolve(root, 'artifacts', name), content + '\n', 'utf8');
  console.log('Generated fixture sample reports. No external requests or persistence writes were performed.');
}
