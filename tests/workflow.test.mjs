import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const builderUrl = new URL('../scripts/build-workflow.mjs', import.meta.url);
const builder = existsSync(fileURLToPath(builderUrl)) ? await import(builderUrl) : null;
function workflow() {
  assert.equal(typeof builder?.buildWorkflow, 'function', 'The importable workflow builder is not implemented yet.');
  return builder.buildWorkflow();
}

test('compact canvas keeps 22 execution/model nodes and four notes with one horizontal main row', () => {
  const w = workflow();
  const notes = w.nodes.filter(n => n.type === 'n8n-nodes-base.stickyNote');
  const steps = w.nodes.filter(n => n.type !== 'n8n-nodes-base.stickyNote');
  assert.equal(steps.length, 22); assert.equal(notes.length, 4);
  const main = steps.filter(n => !['Check Rankings Daily', 'OpenAI Chat Model'].includes(n.name));
  assert.ok(main.every(n => n.position[1] === 0));
  assert.equal(new Set(main.map(n => n.position[0])).size, main.length);
  for (const removed of ['Select Baselines', 'Normalize Shopping Results', 'Prepare Analysis', 'Expand Product Snapshots', 'Expand Keyword Metrics', 'Check Metric Saves']) assert.ok(!w.nodes.some(n => n.name === removed), removed);
  for (const [name, connections] of Object.entries(w.connections)) {
    if (!main.some(n => n.name === name)) continue;
    const from = main.find(n => n.name === name);
    for (const edges of connections.main ?? []) for (const edge of edges) {
      const to = main.find(n => n.name === edge.node);
      if (to) assert.ok(to.position[0] > from.position[0], `${name} -> ${to.name} must point right`);
    }
  }
});

test('uses the published Shopping node once per keyword without automatic paid retries', () => {
  const w = workflow();
  const searches = w.nodes.filter(n => n.type === 'n8n-nodes-thordata.thordata');
  assert.equal(searches.length, 1);
  assert.equal(searches[0].typeVersion, 1);
  assert.equal(searches[0].parameters.resource, 'serp');
  assert.equal(searches[0].parameters.operation, 'google_shopping');
  assert.equal(searches[0].parameters.parameters.value.start, 0);
  assert.equal(searches[0].onError, 'continueRegularOutput');
  assert.ok(!searches[0].retryOnFail);
  assert.ok(!w.nodes.some(n => n.type === 'n8n-nodes-base.wait'));
});

test('ships inactive with English authored content and no saved account state', () => {
  const w = workflow();
  assert.equal(w.active, false);
  assert.equal(w.settings.timezone, 'Asia/Shanghai');
  assert.ok(!w.staticData && !w.id && !w.versionId);
  assert.deepEqual(w.pinData ?? {}, {});
  for (const node of w.nodes) {
    assert.ok(!node.credentials, `${node.name} must not export account identifiers`);
    assert.doesNotMatch(JSON.stringify([node.name, node.notes, node.parameters]), /[\u3400-\u9fff]/u);
    assert.doesNotMatch(JSON.stringify(node), /Bearer\s+[a-z0-9]{20,}/i);
  }
  const settings = w.nodes.find(n => n.name === 'Settings').parameters.assignments.assignments;
  assert.equal(settings.find(s => s.name === 'enable_slack').value, true);
});

test('all graph destinations exist and embedded Code compiles without external modules', () => {
  const w = workflow();
  const names = new Set(w.nodes.map(n => n.name));
  assert.equal(names.size, w.nodes.length);
  for (const [from, ports] of Object.entries(w.connections)) {
    assert.ok(names.has(from), from);
    for (const outputs of Object.values(ports)) for (const edges of outputs) for (const edge of edges) {
      assert.ok(names.has(edge.node), edge.node);
      assert.ok(Number.isInteger(edge.index) && edge.index >= 0);
    }
  }
  for (const n of w.nodes.filter(n => n.type === 'n8n-nodes-base.code')) {
    assert.doesNotMatch(n.parameters.jsCode, /\brequire\s*\(|^import\s/m);
    assert.doesNotThrow(() => new Script(`(async function(){${n.parameters.jsCode}\n})`), n.name);
  }
});

test('writes explicit RAW schemas keyed by snapshot and slot and reads all matching history', () => {
  const w = workflow();
  for (const [name, key] of [['Save Product Snapshots', 'record_id'], ['Save Keyword Metrics', 'snapshot_id']]) {
    const n = w.nodes.find(n => n.name === name);
    assert.equal(n.type, 'n8n-nodes-base.googleSheets');
    assert.equal(n.parameters.operation, 'appendOrUpdate');
    assert.deepEqual(n.parameters.columns.matchingColumns, [key]);
    assert.equal(n.parameters.options.cellFormat, 'RAW');
    assert.equal(n.parameters.columns.mappingMode, 'defineBelow');
    assert.equal(n.onError, 'continueRegularOutput');
  }
  for (const n of w.nodes.filter(n => n.type === 'n8n-nodes-base.googleSheets' && n.parameters.operation === 'read')) {
    assert.equal(n.parameters.options.returnFirstMatch, false);
    assert.equal(n.alwaysOutputData, true);
    assert.notEqual(n.onError, 'continueRegularOutput');
  }
});
