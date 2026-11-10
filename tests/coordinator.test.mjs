import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const url = new URL('../src/workflow.mjs', import.meta.url);
const module = existsSync(fileURLToPath(url)) ? await import(url) : null;
function flow(extra = {}) {
  assert.equal(typeof module?.createWorkflow, 'function', 'Monitoring coordinator is not implemented yet.');
  return module.createWorkflow({ Settings: {}, Metrics: {}, History: {}, Report: {}, Shopping: {
    normalize: (response, job) => ({ query_id: job.query_id, collection_status: response?.error ? 'request_failed' : 'success', marker: response?.marker }),
  }, ...extra });
}
const config = { enable_ai: false, enable_slack: false };
const jobs = ['a', 'b', 'c'].map(query_id => ({ query_id, keyword: query_id, config }));

test('reordered and omitted search responses retain the complete keyword job list', () => {
  const value = flow().normalize(jobs, [{ query_id: 'c', response: { marker: 'C' } }, { query_id: 'a', response: { marker: 'A' } }])[0].json;
  assert.deepEqual(value.samples.map(s => [s.query_id, s.collection_status, s.marker]), [['a', 'success', 'A'], ['b', 'request_failed', undefined], ['c', 'success', 'C']]);
});

test('duplicate response associations are errors rather than choosing an arbitrary response', () => {
  const value = flow().normalize(jobs.slice(0, 1), [{ query_id: 'a', response: { marker: 'A' } }, { query_id: 'a', response: { marker: 'B' } }])[0].json;
  assert.equal(value.samples[0].collection_status, 'request_failed');
});

test('the final report is rendered before fatal collection outcomes throw', () => {
  let rendered = false;
  const f = flow({ Report: { render: () => { rendered = true; return { html: '<p>Collection failed.</p>', markdown: 'Collection failed.', slackText: 'Collection failed.' }; } } });
  const final = f.finalize({ config, records: [{ collection_status: 'request_failed', alert_reasons: [] }], save: { products: { status: 'saved' }, metrics: { status: 'saved' } } })[0].json;
  assert.equal(rendered, true);
  assert.equal(final.should_notify, false);
  assert.match(final.report.html, /Collection failed/);
  assert.throws(() => f.outcome(final), /Show Shopping Report/);
});

test('unconfirmed persistence triggers a single enabled notification and a failed outcome', () => {
  const f = flow({ Report: { render: () => ({ html: '', markdown: '', slackText: 'Save unconfirmed.' }) } });
  const final = f.finalize({ config: { ...config, enable_slack: true }, records: [{ collection_status: 'success', alert_reasons: [] }], save: { products: { status: 'saved' }, metrics: { status: 'unconfirmed' } } })[0].json;
  assert.equal(final.should_notify, true);
  assert.throws(() => f.outcome(final), /persistence/i);
});
