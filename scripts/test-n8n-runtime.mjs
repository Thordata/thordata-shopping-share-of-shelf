import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildWorkflow, ROOT } from './build-workflow.mjs';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';
import { command, isolatedEnvironment, locateRuntime, networkGuard, parseExecution, removeTemporaryDirectory } from './runtime-support.mjs';

const scenarios = ['first-run', 'changed', 'mixed', 'all-errors', 'history-error', 'product-history-error', 'empty', 'ai-disabled', 'ai-invalid', 'ai-error', 'product-save-error', 'metric-save-error', 'missing-ack', 'slack-error', 'reordered', 'omitted', 'gb-outside-shelf', 'no-change'];
const requested = process.argv.slice(2);
assert.ok(requested.every(scenario => scenarios.includes(scenario)), 'Unknown runtime scenario.');
const selectedScenarios = requested.length ? requested : scenarios;
const services = ['Read Keyword History', 'Read Baseline Products', 'Thordata Google Shopping', 'Explain Shopping Changes', 'Save Product Snapshots', 'Save Keyword Metrics', 'Send Shopping Alert'];
const allowedTypes = ['manualTrigger', 'scheduleTrigger', 'set', 'code', 'if', 'html', 'stickyNote'].map(n => `n8n-nodes-base.${n}`);
const testSettings = { keywords: ['earbuds', 'speakers'], target_name: 'JBL', brand_aliases: ['JBL'], product_ids: [], country: 'us', language: 'en', shelf_depth: 20, rank_alert_threshold: 3, share_alert_threshold_pp: 10, price_alert_threshold_pct: 5, enable_ai: true, enable_slack: true, slack_channel: 'CTESTONLY', spreadsheet_id: 'fixture-spreadsheet', run_anchor: '2026-11-05T01:00:00.000Z' };

function response(keyword, old = false, outside = false) {
  const targets = outside ? [25] : old ? [8, 15] : [3, 5, 9, 15];
  return { engine: 'google_shopping', query: keyword, result: { code: 200, credits: 2, cache_status: false,
    shopping: Array.from({ length: outside ? 40 : 20 }, (_, i) => { const position = i + 1; const target = targets.includes(position); return {
      position, product_id: position === (old ? 8 : 3) ? '1749519698216963169' : `${target ? 'T' : 'R'}-${position}`,
      title: `${target ? 'JBL' : 'Other'} ${keyword} product ${position}`, source: 'Merchant <unsafe>',
      price: outside ? 'GBP 49.00' : position === (old ? 8 : 3) ? old ? '$100.00' : '$110.00' : '$49.00', rating: 4.5, rating_count: 10, link: 'https://www.google.com/search?q=product',
    }; }) } };
}

function history(settings) {
  const config = Settings.parse({ ...settings, run_anchor: '2026-11-04T01:00:00.000Z' }, 'prior-run');
  const records = Settings.jobs(config).map(job => ({ ...Metrics.measure(Shopping.normalize(response(job.keyword, true), job), config), snapshot_complete: true, analysis_status: 'disabled', analysis_summary: '' }));
  return { metrics: records.map(record => History.metricRow(record)), products: records.flatMap(record => History.productRows(record)) };
}

function fixtureCode(node, scenario, settings, prior) {
  const prelude = `const p=${JSON.stringify(node.parameters)}; const scenario=${JSON.stringify(scenario)};
const evaluate=(value,index=0)=>typeof value==='string'&&value.startsWith('=')?$evaluateExpression(value.slice(1),index):value;
const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('Fixture contract: '+label);};
const input=$input.all();\n`;
  if (node.name === 'Read Keyword History' || node.name === 'Read Baseline Products') {
    const metrics = node.name === 'Read Keyword History';
    const data = scenario === 'first-run' ? [] : metrics ? prior.metrics : prior.products;
    return prelude + `equal(evaluate(p.documentId.value),${JSON.stringify(settings.spreadsheet_id)},'history spreadsheet');
equal(p.options.returnFirstMatch,false,'all rows');
${metrics && scenario === 'history-error' || !metrics && scenario === 'product-history-error' ? "throw new Error('Fixture history read failed');" : `return ${JSON.stringify(data)}.map(json=>({json,pairedItem:{item:0}}));`}`;
  }
  if (node.name === 'Thordata Google Shopping') return prelude + `
equal(p.resource,'serp','SERP resource');equal(p.operation,'google_shopping','Shopping engine');equal(p.parameters.value.start,0,'first page');
const responses=${JSON.stringify(Object.fromEntries(settings.keywords.map(q => [q, response(q, scenario === 'no-change', scenario === 'gb-outside-shelf')])))};
let output=input.map((item,index)=>{
const q=evaluate(p.parameters.value.q,index);equal(q,item.json.keyword,'paired keyword');equal(evaluate(p.parameters.value.gl,index),${JSON.stringify(settings.country.toLowerCase())},'country');equal(evaluate(p.parameters.value.hl,index),'en','language');
let json=responses[q];
if(scenario==='all-errors'||scenario==='mixed'&&index===3)json={error:'Fixture search timeout'};
if(scenario==='empty'||scenario==='mixed'&&index===2)json={engine:'google_shopping',query:q,result:{code:200,credits:2,shopping:[]}};
if(scenario==='mixed'&&index===1)json={...json,result:{...json.result,shopping:json.result.shopping.slice(0,12)}};
return {json,pairedItem:{item:index}};});
if(scenario==='reordered')output.reverse();if(scenario==='omitted')output=output.slice(0,1);return output;`;
  if (node.name === 'Explain Shopping Changes') return prelude + `
equal(input.length,1,'single logical model call');const prompt=evaluate(p.text);if(!/English/.test(prompt))throw new Error('English AI instruction missing');
${scenario === 'ai-error' ? "throw new Error('Fixture model error');" : scenario === 'ai-invalid' ? "return [{json:{text:'not valid JSON'},pairedItem:{item:0}}];" : `return [{json:{text:JSON.stringify({summary:'Review the measured product visibility changes.',findings:[]})},pairedItem:{item:0}}];`}`;
  if (node.name.startsWith('Save ')) {
    const product = node.name === 'Save Product Snapshots';
    return prelude + `
equal(p.options.cellFormat,'RAW','RAW writing');equal(evaluate(p.documentId.value),${JSON.stringify(settings.spreadsheet_id)},'write spreadsheet');
equal(p.columns.matchingColumns,${JSON.stringify([product ? 'record_id' : 'snapshot_id'])},'upsert key');
${scenario === (product ? 'product-save-error' : 'metric-save-error') ? "throw new Error('Fixture Sheets write failed');" : `let output=input.map((item,index)=>{const json=Object.fromEntries(Object.entries(p.columns.value).map(([key,value])=>[key,evaluate(value,index)??'']));equal(json.${product ? 'record_id' : 'snapshot_id'},item.json.${product ? 'record_id' : 'snapshot_id'},'row identity');return {json,pairedItem:{item:index}};});${!product && scenario === 'missing-ack' ? 'output=output.slice(0,1);' : ''}return output;`}`;
  }
  if (node.name === 'Send Shopping Alert') return prelude + `
equal(input.length,1,'one digest');equal(evaluate(p.channelId.value),${JSON.stringify(settings.slack_channel)},'channel');const text=evaluate(p.text);if(!text)throw new Error('Empty digest');
${scenario === 'slack-error' ? "throw new Error('Fixture Slack delivery failed');" : "return [{json:{ok:true,text},pairedItem:{item:0}}];"}`;
  throw new Error(`Unhandled fixture node ${node.name}`);
}

function candidate(original, scenario, index) {
  const settings = { ...testSettings, keywords: scenario === 'mixed' ? ['earbuds', 'speakers', 'headphones', 'microphones'] : testSettings.keywords,
    enable_slack: !['ai-disabled', 'reordered', 'omitted'].includes(scenario), enable_ai: scenario !== 'ai-disabled', country: scenario === 'gb-outside-shelf' ? 'GB' : 'us', language: scenario === 'gb-outside-shelf' ? 'EN' : 'en' };
  const prior = history(settings);
  const workflow = structuredClone(original); workflow.id = `ShoppingRuntime${index}`;
  workflow.nodes = workflow.nodes.filter(n => n.name !== 'OpenAI Chat Model').map(n => {
    if (n.name === 'Settings') n.parameters.assignments.assignments = n.parameters.assignments.assignments.map(a => ({ ...a, value: settings[a.name] }));
    if (services.includes(n.name)) return { ...n, type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForAllItems', jsCode: fixtureCode(n, scenario, settings, prior) } };
    assert.ok(allowedTypes.includes(n.type), `Unexpected unreplaced service: ${n.type}`); return n;
  });
  delete workflow.connections['OpenAI Chat Model'];
  const expected = structuredClone(original.connections); delete expected['OpenAI Chat Model'];
  assert.deepEqual(workflow.connections, expected, 'Fixture must preserve graph routing');
  return workflow;
}

function inspect(execution, scenario) {
  const result = execution.data.resultData;
  const runData = result.runData;
  const items = name => (runData[name] ?? []).flatMap(run => (run.data?.main ?? []).flat().filter(Boolean));
  const ran = name => Boolean(runData[name]?.length);
  const counts = { searches: items('Build Keyword Searches').length, model: ran('Explain Shopping Changes') ? 1 : 0, slack: ran('Send Shopping Alert') ? 1 : 0 };
  if (scenario === 'history-error' || scenario === 'product-history-error') {
    assert.ok(result.error); assert.equal(result.lastNodeExecuted, scenario === 'history-error' ? 'Read Keyword History' : 'Read Baseline Products'); assert.equal(counts.searches, 0);
    return { scenario, status: 'passed', execution: 'failed_as_expected', counts };
  }
  const final = items('Finalize Report')[0]?.json;
  assert.ok(final, `${scenario}: final report missing: ${result.error?.message}`);
  assert.equal(final.records.length, scenario === 'mixed' ? 4 : 2);
  for (const name of ['Build Shopping Report', 'Check Product Saves']) {
    const batch = items(name);
    assert.equal(batch.filter(item => item.json._context).length, 1, `${name}: carry the full context only once`);
    assert.ok(batch[0].json._context.records.length === final.records.length);
  }
  for (const name of ['Save Product Snapshots', 'Save Keyword Metrics']) assert.ok(items(name).every(item => !item.json._context), `${name}: context must not enter worksheet mappings`);
  assert.ok(items('Show Shopping Report')[0]?.json.html?.includes('<html'), 'Real HTML node must emit report');
  if (final.records.some(record => record.collection_status === 'success')) assert.ok(final.report.html.includes('href="https://www.google.com/search?q=product"'), 'Product links must survive the native Code sandbox and HTML rendering');
  const expectedFailure = ['all-errors', 'product-save-error', 'metric-save-error', 'missing-ack', 'slack-error'].includes(scenario);
  assert.equal(Boolean(result.error), expectedFailure, `${scenario}: ${result.error?.message}`);
  if (expectedFailure) assert.equal(result.lastNodeExecuted, scenario === 'slack-error' ? 'Send Shopping Alert' : 'Validate Run Outcome');
  if (scenario === 'first-run') { assert.equal(final.config.enable_slack, true); assert.ok(final.records.every(r => r.comparison_status === 'baseline_created')); assert.equal(counts.slack, 0); }
  if (scenario === 'no-change') { assert.equal(counts.slack, 0); assert.ok(final.records.every(r => r.rank_delta === 0 && r.share_delta_pp === 0)); }
  if (scenario === 'gb-outside-shelf') {
    assert.equal(final.config.country, 'gb'); assert.equal(final.config.language, 'en');
    for (const r of final.records) { assert.equal(r.best_position, 25); assert.equal(r.slots_held, 0); assert.equal(r.share_of_shelf_pct, 0); assert.equal(r.price_changes.length, 0); }
    for (const value of Object.values(final.report)) { assert.match(value, /25 \(outside Top 20 shelf\)/); assert.match(value, /Price change monitoring is unavailable for GB/); }
  }
  if (['changed', 'reordered', 'slack-error'].includes(scenario)) {
    for (const r of final.records) { assert.equal(r.rank_delta, 5); assert.equal(r.share_delta_pp, 10); assert.equal(r.best_position, 3); assert.equal(r.slots_held, 4); }
  }
  if (scenario === 'mixed') assert.deepEqual(final.records.map(r => r.collection_status), ['success', 'partial', 'empty', 'request_failed']);
  if (scenario === 'all-errors') { assert.ok(final.records.every(r => r.best_position === null)); assert.equal(counts.model, 0); }
  if (scenario === 'empty') { assert.ok(final.records.every(r => r.collection_status === 'empty')); assert.ok(!ran('Save Product Snapshots')); assert.equal(counts.model, 0); }
  if (scenario === 'ai-disabled') { assert.equal(counts.model, 0); assert.equal(counts.slack, 0); assert.equal(final.analysis.status, 'disabled'); }
  if (['ai-invalid', 'ai-error'].includes(scenario)) assert.equal(final.analysis.status, 'failed');
  if (scenario === 'product-save-error') assert.ok(final.records.every(r => r.snapshot_complete === false));
  if (scenario === 'missing-ack') assert.equal(final.save.metrics.status, 'unconfirmed');
  if (scenario === 'omitted') assert.deepEqual(final.records.map(r => r.collection_status), ['success', 'request_failed']);
  if (!['product-save-error', 'metric-save-error', 'missing-ack'].includes(scenario)) {
    assert.equal(final.save.products.status, 'saved'); assert.equal(final.save.metrics.status, 'saved');
  }
  if (scenario === 'changed') assert.equal(counts.slack, 1);
  assert.ok(counts.model <= 1 && counts.slack <= 1);
  return { scenario, status: 'passed', execution: expectedFailure ? 'failed_as_expected' : 'success', counts };
}

async function main() {
  const artifact = { checkedAt: new Date().toISOString(), status: 'failed', scenarios: [], boundary: 'Real n8n CLI with isolated SQLite and original Code/IF/Set/HTML nodes and connections. External service nodes are replaced by expression-aware fixtures and the disconnected model removed. Native service schemas are checked separately. No live credentials or services; a preload blocks networking and listeners. This is not a live end-to-end service test.' };
  let directory;
  try {
    const runtime = await locateRuntime(ROOT);
    artifact.runtime = { n8n: runtime.n8n, nodesBase: runtime.nodesBase, langchain: runtime.langchain, node: runtime.node, thordataTarget: '0.1.6' };
    directory = mkdtempSync(join(tmpdir(), 'thordata-shopping-runtime-'));
    const guard = networkGuard(directory); const env = isolatedEnvironment(directory, allowedTypes);
    const cli = args => command(runtime.executable, ['--require', guard, join(runtime.home, 'bin/n8n'), ...args], { cwd: directory, env });
    const original = buildWorkflow();
    artifact.fullSuite = requested.length === 0;
    for (const [index, scenario] of selectedScenarios.entries()) {
      const workflow = candidate(original, scenario, index); const path = join(directory, `${scenario}.json`);
      writeFileSync(path, JSON.stringify(workflow), 'utf8');
      const imported = await cli(['import:workflow', '--input', path]);
      assert.equal(imported.code, 0, imported.stderr + imported.stdout.slice(-1000));
      const output = await cli(['execute', '--id', workflow.id, '--rawOutput']);
      const checked = inspect(parseExecution(output.stdout), scenario);
      checked.cliExitCode = output.code;
      if (checked.execution === 'success') assert.equal(output.code, 0, output.stderr);
      artifact.scenarios.push(checked); console.log(`${scenario}: ${checked.execution}`);
    }
    artifact.status = 'passed';
  } catch (error) { artifact.error = error.message; throw error; }
  finally {
    if (directory) artifact.temporaryDirectoryRemoved = removeTemporaryDirectory(directory);
    mkdirSync(resolve(ROOT, 'artifacts'), { recursive: true });
    writeFileSync(resolve(ROOT, 'artifacts/runtime-validation.json'), JSON.stringify(artifact, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
