import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildWorkflow, ROOT } from './build-workflow.mjs';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';

const installed = resolve(process.env.N8N_NODE_MODULES || resolve(ROOT, '../../n8n-nodes-thordata-testenv/n8n-instance/node_modules'));
const packageRoot = resolve(process.env.THORDATA_PACKAGE_DIR || resolve(ROOT, '../../n8n-nodes-thordata'));
const packageInfo = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
assert.equal(packageInfo.version, '0.1.6');
process.env.NODE_PATH = installed;
Module._initPaths();
const req = createRequire(resolve(installed, 'n8n/package.json'));
const get = req('lodash/get');
const workflow = buildWorkflow();
const sample = JSON.parse(readFileSync(resolve(ROOT, 'tests/fixtures/shopping-earbuds.json'), 'utf8'));
const raw = sample.result ?? sample;
const schema = JSON.parse(readFileSync(resolve(packageRoot, 'dist/nodes/Thordata/serp-schema.snapshot.json'), 'utf8'));
const { Thordata } = req(resolve(packageRoot, 'dist/nodes/Thordata/Thordata.node.js'));
const native = new Thordata();
const config = Settings.parse({ spreadsheet_id: 'fixture-sheet', keywords: ['wireless earbuds'], brand_aliases: ['JBL'], enable_slack: false, run_anchor: '2026-11-05T01:00:00.000Z' }, 'native-contract');
const job = Settings.jobs(config)[0];
const searchNode = workflow.nodes.find(n => n.name === 'Thordata Google Shopping');
const searchParameters = { ...searchNode.parameters, parameters: { value: { q: job.keyword, gl: job.country, hl: job.language, start: 0 } } };
let requests = 0;
const context = {
  getInputData: () => [{ json: job }], getNode: () => searchNode, continueOnFail: () => true,
  getNodeParameter: (name, index, fallback) => get(searchParameters, name, fallback),
  helpers: {
    httpRequest: async () => schema,
    httpRequestWithAuthentication: async function (credential, options) {
      assert.equal(credential, 'thordataApi'); assert.equal(options.url, 'https://scraperapi.thordata.com/request');
      const body = new URLSearchParams(options.body);
      assert.equal(body.get('engine'), 'google_shopping'); assert.equal(body.get('q'), job.keyword);
      assert.equal(body.get('start'), '0'); assert.equal(body.get('isjson'), '1'); assert.equal(body.get('json'), '1');
      requests++; return raw;
    },
  },
};
const output = await native.execute.call(context);
assert.equal(requests, 1);
assert.deepEqual(JSON.parse(JSON.stringify(output[0][0].json.result.shopping)), raw.shopping);
assert.equal(output[0][0].json.query, job.keyword);
assert.deepEqual(output[0][0].pairedItem, { item: 0 });
const failed = await native.execute.call({ ...context, helpers: { ...context.helpers, httpRequestWithAuthentication: async () => { throw new Error('Fixture transport timeout'); } } });
assert.ok(failed[0][0].json.error);
assert.deepEqual(failed[0][0].pairedItem, { item: 0 });

const record = { ...Metrics.measure(Shopping.normalize(output[0][0].json, job), config), snapshot_complete: true, analysis_status: 'disabled' };
const action = req(resolve(installed, 'n8n-nodes-base/dist/nodes/Google/Sheet/v2/actions/sheet/appendOrUpdate.operation.js'));
let sheetWrites = 0;
for (const [name, row, columns, key] of [
  ['Save Product Snapshots', History.productRows(record)[0], History.PRODUCT_COLUMNS, 'record_id'],
  ['Save Keyword Metrics', History.metricRow(record), History.METRIC_COLUMNS, 'snapshot_id'],
]) {
  const node = workflow.nodes.find(n => n.name === name);
  const parameters = { ...node.parameters, columns: { ...node.parameters.columns, value: structuredClone(row) } };
  const sheet = {
    getData: async () => [columns], getColumnValues: async () => [],
    prepareDataForUpdateOrUpsert: async ({ inputData, indexKey, columnNamesList }) => { assert.equal(indexKey, key); assert.deepEqual(columnNamesList[0], columns); return { updateData: [], appendData: inputData }; },
    appendEmptyRowsOrColumns: async () => {},
    appendSheetData: async ({ inputData, valueInputMode }) => { assert.equal(valueInputMode, 'RAW'); assert.equal(inputData[0][key], row[key]); sheetWrites++; },
  };
  const result = await action.execute.call({ getInputData: () => [{ json: row }], getNode: () => node, getNodeParameter: (name, index, fallback) => get(parameters, name, fallback) }, sheet, name, '1');
  assert.equal(result[0].json[key], row[key]);
  assert.deepEqual(result[0].pairedItem, { item: 0 });
  assert.equal(History.confirm([row], result, key).status, 'saved');
  await assert.rejects(() => action.execute.call({ getInputData: () => [{ json: row }], getNode: () => node, getNodeParameter: (name, index, fallback) => get(parameters, name, fallback) }, { ...sheet, appendSheetData: async () => { throw new Error('Fixture transport rejection'); } }, name, '1'), /Fixture transport rejection/);
}
assert.equal(sheetWrites, 2);
mkdirSync(resolve(ROOT, 'artifacts'), { recursive: true });
const result = { checkedAt: new Date().toISOString(), status: 'passed', thordataVersion: packageInfo.version, packageSource: process.env.THORDATA_PACKAGE_SOURCE || 'local package source', nativeSearchSuccessAndError: true, nativeSheetsActions: 2, boundary: 'Actual Thordata execute and native Google Sheets appendOrUpdate actions with injected fixture transport/context. No credentials or live service calls. Sheets transport completion and native keyed outputs are verified; this does not verify a live spreadsheet account.' };
writeFileSync(resolve(ROOT, 'artifacts/native-contracts.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
