import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorkflow, ROOT } from './build-workflow.mjs';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';
import { Report } from '../src/report.mjs';
import { createWorkflow } from '../src/workflow.mjs';

const token = process.env.THORDATA_LIVE_TOKEN;
assert.ok(typeof token === 'string' && token.trim(), 'Set THORDATA_LIVE_TOKEN for the authorized live test.');
const packageRoot = resolve(ROOT, '../../n8n-nodes-thordata');
const installedRoot = resolve(ROOT, '../../n8n-nodes-thordata-testenv/n8n-instance/node_modules');
const requireFromN8n = createRequire(resolve(installedRoot, 'n8n/package.json'));
const { Thordata } = requireFromN8n(resolve(packageRoot, 'dist/nodes/Thordata/Thordata.node.js'));

const input = {
  spreadsheet_id: 'live-simulation-only',
  keywords: ['wireless earbuds'],
  target_name: 'JBL',
  brand_aliases: ['JBL'],
  product_ids: [],
  country: 'us',
  language: 'en',
  shelf_depth: 20,
  rank_alert_threshold: 3,
  share_alert_threshold_pp: 10,
  price_alert_threshold_pct: 5,
  enable_ai: false,
  enable_slack: false,
  run_anchor: new Date().toISOString(),
};
const config = Settings.parse(input, `live-${Date.now()}`);
const job = Settings.jobs(config)[0];
const workflow = buildWorkflow();
const node = workflow.nodes.find(candidate => candidate.name === 'Thordata Google Shopping');
assert.ok(node, 'The generated workflow must contain the Thordata Shopping node.');
const mappedParameters = {
  resource: 'serp',
  operation: 'google_shopping',
  'parameters.value': { q: job.keyword, gl: job.country, hl: job.language, start: 0 },
  options: {},
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`Live request returned non-JSON HTTP ${response.status}`); }
  if (!response.ok) throw new Error(`Live request returned HTTP ${response.status}: ${payload.msg || payload.message || 'unknown error'}`);
  return payload;
}

const context = {
  getInputData: () => [{ json: job }],
  getNode: () => node,
  continueOnFail: () => false,
  getNodeParameter: (name, index, fallback) => Object.hasOwn(mappedParameters, name) ? mappedParameters[name] : fallback,
  helpers: {
    httpRequest: async options => requestJson(options.url, { method: options.method, headers: { Accept: 'application/json' } }),
    httpRequestWithAuthentication: async function (credentialName, options) {
      assert.equal(credentialName, 'thordataApi');
      return requestJson(options.url, {
        method: options.method,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
        body: options.body,
      });
    },
  },
};

const nativeOutput = await new Thordata().execute.call(context);
assert.equal(nativeOutput.length, 1);
assert.equal(nativeOutput[0].length, 1);
const nativeJson = nativeOutput[0][0].json;
assert.equal(nativeJson.engine, 'google_shopping');
assert.equal(nativeJson.query, job.keyword);

const flow = createWorkflow({ Settings, Shopping, Metrics, History, Report });
const normalized = Shopping.normalize(nativeJson, job);
const measured = Metrics.measure(normalized, config);
const compared = History.compare(measured, null, [], config);
const envelope = { config, records: [compared], should_analyze: false };
const reportEnvelope = flow.report(envelope, [])[0].json;
const final = flow.finalize(reportEnvelope)[0].json;
assert.equal(final.records.length, 1);
assert.equal(final.config.enable_ai, false);
assert.equal(final.config.enable_slack, false);
assert.equal(final.records[0].comparison_status, 'baseline_created');
assert.equal(final.save.products.status, 'pending');
assert.equal(final.save.metrics.status, 'pending');
assert.ok(final.report.html.includes('Shopping share-of-shelf report'));

const result = {
  checkedAt: new Date().toISOString(),
  status: 'passed',
  mode: 'authorized live SERP plus offline workflow simulation',
  engine: nativeJson.engine,
  keyword: job.keyword,
  market: { country: job.country, language: job.language, start: job.start },
  nativeNode: { packageVersion: '0.1.6', outputEnvelope: 'passed', responseParser: 'passed' },
  upstream: {
    code: nativeJson.result?.code ?? null,
    cardsReceived: normalized.cards_received,
    validCards: normalized.valid_cards,
    reportedCredits: normalized.api_credits,
    cacheStatus: normalized.cache_status,
    responseId: normalized.upstream_response_id,
  },
  metrics: {
    collectionStatus: compared.collection_status,
    shelfDepth: compared.shelf_depth,
    shelfSeen: compared.shelf_seen,
    shelfComplete: compared.shelf_complete,
    slotsHeld: compared.slots_held,
    shareOfShelfPct: compared.share_of_shelf_pct,
    targetObserved: compared.target_observed,
    bestPosition: compared.best_position,
    uniqueTargetProducts: compared.unique_target_products,
    comparisonStatus: compared.comparison_status,
    competitors: compared.competitors.slice(0, 5),
  },
  targetProducts: compared.products.filter(product => product.is_target).slice(0, 10).map(product => ({
    position: product.position,
    productId: product.product_id,
    title: product.title,
    merchant: product.merchant,
    priceRaw: product.price_raw,
    priceValue: product.price_value,
    currency: product.currency,
    link: product.link,
  })),
  report: {
    analysisStatus: final.analysis.status,
    productSaveStatus: final.save.products.status,
    metricSaveStatus: final.save.metrics.status,
    htmlPath: 'artifacts/live-user-simulation-report.html',
  },
  externalWrites: { googleSheets: false, openai: false, slack: false },
  tokenPersisted: false,
};

mkdirSync(resolve(ROOT, 'artifacts'), { recursive: true });
writeFileSync(resolve(ROOT, 'artifacts/live-user-simulation.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
writeFileSync(resolve(ROOT, 'artifacts/live-user-simulation-report.html'), final.report.html + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
