import assert from 'node:assert/strict';
import test from 'node:test';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';
import { Report } from '../src/report.mjs';
import { createWorkflow } from '../src/workflow.mjs';
import { buildWorkflow } from '../scripts/build-workflow.mjs';

const input = { spreadsheet_id: 'fixture', slack_channel: 'CTEST', keywords: ['earbuds'], run_anchor: '2026-11-06T00:00:00.000Z', enable_ai: false };
function observation(extra = {}, targetPosition = 25) {
  const config = Settings.parse({ ...input, ...extra }, 'review');
  const job = Settings.jobs(config)[0];
  const response = { engine: 'google_shopping', query: job.keyword, result: { code: 200, shopping: Array.from({ length: 40 }, (_, i) => ({ position: i + 1, product_id: `product-${i + 1}`, title: `${i + 1 === targetPosition ? 'JBL' : 'Other'} earbuds`, source: 'Store', price: config.country === 'us' ? '$10.00' : 'GBP 10.00', link: 'https://example.com/product' })) } };
  const record = History.compare(Metrics.measure(Shopping.normalize(response, job), config), null, [], config);
  return { config, records: [record], save: { products: { status: 'saved' }, metrics: { status: 'saved' } } };
}

test('Slack defaults on in Settings and export, while explicit opt-out needs no channel', () => {
  assert.equal(Settings.parse(input, 'x').enable_slack, true);
  assert.throws(() => Settings.parse({ ...input, slack_channel: '' }, 'x'), /slack_channel/);
  assert.equal(Settings.parse({ ...input, enable_slack: false, slack_channel: '' }, 'x').enable_slack, false);
  assert.equal(Settings.parse({ ...input, enable_ai: undefined }, 'x').enable_ai, true);
  const fields = buildWorkflow().nodes.find(n => n.name === 'Settings').parameters.assignments.assignments;
  assert.equal(fields.find(f => f.name === 'enable_slack').value, true);
  assert.equal(fields.find(f => f.name === 'slack_channel').value, '');
});

test('default enabled Slack still respects first-run and event gates', () => {
  const flow = createWorkflow({ Settings, Shopping, Metrics, History, Report });
  const baseline = observation();
  assert.equal(flow.finalize(baseline)[0].json.should_notify, false);
  baseline.records[0].alert_reasons = ['rank_change'];
  assert.equal(flow.finalize(baseline)[0].json.should_notify, true);
  baseline.config.enable_slack = false;
  assert.equal(flow.finalize(baseline)[0].json.should_notify, false);
});

test('locale input is trimmed and lowercased before validation and scope identity', () => {
  const normalized = Settings.parse({ ...input, country: ' US ', language: ' PT-BR ' }, 'x');
  assert.equal(normalized.country, 'us'); assert.equal(normalized.language, 'pt-br');
  const canonical = Settings.parse({ ...input, country: 'us', language: 'pt-br' }, 'x');
  assert.equal(Settings.jobs(normalized)[0].scope_id, Settings.jobs(canonical)[0].scope_id);
  for (const value of [null, 123, {}, 'ZZ']) assert.throws(() => Settings.parse({ ...input, country: value }, 'x'), /country/);
});

test('non-US reports and AI instructions explain the unavailable price alerts', () => {
  const value = observation({ country: 'gb' });
  const result = Report.render(value);
  for (const output of Object.values(result)) assert.match(output, /Price change monitoring is unavailable for GB/);
  assert.match(result.html, /Raw prices remain visible/);
  assert.match(result.html, /GBP 10\.00/);
  assert.doesNotMatch(result.html, /No comparable price movements are available/);
  assert.match(Report.prompt(value), /Price change monitoring is unavailable for GB/);
  assert.doesNotMatch(Report.render(observation()).html, /Price change monitoring is unavailable/);
});

test('rank outside the shelf is clearly labeled without changing numeric metrics', () => {
  const value = observation(); const record = value.records[0];
  assert.equal(record.best_position, 25); assert.equal(record.slots_held, 0); assert.equal(record.share_of_shelf_pct, 0);
  for (const output of Object.values(Report.render(value))) assert.match(output, /25 \(outside Top 20 shelf\)/);
  const inside = observation({}, 20);
  assert.doesNotMatch(Report.render(inside).html, /20 \(outside Top 20 shelf\)/);
  assert.match(Report.analysis(value, null).findings[0].observation, /outside Top 20 shelf/);
});

test('price display bounds raw text without truncating stored evidence', () => {
  const value = observation({ country: 'gb' }, 1);
  const raw = 'GBP ' + '1234567890'.repeat(30);
  value.records[0].products[0].price_raw = raw;
  value.records[0].competitors[0].price_raw = raw;
  const output = Report.render(value);
  assert.doesNotMatch(output.html, new RegExp(raw));
  assert.match(output.html, new RegExp(raw.slice(0, 39) + '…'));
  assert.equal(History.productRows(value.records[0])[0].price_raw, raw);
});

test('large price movements are annotated rather than clamped or changed', () => {
  const value = observation({}, 1);
  value.records[0].price_changes = [{ product_id: 'product-1', title: 'JBL earbuds', merchant: 'Store', currency: 'USD', previous_price: 0.01, current_price: 500, change_pct: 4999900 }];
  for (const output of Object.values(Report.render(value))) assert.match(output, /\+4999900% \(unusually large change; verify source prices\)/);
  assert.equal(JSON.parse(History.metricRow(value.records[0]).price_changes_json)[0].change_pct, 4999900);
});

test('snapshot growth follows all valid cards rather than shelf depth', () => {
  const record = observation().records[0];
  assert.equal(record.shelf_depth, 20); assert.equal(History.productRows(record).length, 40);
});
