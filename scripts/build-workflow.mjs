import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { History } from '../src/history.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SETTINGS = {
  keywords: ['wireless earbuds', 'bluetooth headphones', 'portable speakers'],
  target_name: 'JBL', brand_aliases: ['JBL'], product_ids: [], country: 'us', language: 'en',
  shelf_depth: 20, rank_alert_threshold: 3, share_alert_threshold_pp: 10,
  price_alert_threshold_pct: 5, enable_ai: true, enable_slack: true,
  slack_channel: '', spreadsheet_id: '', run_anchor: '={{ $now.toUTC().toISO() }}',
};
const source = name => readFileSync(resolve(ROOT, 'src', `${name}.mjs`), 'utf8').replace(/\r\n/g, '\n').replace(/^export /gm, '');
function node(name, type, typeVersion, parameters, position, extra = {}) {
  return { id: `shopping-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, type, typeVersion, position, parameters, ...extra };
}
function code(name, modules, body, position) {
  const declarations = ['Settings', 'Shopping', 'Metrics', 'History', 'Report'].map(label => modules.includes(label.toLowerCase()) ? source(label.toLowerCase()) : `const ${label} = {};`);
  return node(name, 'n8n-nodes-base.code', 2, { mode: 'runOnceForAllItems', jsCode: declarations.join('\n') + '\n' + source('workflow') + '\nconst Flow = createWorkflow({Settings,Shopping,Metrics,History,Report});\n' + body }, position);
}
function gate(name, expression, position) {
  return node(name, 'n8n-nodes-base.if', 2.2, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'condition', leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }, position);
}
function sheet(name, worksheet, operation, position, columns, key) {
  const parameters = { resource: 'sheet', operation,
    documentId: { __rl: true, mode: 'id', value: "={{ $('Prepare Monitoring Run').first().json.config.spreadsheet_id }}" },
    sheetName: { __rl: true, mode: 'name', value: worksheet },
    options: operation === 'read' ? { returnFirstMatch: false } : { cellFormat: 'RAW' },
  };
  if (columns) parameters.columns = { mappingMode: 'defineBelow', value: Object.fromEntries(columns.map(column => [column, `={{ $json.${column} }}`])), matchingColumns: [key], schema: columns.map(id => ({ id, displayName: id, type: 'string', required: false, defaultMatch: id === key, display: true, canBeUsedToMatch: id === key })), attemptToConvertTypes: false, convertFieldsToString: false };
  return node(name, 'n8n-nodes-base.googleSheets', 4.6, parameters, position, { alwaysOutputData: true, ...(operation === 'read' ? { executeOnce: true } : { onError: 'continueRegularOutput' }) });
}
function connect(graph, from, to, output = 0, input = 0, type = 'main') {
  graph[from] ??= {}; graph[from][type] ??= [];
  while (graph[from][type].length <= output) graph[from][type].push([]);
  graph[from][type][output].push({ node: to, type, index: input });
}

export function buildWorkflow() {
  const metricColumns = History.METRIC_COLUMNS;
  const productColumns = History.PRODUCT_COLUMNS;
  const nodes = [
    node('Run Manually', 'n8n-nodes-base.manualTrigger', 1, {}, [0, 0]),
    node('Check Rankings Daily', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 9, triggerAtMinute: 0 }] } }, [0, 180]),
    node('Settings', 'n8n-nodes-base.set', 3.4, { mode: 'manual', assignments: { assignments: Object.entries(DEFAULT_SETTINGS).map(([name, value]) => ({ id: name, name, value, type: Array.isArray(value) ? 'array' : typeof value })) }, includeOtherFields: false, options: {} }, [260, 0]),
    code('Prepare Monitoring Run', ['settings'], 'return Flow.prepare($input.first().json, $execution.id);', [520, 0]),
    sheet('Read Keyword History', 'Keyword Metrics', 'read', [780, 0]),
    sheet('Read Baseline Products', 'Product Snapshots', 'read', [1300, 0]),
    code('Build Keyword Searches', ['history'], "return Flow.searchWithHistory($('Prepare Monitoring Run').first().json, $('Read Keyword History').all(), $input.all());", [1560, 0]),
    node('Thordata Google Shopping', 'n8n-nodes-thordata.thordata', 1, { resource: 'serp', operation: 'google_shopping', parameters: {
      mappingMode: 'defineBelow', value: { q: '={{ $json.keyword }}', gl: '={{ $json.country }}', hl: '={{ $json.language }}', start: 0 }, matchingColumns: [],
      schema: [['q', 'Search Query', 'string'], ['gl', 'Country', 'string'], ['hl', 'Language', 'string'], ['start', 'Result Offset', 'number']].map(([id, displayName, type]) => ({ id, displayName, type, required: id === 'q', defaultMatch: false, display: true, canBeUsedToMatch: false })),
    }, options: {} }, [0, 640], { onError: 'continueRegularOutput', alwaysOutputData: true }),
    code('Measure Shelf and Compare', ['shopping', 'metrics', 'history', 'report'], "const jobs = $('Build Keyword Searches').all().map(i => i.json);\nconst pairs = $input.all().map((item,index) => { let source; try { source = $('Build Keyword Searches').itemMatching(index).json; } catch {} return {response:item.json,query_id:source?.query_id}; });\nreturn Flow.analyzeSearches(jobs,pairs);", [520, 640]),
    gate('AI Analysis Enabled?', '={{ $json.should_analyze }}', [780, 640]),
    node('Explain Shopping Changes', '@n8n/n8n-nodes-langchain.chainLlm', 1.7, { promptType: 'define', text: '={{ $json.prompt }}', hasOutputParser: false, batching: { batchSize: 1 } }, [1300, 640], { onError: 'continueRegularOutput', alwaysOutputData: true }),
    node('OpenAI Chat Model', '@n8n/n8n-nodes-langchain.lmChatOpenAi', 1.2, { model: { __rl: true, mode: 'id', value: 'gpt-5.6-terra' }, options: { reasoningEffort: 'low', maxRetries: 0, timeout: 60000 } }, [1300, 850]),
    code('Build Shopping Report', ['history', 'report'], "return Flow.productBatch($('Measure Shelf and Compare').first().json, $input.all());", [1560, 640]),
    gate('Have Product Snapshots?', '={{ Boolean($json.record_id) }}', [0, 1320]),
    sheet('Save Product Snapshots', 'Product Snapshots', 'appendOrUpdate', [520, 1320], productColumns, 'record_id'),
    code('Check Product Saves', ['history'], "return Flow.metricBatch($('Build Shopping Report').first().json._context,$input.all());", [780, 1320]),
    sheet('Save Keyword Metrics', 'Keyword Metrics', 'appendOrUpdate', [1300, 1320], metricColumns, 'snapshot_id'),
    code('Finalize Report', ['history', 'report'], "return Flow.completeReport($('Check Product Saves').first().json._context,$input.all());", [0, 1940]),
    node('Show Shopping Report', 'n8n-nodes-base.html', 1.2, { operation: 'generateHtmlTemplate', html: '={{ $json.report.html }}' }, [260, 1940]),
    gate('Should Notify Slack?', "={{ $('Finalize Report').first().json.should_notify }}", [520, 1940]),
    node('Send Shopping Alert', 'n8n-nodes-base.slack', 2.3, { resource: 'message', operation: 'post', select: 'channel', channelId: { __rl: true, mode: 'id', value: "={{ $('Finalize Report').first().json.config.slack_channel }}" }, text: "={{ $('Finalize Report').first().json.report.slackText }}", otherOptions: { includeLinkToWorkflow: false } }, [780, 1940]),
    code('Validate Run Outcome', [], "return Flow.outcome($('Finalize Report').first().json);", [1040, 1940]),
  ];
  const notes = {
    Settings: 'Configure keywords, target_name, brand_aliases or product_ids, country, language, shelf_depth, alert thresholds, and spreadsheet_id. AI and Slack default to true. Configure their credentials and slack_channel, or disable their flags. Keep run_anchor as its expression. Use arrays for keyword and target lists.',
    'Prepare Monitoring Run': 'Validate Settings before any paid request. Capture a single observation timestamp and stable keyword scopes. Invalid settings fail here with an English message.',
    'Read Keyword History': 'Select Google Sheets OAuth2 credentials with access to spreadsheet_id. Read the Keyword Metrics worksheet using the supplied headers. Empty history starts a new baseline; a read failure stops the run before paid searches.',
    'Read Baseline Products': 'Use the same Google Sheets OAuth2 account and spreadsheet. Read Product Snapshots for comparisons with earlier saved offers. A read failure stops the run. Retain each baseline together with its product rows when archiving history.',
    'Build Keyword Searches': 'Use both history worksheets to select the latest complete saved baseline for each matching target, keyword, market, and shelf depth. Produce one search per unique keyword. A new scope has no baseline; incomplete or failed observations are never selected.',
    'Thordata Google Shopping': 'Select Thordata SERP API credentials from the published 0.1.6 package. Use google_shopping, start=0. Each item is a billable search. Automatic node retries are disabled; per-item failures remain reportable.',
    'Measure Shelf and Compare': 'Calculate best observed rank, Top N share, and comparable price changes for every keyword. Label partial coverage and ranks outside the shelf. Price monitoring supports US/USD only. Failed samples remain visible and do not create movement alerts. Prepare AI evidence only when useful.',
    'AI Analysis Enabled?': 'True: enable_ai is true and usable evidence exists; send one analysis request for the whole run. False: bypass OpenAI and continue to Build Shopping Report with deterministic English guidance.',
    'Explain Shopping Changes': 'Generate English JSON findings using known query IDs. Malformed output, unknown IDs, or a request error falls back to deterministic guidance; no automatic repair call.',
    'OpenAI Chat Model': 'Select an OpenAI credential before running with enable_ai=true. The default model is gpt-5.6-terra with low reasoning effort; choose another compatible model available to your account if needed. No temperature is forced. Set enable_ai=false to run without AI.',
    'Build Shopping Report': 'Combine measured results with validated AI findings or English fallback guidance. Keep every keyword, including failures. Prepare product rows and preserve the full report for save checks. Runs with no products still continue to record keyword status and display a report.',
    'Have Product Snapshots?': 'True: send available product rows to Save Product Snapshots. False: skip that write and continue to Check Product Saves. Both paths preserve the keyword results and report.',
    'Save Product Snapshots': 'Select Google Sheets OAuth2 credentials. Match record_id with explicit RAW columns. Nulls may return as empty cells. A missing acknowledgment is unconfirmed, not saved.',
    'Check Product Saves': 'Check that every expected product row was acknowledged, then prepare keyword metric rows. An incomplete product save cannot become a successful baseline. Save failures remain visible in the final report.',
    'Save Keyword Metrics': 'Select Google Sheets OAuth2 credentials. Write to Keyword Metrics using the supplied headers and RAW values, matching snapshot_id. A new execution records a new observation; retries within the same execution update those rows. Keep existing history for future comparisons.',
    'Finalize Report': 'Verify keyword metric save acknowledgments and render English metrics, coverage, analysis status, reported credits, and actual save outcomes. Missing acknowledgments remain unconfirmed. First runs establish a baseline; operational issues remain visible.',
    'Show Shopping Report': 'Open the HTML output after execution to view the report. Finalize Report also retains report.html, report.markdown, report.slackText, and the complete structured evidence.',
    'Should Notify Slack?': 'True: Slack is enabled and a threshold change, newly observed or absent target, or operational issue needs attention. False: skip sending and proceed to Validate Run Outcome. A successful first baseline or unchanged run does not send a routine message.',
    'Send Shopping Alert': 'Select Slack credentials and a channel ID in Settings. Send one digest per run. A Slack error fails the execution while preserving earlier successful saves.',
    'Validate Run Outcome': 'Run after the report is available. All-request failure or unconfirmed/failed persistence fails the execution instead of leaving misleading green success.',
    'Run Manually': 'Use for setup testing. Configure Settings, credentials, and both worksheet headers. Start with one keyword; disable AI and Slack if their credentials are not configured. Open Show Shopping Report and inspect saved rows before enabling the daily schedule.',
    'Check Rankings Daily': 'Daily at 09:00 Asia/Shanghai. Import is inactive; enable scheduling only after a successful manual test. Avoid overlapping executions for the same workflow.',
  };
  for (const n of nodes) n.notes = notes[n.name];
  const mainRow = nodes.filter(n => !['Check Rankings Daily', 'OpenAI Chat Model'].includes(n.name));
  mainRow.forEach((n, index) => { n.position = [index * 260, 0]; });
  nodes.find(n => n.name === 'Check Rankings Daily').position = [0, 200];
  nodes.find(n => n.name === 'OpenAI Chat Model').position = [nodes.find(n => n.name === 'Explain Shopping Changes').position[0], 220];
  const overview = `## Google Shopping visibility monitor

### How it works
Monitor your products for selected Google Shopping keywords with Thordata. Compare best observed rank, Top N shelf share, and eligible prices with the latest complete saved snapshot. Google Sheets keeps history; optional OpenAI analysis explains the evidence. View an HTML report after every completed collection. Slack sends changes or operational issues, not routine first-baseline messages.

Each keyword requests one search page. Share describes observed product slots, not sales. Numeric price monitoring supports US/USD only; other markets retain raw prices. Incomplete samples cannot replace a complete baseline.

### Setup
1. Install n8n-nodes-thordata@0.1.6. Import the supplied CSV headers into Keyword Metrics and Product Snapshots in one Google spreadsheet.
2. In Settings, set spreadsheet_id, keywords, target_name, and brand_aliases or exact product_ids. Choose country, language, shelf_depth, and rank, share, and price alert thresholds. Keep run_anchor as its expression.
3. Select Thordata SERP API credentials on Thordata Google Shopping and Google Sheets OAuth2 credentials on all four Sheets nodes.
4. AI and Slack default to enabled. Select an OpenAI credential and model on OpenAI Chat Model. Select Slack credentials on Send Shopping Alert and set slack_channel, or disable the corresponding enable_ai/enable_slack flags.
5. Run one keyword manually. Open Show Shopping Report and check both worksheet saves. Rerun to check historical comparison; a first baseline has no movement alert. Activate the daily 09:00 Asia/Shanghai schedule only after successful testing.

Store secrets in n8n Credentials; shared exports contain no account IDs or keys.`;
  const groups = [
    ['Workflow Overview', overview, [-800, -320], 640, 1000, 1],
    ['Settings and History Guide', '## 1 - Configure and load history\n\nValidate Settings and read both history worksheets. Select the latest complete saved baseline for each keyword, then prepare searches. Empty history starts a baseline; failed history reads stop before paid requests.', [-80, -240], 1500, 680, 7],
    ['Search and Analysis Guide', '## 2 - Search, measure, and explain\n\nCollect one Shopping page per keyword. Measure rank and observed Top N share against compatible history. Use optional AI for an English explanation. Output product rows and a report, retaining partial results and failures.', [1480, -240], 1300, 680, 7],
    ['Persistence and Delivery Guide', '## 3 - Save, report, and notify\n\nSave products, then metrics; verify both writes. Empty collections skip product writes. View the HTML report. Slack sends qualifying changes or operational issues. Final validation reports failures after the report is available.', [2780, -240], 2380, 680, 7],
  ];
  for (const [name, content, position, width, height, color] of groups) nodes.push(node(name, 'n8n-nodes-base.stickyNote', 1, { content, width, height, color }, position));
  const c = {};
  const chain = names => names.slice(1).forEach((name, i) => connect(c, names[i], name));
  connect(c, 'Run Manually', 'Settings'); connect(c, 'Check Rankings Daily', 'Settings');
  chain(['Settings', 'Prepare Monitoring Run', 'Read Keyword History', 'Read Baseline Products', 'Build Keyword Searches', 'Thordata Google Shopping', 'Measure Shelf and Compare', 'AI Analysis Enabled?']);
  connect(c, 'AI Analysis Enabled?', 'Explain Shopping Changes', 0); connect(c, 'AI Analysis Enabled?', 'Build Shopping Report', 1);
  chain(['Explain Shopping Changes', 'Build Shopping Report', 'Have Product Snapshots?']);
  connect(c, 'OpenAI Chat Model', 'Explain Shopping Changes', 0, 0, 'ai_languageModel');
  connect(c, 'Have Product Snapshots?', 'Save Product Snapshots', 0); connect(c, 'Have Product Snapshots?', 'Check Product Saves', 1);
  chain(['Save Product Snapshots', 'Check Product Saves', 'Save Keyword Metrics', 'Finalize Report', 'Show Shopping Report', 'Should Notify Slack?']);
  connect(c, 'Should Notify Slack?', 'Send Shopping Alert', 0); connect(c, 'Should Notify Slack?', 'Validate Run Outcome', 1); connect(c, 'Send Shopping Alert', 'Validate Run Outcome');
  return { name: 'Track Google Shopping keyword rankings and share of shelf with Thordata and OpenAI', active: false, nodes, connections: c, settings: { executionOrder: 'v1', timezone: 'Asia/Shanghai', saveManualExecutions: true, executionTimeout: 3600 }, pinData: {}, tags: [], meta: { templateCredsSetupCompleted: false } };
}

export function writeArtifacts() {
  const workflow = buildWorkflow();
  writeFileSync(resolve(ROOT, 'thordata-shopping-share-of-shelf.json'), JSON.stringify(workflow, null, 2) + '\n');
  mkdirSync(resolve(ROOT, 'templates'), { recursive: true });
  writeFileSync(resolve(ROOT, 'templates', 'Keyword Metrics.csv'), History.METRIC_COLUMNS.join(',') + '\n');
  writeFileSync(resolve(ROOT, 'templates', 'Product Snapshots.csv'), History.PRODUCT_COLUMNS.join(',') + '\n');
  console.log(`Generated ${workflow.nodes.length} canvas items and two worksheet templates.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeArtifacts();
