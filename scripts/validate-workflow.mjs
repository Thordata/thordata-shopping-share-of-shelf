import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { buildWorkflow, ROOT } from './build-workflow.mjs';
import { History } from '../src/history.mjs';

const expected = buildWorkflow();
const exported = JSON.parse(readFileSync(resolve(ROOT, 'thordata-shopping-share-of-shelf.json'), 'utf8'));
assert.deepEqual(exported, expected, 'Run npm run build after changing source.');
assert.equal(exported.active, false);
assert.equal(exported.settings.timezone, 'Asia/Shanghai');
const names = new Set(exported.nodes.map(node => node.name));
const notes = exported.nodes.filter(node => node.type === 'n8n-nodes-base.stickyNote');
assert.equal(notes.length, 4);
const steps = exported.nodes.filter(node => node.type !== 'n8n-nodes-base.stickyNote');
assert.equal(steps.length, 22);
const overview = notes.find(node => node.name === 'Workflow Overview');
const sections = notes.filter(node => node !== overview);
const wordCount = content => content.trim().split(/\s+/u).length;
assert.equal(notes.filter(node => node.parameters.color === 1).length, 1, 'Use one yellow overview note.');
assert.equal(overview.parameters.color, 1);
assert.ok(wordCount(overview.parameters.content) >= 100 && wordCount(overview.parameters.content) <= 300);
assert.match(overview.parameters.content, /### How it works/);
assert.match(overview.parameters.content, /### Setup/);
assert.ok(overview.position[0] + overview.parameters.width < Math.min(...sections.map(node => node.position[0])));
assert.ok(overview.position[1] < Math.min(...sections.map(node => node.position[1])));
for (const note of sections) {
  assert.equal(note.parameters.color, 7, `${note.name}: use a white section note`);
  assert.ok(wordCount(note.parameters.content) < 50, `${note.name}: keep section text below 50 words`);
  const [x, y] = note.position;
  const members = steps.filter(node => node.position[0] >= x && node.position[0] + 100 <= x + note.parameters.width && node.position[1] >= y && node.position[1] + 170 <= y + note.parameters.height);
  assert.ok(members.length >= 2, `${note.name}: enclose a logical node group`);
  assert.ok(members.every(node => node.position[1] >= y + 220), `${note.name}: reserve text space above nodes`);
}
for (let a = 0; a < notes.length; a++) for (let b = a + 1; b < notes.length; b++) {
  const left = notes[a], right = notes[b];
  assert.ok(left.position[0] + left.parameters.width <= right.position[0] || right.position[0] + right.parameters.width <= left.position[0] || left.position[1] + left.parameters.height <= right.position[1] || right.position[1] + right.parameters.height <= left.position[1], 'Note regions must not overlap');
}
for (const step of steps) assert.ok(typeof step.notes === 'string' && step.notes.trim(), `${step.name}: add a useful English node note`);
const mainRow = steps.filter(node => !['Check Rankings Daily', 'OpenAI Chat Model'].includes(node.name));
assert.ok(mainRow.every(node => node.position[1] === 0));
assert.equal(new Set(mainRow.map(node => node.position[0])).size, mainRow.length);
assert.equal(names.size, exported.nodes.length, 'Node names must be unique.');
assert.equal(new Set(exported.nodes.map(node => node.id)).size, exported.nodes.length, 'Node IDs must be unique.');
let codeCount = 0;
for (const node of exported.nodes) {
  assert.ok(!node.credentials, `${node.name}: remove saved credentials`);
  assert.doesNotMatch(JSON.stringify(node), /\p{Script=Han}/u, `${node.name}: authored workflow content must be English`);
  assert.doesNotMatch(JSON.stringify(node), /Bearer\s+[a-z0-9]{20,}/i, 'Remove secret material.');
  assert.ok(node.position.length === 2 && node.position.every(Number.isFinite));
  for (const [, reference] of JSON.stringify(node.parameters).matchAll(/\$\('([^']+)'\)/g)) assert.ok(names.has(reference), `${node.name}: stale reference ${reference}`);
  if (node.type === 'n8n-nodes-base.code') {
    new Script(`(async function(){${node.parameters.jsCode}\n})`);
    assert.doesNotMatch(node.parameters.jsCode, /\brequire\s*\(|^import\s/m);
    codeCount++;
  }
}
for (const [from, ports] of Object.entries(exported.connections)) {
  assert.ok(names.has(from));
  for (const [type, outputs] of Object.entries(ports)) for (const edges of outputs) for (const edge of edges) {
    assert.ok(names.has(edge.node), `Unknown destination ${edge.node}`);
    assert.equal(edge.type, type); assert.ok(Number.isInteger(edge.index) && edge.index >= 0);
    const source = mainRow.find(node => node.name === from);
    const target = mainRow.find(node => node.name === edge.node);
    if (source && target && type === 'main') assert.ok(source.position[0] < target.position[0], 'Main edges must flow left to right');
  }
}
const searches = exported.nodes.filter(node => node.type === 'n8n-nodes-thordata.thordata');
assert.equal(searches.length, 1);
assert.equal(searches[0].parameters.resource, 'serp'); assert.equal(searches[0].parameters.operation, 'google_shopping');
assert.equal(searches[0].parameters.parameters.value.start, 0); assert.ok(!searches[0].retryOnFail);
assert.equal(exported.nodes.filter(node => node.type === '@n8n/n8n-nodes-langchain.chainLlm').length, 1);
for (const [file, columns, nodeName, key] of [
  ['Keyword Metrics.csv', History.METRIC_COLUMNS, 'Save Keyword Metrics', 'snapshot_id'],
  ['Product Snapshots.csv', History.PRODUCT_COLUMNS, 'Save Product Snapshots', 'record_id'],
]) {
  assert.equal(readFileSync(resolve(ROOT, 'templates', file), 'utf8').trim(), columns.join(','));
  const n = exported.nodes.find(node => node.name === nodeName);
  assert.deepEqual(Object.keys(n.parameters.columns.value), columns);
  assert.deepEqual(n.parameters.columns.matchingColumns, [key]);
  assert.equal(n.parameters.options.cellFormat, 'RAW');
}
assert.deepEqual(exported.pinData, {});
assert.ok(!exported.id && !exported.versionId && !exported.staticData);
for (const directory of ['src', 'scripts']) for (const name of readdirSync(resolve(ROOT, directory)).filter(name => name.endsWith('.mjs'))) {
  assert.doesNotMatch(readFileSync(resolve(ROOT, directory, name), 'utf8'), /\p{Script=Han}/u, `${directory}/${name}: workflow code and comments must not contain Chinese`);
}
const settings = exported.nodes.find(node => node.name === 'Settings').parameters.assignments.assignments;
for (const name of ['slack_channel', 'spreadsheet_id']) assert.equal(settings.find(field => field.name === name).value, '', `${name}: do not export an account destination`);
const installed = resolve(process.env.N8N_NODE_MODULES || resolve(ROOT, '../../n8n-nodes-thordata-testenv/n8n-instance/node_modules'));
let nativeChecked = 0;
if (existsSync(resolve(installed, 'n8n/package.json'))) {
  const req = createRequire(resolve(installed, 'n8n/package.json'));
  const { NodeHelpers } = req('n8n-workflow');
  const files = {
    manualTrigger: ['ManualTrigger/ManualTrigger.node.js', 'ManualTrigger'], scheduleTrigger: ['Schedule/ScheduleTrigger.node.js', 'ScheduleTrigger'],
    set: ['Set/Set.node.js', 'Set'], code: ['Code/Code.node.js', 'Code'], if: ['If/If.node.js', 'If'], html: ['Html/Html.node.js', 'Html'],
    googleSheets: ['Google/Sheet/GoogleSheets.node.js', 'GoogleSheets'], slack: ['Slack/Slack.node.js', 'Slack'], stickyNote: ['StickyNote/StickyNote.node.js', 'StickyNote'],
  };
  for (const n of exported.nodes) {
    let instance;
    if (n.type.startsWith('n8n-nodes-base.')) {
      const [file, cls] = files[n.type.split('.').at(-1)];
      instance = new (req(resolve(installed, 'n8n-nodes-base/dist/nodes', file))[cls])();
    } else if (n.type.endsWith('.chainLlm')) instance = new (req(resolve(installed, '@n8n/n8n-nodes-langchain/dist/nodes/chains/ChainLlm/ChainLlm.node.js')).ChainLlm)();
    else if (n.type.endsWith('.lmChatOpenAi')) instance = new (req(resolve(installed, '@n8n/n8n-nodes-langchain/dist/nodes/llms/LMChatOpenAi/LmChatOpenAi.node.js')).LmChatOpenAi)();
    else if (n.type === 'n8n-nodes-thordata.thordata') instance = new (req(resolve(ROOT, '../../n8n-nodes-thordata/dist/nodes/Thordata/Thordata.node.js')).Thordata)();
    assert.ok(instance, `Unverified node type: ${n.type}`);
    if (typeof instance.getNodeType === 'function') instance = instance.getNodeType(n.typeVersion);
    assert.ok([].concat(instance.description.version).includes(n.typeVersion), `${n.name}: unsupported typeVersion`);
    const defaults = NodeHelpers.getNodeParameters(instance.description.properties, n.parameters, true, false, n, instance.description) || {};
    const issues = NodeHelpers.getNodeParametersIssues(instance.description.properties, { ...n, parameters: defaults }, instance.description);
    assert.ok(!issues || !Object.keys(issues).length, `${n.name}: ${JSON.stringify(issues)}`);
    nativeChecked++;
  }
}
console.log(`Validated ${exported.nodes.length} canvas items, ${codeCount} embedded Code nodes, ${nativeChecked} local native parameter contracts, English content, two RAW worksheet schemas, and inactive credential-free export.`);
console.log(`Documentation: ${wordCount(overview.parameters.content)} overview words; section words ${sections.map(note => wordCount(note.parameters.content)).join(', ')}; one yellow overview and three white sections.`);
