import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';
import { Report } from '../src/report.mjs';
import { createWorkflow } from '../src/workflow.mjs';
const url = new URL('../scripts/sample-report.mjs', import.meta.url);
const generator = existsSync(fileURLToPath(url)) ? await import(url) : null;
const flow = createWorkflow({ Settings, Shopping, Metrics, History, Report });

test('fixture sample retains every keyword and reports pending persistence truthfully', () => {
  assert.equal(typeof generator?.createSampleEnvelope, 'function', 'Fixture report generator is not implemented yet.');
  const value = generator.createSampleEnvelope();
  assert.deepEqual(value.records.map(record => record.keyword), ['wireless earbuds', 'standing desk']);
  assert.equal(value.analysis.status, 'disabled');
  assert.equal(value.records.length, 2);
  assert.ok(value.product_rows.length > 20);
  assert.equal(value.save.products.status, 'pending');
  assert.equal(value.save.metrics.status, 'pending');
  assert.match(value.report.html, /No baseline/);
  assert.match(value.report.html, /pending/);
  assert.match(value.report.html, /href="https?:/);
});

test('coordinator confirms native report rows and finalizes one first-run result without alerts', () => {
  assert.equal(typeof generator?.createSampleEnvelope, 'function', 'Fixture report generator is not implemented yet.');
  const value = generator.createSampleEnvelope();
  const productsSaved = flow.productSaves(value, flow.expandProducts(value))[0].json;
  const metricsSaved = flow.metricSaves(productsSaved, flow.expandMetrics(productsSaved))[0].json;
  const final = flow.finalize(metricsSaved)[0].json;
  assert.equal(final.should_notify, false);
  assert.deepEqual(final.fatal_reasons, []);
  assert.equal(final.save.products.status, 'saved');
  assert.equal(final.save.metrics.status, 'saved');
  assert.match(final.report.html, /saved; [1-9][0-9]* confirmed/);
  assert.equal(flow.outcome(final).length, 1);
});

test('all-failed collections keep a report through native coordinator persistence and outcome failure', () => {
  const prepared = flow.prepare({ spreadsheet_id: 'fixture-only', keywords: ['wireless earbuds'], run_anchor: '2026-11-05T09:00:00.000Z', enable_ai: true, enable_slack: false }, 'fixture-failure')[0].json;
  const jobs = flow.searches(flow.baselines(prepared, [])[0].json, []).map(item => item.json);
  const measured = flow.measure(flow.normalize(jobs, [])[0].json)[0].json;
  assert.equal(measured.should_analyze, false);
  const value = flow.report(measured, [])[0].json;
  assert.equal(value.analysis.status, 'skipped_no_evidence');
  const productSaved = flow.productSaves(value, [])[0].json;
  const metricSaved = flow.metricSaves(productSaved, flow.expandMetrics(productSaved))[0].json;
  const final = flow.finalize(metricSaved)[0].json;
  assert.equal(final.records.length, 1);
  assert.match(final.report.html, /request_failed/);
  assert.match(final.report.html, /Not available/);
  assert.throws(() => flow.outcome(final), /All keyword collections failed/);
});
