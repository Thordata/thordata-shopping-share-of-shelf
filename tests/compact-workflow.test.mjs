import assert from 'node:assert/strict';
import test from 'node:test';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';
import { Report } from '../src/report.mjs';
import { createWorkflow } from '../src/workflow.mjs';

const flow = createWorkflow({ Settings, Shopping, Metrics, History, Report });
const prepared = () => flow.prepare({ spreadsheet_id: 'fixture', keywords: ['earbuds', 'speakers'], shelf_depth: 2, enable_ai: false, enable_slack: false, run_anchor: '2026-11-07T00:00:00.000Z' }, 'compact-run')[0].json;
const response = job => ({ engine: 'google_shopping', query: job.keyword, result: { code: 200, credits: 2, shopping: [1, 2].map(position => ({ position, product_id: `${job.keyword}-${position}`, title: 'JBL product', price: '$10.00', source: 'Store' })) } });

test('merged analysis preserves linked keywords and prepares at most one AI prompt', () => {
  assert.equal(typeof flow.analyzeSearches, 'function');
  const context = prepared();
  const jobs = flow.searchWithHistory(context, [], []).map(i => i.json);
  const envelope = flow.analyzeSearches(jobs, jobs.toReversed().map(job => ({ query_id: job.query_id, response: response(job) })))[0].json;
  assert.deepEqual(envelope.records.map(r => r.keyword), ['earbuds', 'speakers']);
  assert.ok(envelope.records.every(r => r.share_of_shelf_pct === 100));
  assert.equal(envelope.should_analyze, false); assert.equal(envelope.prompt, undefined);
  jobs.forEach(job => { job.config = { ...job.config, enable_ai: true }; });
  const enabled = flow.analyzeSearches(jobs, jobs.map(job => ({ query_id: job.query_id, response: response(job) })))[0].json;
  assert.equal(enabled.should_analyze, true); assert.match(enabled.prompt, /English/);
});

test('compact write batches carry the full context once and preserve save-before-baseline semantics', () => {
  assert.equal(typeof flow.productBatch, 'function');
  const jobs = flow.searchWithHistory(prepared(), [], []).map(i => i.json);
  const envelope = flow.analyzeSearches(jobs, jobs.map(job => ({ query_id: job.query_id, response: response(job) })))[0].json;
  const batch = flow.productBatch(envelope, []);
  assert.equal(batch.length, 4);
  assert.equal(batch.filter(i => i.json._context).length, 1);
  assert.equal(batch[0].json._context.records.length, 2);
  const acknowledgments = batch.map(i => ({ json: { record_id: i.json.record_id } }));
  const metrics = flow.metricBatch(batch[0].json._context, acknowledgments);
  assert.equal(metrics.length, 2); assert.equal(metrics.filter(i => i.json._context).length, 1);
  assert.ok(metrics.every(i => i.json.snapshot_complete));
  const final = flow.completeReport(metrics[0].json._context, metrics.map(i => ({ json: { snapshot_id: i.json.snapshot_id } })))[0].json;
  assert.equal(final.save.products.status, 'saved'); assert.equal(final.save.metrics.status, 'saved');
  assert.equal(final.should_notify, false); assert.doesNotThrow(() => flow.outcome(final));
  const failed = flow.metricBatch(batch[0].json._context, [{ json: { error: 'Fixture write failed' } }]);
  assert.ok(failed.every(i => i.json.snapshot_complete === false));
});

test('empty search data passes a single sentinel through the write bypass and retains failed keywords', () => {
  assert.equal(typeof flow.productBatch, 'function');
  const jobs = flow.searchWithHistory(prepared(), [], []).map(i => i.json);
  const envelope = flow.analyzeSearches(jobs, [])[0].json;
  const batch = flow.productBatch(envelope, []);
  assert.equal(batch.length, 1); assert.ok(batch[0].json._context); assert.equal(batch[0].json.record_id, undefined);
  const metrics = flow.metricBatch(batch[0].json._context, batch);
  assert.equal(metrics.length, 2);
  const final = flow.completeReport(metrics[0].json._context, metrics.map(i => ({ json: { snapshot_id: i.json.snapshot_id } })))[0].json;
  assert.match(final.report.html, /request_failed/);
  assert.throws(() => flow.outcome(final), /All keyword collections failed/);
});
