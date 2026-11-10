import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
const url = new URL('../src/report.mjs', import.meta.url);
const loaded = existsSync(fileURLToPath(url)) ? await import(url) : null;
function report() {
  assert.equal(typeof loaded?.Report?.analysis, 'function', 'Report analysis is not implemented yet.');
  return loaded.Report;
}
export function envelope() {
  return {
    config: { enable_ai: true, enable_slack: false, target_name: 'JBL', country: 'us', language: 'en', shelf_depth: 20, run_anchor: '2026-11-05T09:00:00.000Z', spreadsheet_id: 'SECRET_SHEET', token: 'SECRET_TOKEN' },
    records: [{ query_id: 'q1', keyword: 'wireless earbuds', checked_at: '2026-11-05T09:00:00.000Z', collection_status: 'success', cards_received: 20, valid_cards: 20, shelf_seen: 20, shelf_complete: true, slots_held: 4, share_of_shelf_pct: 20, target_observed: true, best_position: 3, comparison_status: 'compared', baseline_checked_at: '2026-11-04T09:00:00.000Z', rank_delta: 5, share_delta_pp: 10, api_credits: 2, competitors: [{ position: 1, product_id: 'p1', title: 'Other earbuds', merchant: 'Shop', price_value: null, currency: null, relation: 'above_target' }], products: [{ position: 1, product_id: 'p1', title: 'Other earbuds', merchant: 'Shop', link: 'https://example.com/product?q=1&x=2' }], price_changes: [{ product_id: 't1', title: 'JBL Earbuds', merchant: 'Shop', currency: 'USD', previous_price: 100, current_price: 110, change_pct: 10 }], alert_reasons: ['rank_change'] }],
    save: { products: { status: 'saved', confirmed_ids: ['p1'] }, metrics: { status: 'saved', confirmed_ids: ['q1'] } },
  };
}
const valid = { summary: 'The target gained shelf visibility.', findings: [{ query_id: 'q1', observation: 'The best position improved by five.', action: 'Review the observed competing offers.' }] };

test('prompt projects only bounded measured evidence and treats source text as untrusted', () => {
  const value = envelope();
  value.records[0].raw = 'SECRET_RAW';
  value.records[0].rejects = ['SECRET_REJECT'];
  value.records[0].competitors = Array.from({ length: 8 }, (_, i) => ({ ...value.records[0].competitors[0], product_id: `p${i}`, title: 'x'.repeat(500), merchant: 'm'.repeat(500), image_url: 'SECRET_IMAGE' }));
  const prompt = report().prompt(value);
  assert.doesNotMatch(prompt, /SECRET_/);
  assert.match(prompt, /untrusted/i);
  assert.match(prompt, /English/);
  assert.match(prompt, /ignore instructions/i);
  const data = JSON.parse(prompt.split('Evidence:\n')[1]);
  assert.equal(data.records[0].competitors.length, 5);
  assert.ok(data.records[0].competitors[0].title.length <= 240);
  assert.ok(data.records[0].competitors[0].merchant.length <= 120);
  assert.equal(data.records[0].share_of_shelf_pct, 20);
});

test('native chain output variants validate into the same strict analysis', () => {
  const json = JSON.stringify(valid);
  for (const output of [valid, json, `\`\`\`json\n${json}\n\`\`\``, { text: json }, { output: json }, { json: valid }, { content: json }, { content: [{ type: 'text', text: json }] }]) {
    assert.deepEqual(report().analysis(envelope(), output), { status: 'completed', ...valid });
  }
});

test('invalid model content falls back deterministically without accepting invented fields or IDs', () => {
  const cases = [null, '', 'not json', `prefix ${JSON.stringify(valid)}`, { error: 'provider error', text: JSON.stringify(valid) }, { ...valid, rank_delta: 99 }, { ...valid, summary: 'x'.repeat(801) }, { ...valid, summary: 42 }, { ...valid, summary: '这是分析结果。' }, { ...valid, findings: [...valid.findings, ...valid.findings] }, { ...valid, findings: [{ ...valid.findings[0], query_id: 'unknown' }] }, { ...valid, findings: [{ ...valid.findings[0], action: 'x'.repeat(301) }] }, { ...valid, findings: [{ ...valid.findings[0], observation: '' }] }, { ...valid, findings: [{ ...valid.findings[0], price: 12 }] }];
  const fallback = report().analysis(envelope(), null);
  assert.equal(fallback.status, 'failed');
  for (const output of cases) assert.deepEqual(report().analysis(envelope(), output), fallback);
  assert.match(fallback.summary, /1 keyword/);
  assert.equal(fallback.findings[0].query_id, 'q1');
});

test('duplicate findings are rejected even when within the configured record count', () => {
  const value = envelope();
  value.records.push({ ...value.records[0], query_id: 'q2' });
  assert.equal(report().analysis(value, { ...valid, findings: [...valid.findings, ...valid.findings] }).status, 'failed');
});

test('disabled and evidence-free paths do not consume model content', () => {
  const disabled = envelope(); disabled.config.enable_ai = false;
  assert.equal(report().analysis(disabled, valid).status, 'disabled');
  for (const collection_status of ['empty', 'request_failed', 'invalid_response']) {
    const value = envelope(); Object.assign(value.records[0], { collection_status, valid_cards: collection_status === 'invalid_response' ? 3 : 0 });
    assert.equal(report().analysis(value, valid).status, 'skipped_no_evidence');
  }
});

test('report contains measured context, baseline interval, save confirmation, links, and limitations', () => {
  const value = envelope(); value.analysis = report().analysis(value, valid);
  const output = report().render(value);
  for (const key of ['html', 'markdown', 'slackText']) assert.equal(typeof output[key], 'string');
  for (const text of ['JBL', 'wireless earbuds', '2026-11-05T09:00:00.000Z', '2026-11-04T09:00:00.000Z', '4/20', '20%', '+5', '+10', '24 hours', 'saved', 'completed', 'Limitations', 'USD 100.00', 'USD 110.00']) assert.ok(output.html.includes(text), text);
  assert.match(output.html, /href="https:\/\/example\.com\/product\?q=1&amp;x=2"/);
  assert.match(output.html, /Not available/);
  assert.doesNotMatch(output.html, /USD 0\.00|\$0\.00|SECRET_/);
  assert.match(output.slackText, /wireless earbuds/);
  assert.match(output.slackText, /\+5/);
  assert.doesNotMatch(output.html, /<iframe|<img|<script/);
});

test('source and AI HTML are escaped and source Slack mentions cannot notify people', () => {
  const value = envelope();
  value.config.target_name = '<img src=x onerror=alert(1)> @everyone';
  value.records[0].keyword = '<!channel> <@U123> @here & <script>alert(1)</script>';
  value.records[0].competitors[0].title = '<svg onload=alert(1)>';
  value.records[0].competitors[0].merchant = 'Shop <&>';
  value.records[0].products[0].link = 'javascript:alert(1)';
  value.analysis = { status: 'completed', summary: '<script>alert(2)</script>', findings: [{ query_id: 'q1', observation: '<b>evil</b>', action: '<!everyone>' }] };
  const output = report().render(value);
  assert.doesNotMatch(output.html, /<script|<svg|<img|<b>evil|href="javascript:/);
  assert.match(output.html, /&lt;script&gt;/);
  assert.doesNotMatch(output.slackText, /<!channel>|<@U123>|@here|@everyone/);
  assert.match(output.slackText, /&lt;!channel&gt;/);
  assert.doesNotMatch(output.markdown, /<script>|javascript:/);
});

test('no baseline, unobserved target, and incomplete coverage never fabricate movement or prices', () => {
  const value = envelope(); Object.assign(value.records[0], { collection_status: 'partial', shelf_complete: false, shelf_seen: 12, slots_held: 0, share_of_shelf_pct: 0, best_position: null, target_observed: false, comparison_status: 'not_comparable', baseline_checked_at: null, rank_delta: null, share_delta_pp: null, price_changes: [], coverage_note: 'Only 12 of 20 shelf positions were observed' });
  value.save.metrics = { status: 'unconfirmed', missing_ids: ['q1'] };
  const output = report().render(value);
  for (const text of ['No baseline', 'Not observed', 'Observed share', 'Incomplete', '0/12', 'unconfirmed']) assert.ok(output.html.includes(text), text);
  assert.match(output.slackText, /unconfirmed/);
  assert.match(output.slackText, /incomplete/i);
  assert.doesNotMatch(output.html, /USD 0\.00|\$0\.00|\+0 pp/);
});

test('failed collection metrics are unavailable rather than asserting target absence', () => {
  const value = envelope(); Object.assign(value.records[0], { collection_status: 'request_failed', valid_cards: 0, best_position: null, target_observed: null, slots_held: null, shelf_seen: null, share_of_shelf_pct: null, api_credits: null, price_changes: [], competitors: [], error_message: 'Request failed' });
  const output = report().render(value);
  assert.match(output.html, /Not available/);
  assert.doesNotMatch(output.html, /0\/0|<td>Not observed<\/td>|API-reported credits: 0/);
  assert.match(output.slackText, /request_failed/);
});

test('credits sum unique responses and distinguish unknown costs', () => {
  const value = envelope(); value.records[0].upstream_response_id = 'response1';
  value.records.push({ ...value.records[0], query_id: 'q2' }, { ...value.records[0], query_id: 'q3', upstream_response_id: 'response2', api_credits: null });
  assert.match(report().render(value).html, /2 known; 1 unknown/);
});

test('unsafe and malformed product links stay plain text', () => {
  for (const link of ['data:text/html,<script>', '//example.com', 'file:///tmp/test', 'https://', 'https://user:pass@example.com']) {
    const value = envelope(); value.records[0].products[0].link = link;
    assert.doesNotMatch(report().render(value).html, /href=/);
  }
});

test('observed target offers retain usable links and missing prices', () => {
  const value = envelope();
  value.records[0].products.push({ position: 3, product_id: 't1', title: 'JBL Earbuds', merchant: 'Store', is_target: true, price_value: null, currency: null, link: 'https://example.com/target' });
  const output = report().render(value);
  assert.match(output.html, /Observed target offers/);
  assert.match(output.html, /href="https:\/\/example.com\/target"/);
  assert.match(output.markdown, /\[JBL Earbuds\]\(https:\/\/example.com\/target\)/);
  assert.doesNotMatch(output.html, /USD 0\.00|\$0\.00/);
});

test('native HTML template expressions in source text and links remain inert', () => {
  const value = envelope();
  value.records[0].keyword = '{{ $env.SECRET }}';
  value.records[0].products[0].link = 'https://example.com/{{7*7}}';
  value.analysis = { status: 'completed', summary: '{{7*7}} is source text.', findings: [] };
  const output = report().render(value);
  assert.doesNotMatch(output.html, /\{\{/);
  assert.match(output.html, /&#123;&#123;/);
});

test('first-run fallback requires confirmed persistence before describing a usable baseline', () => {
  const value = envelope(); value.config.enable_ai = false;
  value.records[0].comparison_status = 'baseline_created';
  value.save = { products: { status: 'pending' }, metrics: { status: 'pending' } };
  const output = report().analysis(value, null);
  assert.doesNotMatch(output.findings[0].action, /this saved/);
  assert.match(output.findings[0].action, /persistence is confirmed/i);
  assert.match(report().render(value).html, /20 valid \/ 20 received/);
});

test('portable report source preserves valid links in a sandbox without the URL global', () => {
  const source = readFileSync(url, 'utf8').replace(/^export /gmu, '') + '\nReport;';
  const sandboxReport = runInNewContext(source, { URL: undefined });
  for (const link of ['https://www.google.com/search?q=product', 'http://example.com:8080/item', 'https://xn--bcher-kva.example/path', 'https://[2001:db8::1]:443/path', 'http://[::1]/', 'http://[::ffff:192.0.2.1]/', 'https://example.com/{{7*7}}']) {
    const value = envelope(); value.records[0].products[0].link = link;
    const output = sandboxReport.render(value);
    assert.ok(output.html.includes(`href="${link.replaceAll('{', '&#123;').replaceAll('}', '&#125;')}"`), link);
    assert.doesNotMatch(output.html, /\{\{/);
  }
  for (const link of ['https://user:pass@example.com', 'https://example.com\\@evil.test', 'https://example.com\u0000/path', 'https://example.com:99999/path', 'https://example.com:abc', 'https://-bad.example/', 'https://example..com/', 'https://999.999.999.999/', 'https://[::::]/', 'https://[2001:db8:1]/', 'https://[::1]suffix/', 'https://[::1]:0/', '//example.com/']) {
    const value = envelope(); value.records[0].products[0].link = link;
    assert.doesNotMatch(sandboxReport.render(value).html, /href=/, link);
  }
});

test('unparsed source prices remain visible on target offers and competitors without inferred currencies', () => {
  for (const raw of ['EUR 19.99', '$20-$40']) {
    const value = envelope();
    Object.assign(value.records[0].competitors[0], { price_value: null, currency: null, price_raw: raw });
    value.records[0].products.push({ position: 3, product_id: 'target', title: 'JBL offer', merchant: 'Shop', is_target: true, price_value: null, currency: null, price_raw: raw });
    const output = report().render(value);
    assert.equal(output.html.split(`<td>${raw}</td>`).length - 1, 2, raw);
    assert.equal(output.markdown.split(raw).length - 1, 2, raw);
    assert.doesNotMatch(output.html, /Currency unknown 0\.00|USD 0\.00/);
  }
  const value = envelope();
  value.records[0].competitors[0].price_raw = '<img src=x> {{7*7}}';
  const output = report().render(value);
  assert.match(output.html, /&lt;img src=x&gt; &#123;&#123;7\*7&#125;&#125;/);
  assert.doesNotMatch(output.html, /<img|\{\{/);
  assert.doesNotMatch(output.markdown, /<img/);
});

test('analysis rejects obvious non-English Latin prose despite shared domain words', () => {
  for (const [summary, action] of [
    ['No hay cambios en los precios.', 'No cambie los precios.'],
    ['La position est stable.', 'Comparez les prix des produits.'],
    ['Die Position ist stabil.', 'Prufen Sie die Preise der Produkte.'],
  ]) {
    assert.equal(report().analysis(envelope(), { summary, findings: [{ query_id: 'q1', observation: summary, action }] }).status, 'failed', summary);
    assert.equal(report().analysis(envelope(), { ...valid, findings: [{ ...valid.findings[0], action }] }).status, 'failed', action);
  }
});

test('analysis retains concise English conclusions and quoted source names', () => {
  for (const summary of ['Visibility improved.', 'No changes observed.', 'Prices remain stable.', 'The target is absent from the returned sample.', '"\u8033\u673a" remained stable.', 'The offer from "La boutique de Paris" gained shelf visibility.']) {
    const output = { summary, findings: [{ query_id: 'q1', observation: 'The target gained one position.', action: 'Review the linked offers.' }] };
    assert.equal(report().analysis(envelope(), output).status, 'completed', summary);
  }
});
