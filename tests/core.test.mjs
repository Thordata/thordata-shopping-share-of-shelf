import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Settings } from '../src/settings.mjs';
import { Shopping } from '../src/shopping.mjs';
import { Metrics } from '../src/metrics.mjs';
import { History } from '../src/history.mjs';

const baseInput = {
  spreadsheet_id: 'sheet-1',
  keywords: ['wireless earbuds'],
  target_name: 'JBL',
  brand_aliases: ['JBL'],
  product_ids: [],
  country: 'us',
  language: 'en',
  shelf_depth: 20,
  enable_ai: true,
  enable_slack: false,
};

function job(input = baseInput) {
  return Settings.jobs(Settings.parse(input, 'execution-1'))[0];
}
function card(position, id, title = `JBL product ${id}`, extra = {}) {
  return { position, product_id: String(id), title, source: 'Best Buy', price: '$39.95', ...extra };
}
function normalized(cards, input = baseInput) {
  const j = job(input);
  return Shopping.normalize({ engine: 'google_shopping', query: j.keyword, result: { code: 200, shopping: cards, credits: 1 } }, j);
}

test('Settings applies defaults, preserves long IDs, and captures one run anchor', () => {
  const config = Settings.parse({ ...baseInput, product_ids: ['1749519698216963169'] }, 'exec-42');
  assert.equal(config.run_id, 'exec-42');
  assert.equal(typeof config.run_anchor, 'string');
  assert.deepEqual(config.product_ids, ['1749519698216963169']);
  assert.equal(config.enable_ai, true);
  assert.throws(() => Settings.parse({ ...baseInput, enable_ai: 'true' }, 'x'), /boolean/);
});

test('Settings rejects missing targets and invalid bounds while deduplicating keywords', () => {
  assert.throws(() => Settings.parse({ ...baseInput, brand_aliases: [], product_ids: [] }, 'x'), /alias|product/i);
  assert.deepEqual(Settings.parse({ ...baseInput, keywords: ['x', 'X'] }, 'x').keywords, ['x']);
  assert.throws(() => Settings.parse({ ...baseInput, shelf_depth: 41 }, 'x'), /shelf_depth/);
  assert.throws(() => Settings.parse({ ...baseInput, enable_slack: true }, 'x'), /slack_channel/);
});

test('Shopping distinguishes request, response, and empty failures', () => {
  const j = job();
  assert.equal(Shopping.normalize({ engine: 'google_shopping', query: j.keyword, result: { code: 503 } }, j).collection_status, 'request_failed');
  assert.equal(Shopping.normalize({ engine: 'google_shopping', query: j.keyword, result: { code: 200 } }, j).collection_status, 'invalid_response');
  assert.equal(Shopping.normalize({ engine: 'google_shopping', query: j.keyword, result: { code: 200, shopping: [] } }, j).collection_status, 'empty');
});

test('Shopping collapses duplicate slots, rejects conflicting slots, and matches exact long IDs', () => {
  const sample = normalized([
    card(1, '1749519698216963169', 'A title'),
    card(1, '1749519698216963169', 'A title'),
    card(2, 'other', 'JBLX speaker'),
    card(3, 'other-2', 'JBL speaker'),
    card(3, 'other-3', 'Other'),
  ], { ...baseInput, product_ids: ['1749519698216963169'] });
  assert.equal(sample.products.length, 2);
  assert.equal(sample.products[0].is_target, true);
  assert.equal(sample.products[0].match_reason, 'product_id');
  assert.equal(sample.products[1].is_target, false);
  assert.ok(sample.rejects.some(r => r.reason === 'conflicting_slot'));
  assert.equal(sample.products.some(p => p.position === 3), false);
});

test('Metrics computes complete and partial share by returned valid slots', () => {
  const cards = [1, 2, 3, 4].map((p) => card(p, `id-${p}`));
  const complete = Metrics.measure(normalized(cards), job());
  assert.equal(complete.share_of_shelf_pct, 100);
  const partial = Metrics.measure(normalized(cards.concat(Array.from({ length: 8 }, (_, i) => card(i + 5, `other-${i}`, 'Other')))), job());
  assert.equal(partial.collection_status, 'partial');
  assert.equal(partial.share_of_shelf_pct, 4 / 12 * 100);
});

test('Metrics handles four target slots in a complete 20 shelf and target outside top N', () => {
  const input = { ...baseInput, product_ids: ['p1', 'p2', 'p3', 'p4'], brand_aliases: [] };
  const j = job(input);
  const cards = [1, 2, 3, 4].map((p) => card(p, `p${p}`, 'Other title'))
    .concat(Array.from({ length: 16 }, (_, i) => card(i + 5, `c${i}`, 'Other')));
  const record = Metrics.measure(Shopping.normalize({ engine: 'google_shopping', query: j.keyword, result: { code: 200, shopping: cards } }, j), j);
  assert.equal(record.share_of_shelf_pct, 20);
  assert.equal(record.unique_target_products, 4);
  const outside = Metrics.measure(normalized(Array.from({ length: 20 }, (_, i) => card(i + 1, `c${i}`, 'Other')).concat(card(25, 'p1', 'Other title')), input), j);
  assert.equal(outside.best_position, 25);
  assert.equal(outside.share_of_shelf_pct, 0);
});

test('History compares rank, share, and price and selects only complete saved baselines', () => {
  const j = job();
  const baseline = { ...Metrics.measure(normalized([card(1, 'p1', 'JBL product p1', { price: '$100.00' })]), j), snapshot_id: 'old', checked_at: '2026-01-01T00:00:00.000Z', shelf_complete: true, snapshot_complete: true, collection_status: 'success', share_of_shelf_pct: 20, best_position: 8 };
  const current = { ...Metrics.measure(normalized([card(1, 'p1', 'JBL product p1', { price: '$110.00' })]), j), snapshot_id: 'new', checked_at: '2026-01-02T00:00:00.000Z', shelf_complete: true, collection_status: 'success', share_of_shelf_pct: 35, best_position: 3 };
  const selected = History.selectBaseline([baseline], j, current.checked_at);
  assert.equal(selected.snapshot_id, 'old');
  const compared = History.compare(current, selected, History.productRows(baseline), j);
  assert.equal(compared.rank_delta, 5);
  assert.equal(compared.share_delta_pp, 15);
  assert.equal(compared.price_changes[0].change_pct, 10);
  assert.equal(History.selectBaseline([{ ...baseline, snapshot_complete: false }], j, current.checked_at), null);
});

test('History confirms native Sheets returned rows by explicit IDs', () => {
  const expected = [{ record_id: 'a' }, { record_id: 'b' }];
  assert.equal(History.confirm(expected, [{ json: { record_id: 'a' } }, { json: { record_id: 'b' } }], 'record_id').status, 'saved');
  assert.equal(History.confirm(expected, [{ json: { record_id: 'a' } }], 'record_id').status, 'unconfirmed');
  assert.equal(History.confirm(expected, [{ json: { error: 'write failed' } }], 'record_id').status, 'failed');
});

test('Settings rejects explicitly null fields and missing run IDs', () => {
  for (const key of ['keywords', 'brand_aliases', 'product_ids']) assert.throws(() => Settings.parse({ ...baseInput, [key]: null }, 'x'), new RegExp(key));
  assert.throws(() => Settings.parse(baseInput), /run ID/);
});

test('Settings validates supported engine locales and all typed limits', () => {
  for (const input of [{ country: 'zz' }, { language: 'zz' }, { shelf_depth: 1.5 }, { rank_alert_threshold: '3' }, { share_alert_threshold_pp: NaN }, { price_alert_threshold_pct: -1 }, { product_ids: [1749519698216963169] }, { keywords: [] }, { brand_aliases: Array(21).fill('a') }, { product_ids: Array(101).fill('a') }, { keywords: ['a'.repeat(201)] }, { brand_aliases: ['a'.repeat(101)] }, { product_ids: ['a'.repeat(101)] }, { spreadsheet_id: '' }, { enable_slack: 'false' }]) {
    assert.throws(() => Settings.parse({ ...baseInput, ...input }, 'x'), undefined, JSON.stringify(input));
  }
  const defaults = Settings.parse({ spreadsheet_id: 'sheet', slack_channel: 'CTEST' }, 'x');
  assert.deepEqual(defaults.keywords, ['wireless earbuds', 'bluetooth headphones', 'portable speakers']);
  assert.equal(defaults.rank_alert_threshold, 3);
  assert.equal(defaults.share_alert_threshold_pp, 10);
  assert.equal(defaults.price_alert_threshold_pct, 5);
  assert.equal(defaults.enable_slack, true);
  assert.equal(Settings.parse({ ...baseInput, language: 'pt-br' }, 'x').language, 'pt-br');
  const schema = JSON.parse(readFileSync(new URL('../../../n8n-nodes-thordata/nodes/Thordata/serp-schema.snapshot.json', import.meta.url), 'utf8'));
  const fields = schema.data.categories.flatMap(category => category.engines).find(engine => engine.key === 'google_shopping').groups.flatMap(group => group.fields);
  assert.deepEqual([...Settings.COUNTRIES].sort(), fields.find(field => field.key === 'gl').options.map(option => option.value).sort());
  assert.deepEqual([...Settings.LANGUAGES].sort(), fields.find(field => field.key === 'hl').options.map(option => option.value).sort());
});

test('Identity canonicalizes matching scope without including labels or thresholds', () => {
  const a = job({ ...baseInput, brand_aliases: ['JBL', 'JBL Audio'], product_ids: ['2', '1'] });
  const b = job({ ...baseInput, keywords: ['  WIRELESS   EARBUDS '], brand_aliases: ['jbl audio', 'jbl'], product_ids: ['1', '2'], target_name: 'Another display label', rank_alert_threshold: 9 });
  assert.equal(a.scope_id, b.scope_id);
  assert.equal(a.scope_json, b.scope_json);
  assert.equal(a.query_id, b.query_id);
  assert.equal(a.snapshot_id, b.snapshot_id);
  const changed = job({ ...baseInput, brand_aliases: ['Another brand'] });
  assert.equal(changed.query_id, a.query_id);
  assert.notEqual(changed.scope_id, a.scope_id);
  assert.notEqual(job({ ...baseInput, shelf_depth: 10 }).scope_id, job().scope_id);
});

test('Shopping requires native envelope, strict positions and string IDs', () => {
  const j = job();
  assert.equal(Shopping.normalize({ code: 200, shopping: [card(1, 'id')] }, j).collection_status, 'invalid_response');
  assert.equal(Shopping.normalize({ error: { message: 'timeout' } }, j).collection_status, 'request_failed');
  const sample = normalized([card(1, 'good'), card(2, 1, 'JBL', { product_id: 1749519698216963169 }), card('3', 'bad'), card(4, 'blank', '  ')]);
  assert.equal(sample.products.length, 1);
  assert.equal(sample.rejects.length, 3);
  assert.ok(sample.rejects.every(reject => Object.hasOwn(reject, 'raw')));
  assert.equal(normalized([card(0, 'bad')]).collection_status, 'invalid_response');
});

test('Shopping rejects query mismatch instead of attributing another keyword', () => {
  const j = job();
  assert.equal(Shopping.normalize({ engine: 'google_shopping', query: 'wrong keyword', result: { code: 200, shopping: [card(1, 'id')] } }, j).collection_status, 'invalid_response');
});

test('Exact duplicate cards collapse but conflicting slot cannot re-enter later', () => {
  const sample = normalized([card(1, 'a'), card(1, 'a'), card(2, 'b'), card(2, 'c'), card(2, 'b'), card(3, 'd')]);
  assert.deepEqual(sample.products.map(p => p.position), [1, 3]);
  assert.equal(sample.collection_status, 'invalid_response');
  const sameOfferChanged = normalized([card(1, 'a'), card(1, 'a', 'JBL product a', { price: '$99.00' })]);
  assert.equal(sameOfferChanged.products.length, 0);
});

test('Alias matching is literal NFKC Unicode word matching, never merchant matching', () => {
  const sample = normalized([
    card(1, 'a', 'JBLX'), card(2, 'b', 'ＪＢＬ   speaker'), card(3, 'c', 'xJBL'),
    card(4, 'd', '(jbl) speaker'), card(5, 'e', 'Other', { source: 'JBL' }), card(6, 'f', 'JBL7'),
    card(7, 'g', '\u00e9JBL'), card(8, 'h', 'JBL\u00e9'), card(9, 'i', 'JBL\u{10400}')
  ]);
  assert.deepEqual(sample.products.filter(p => p.is_target).map(p => p.position), [2, 4]);
  assert.equal(normalized([card(1, 'a', 'A+B speaker')], { ...baseInput, brand_aliases: ['a+b'] }).products[0].is_target, true);
  assert.equal(normalized([card(1, 'a', 'JBL    AUDIO speaker')], { ...baseInput, brand_aliases: ['jbl audio'] }).products[0].is_target, true);
});

test('Price parsing accepts only unambiguous USD totals in the US', () => {
  for (const raw of ['$1,234.50', 'USD 1234.50', '1234.50 USD']) assert.deepEqual(Shopping.parsePrice(raw, 'us'), { value: 1234.5, currency: 'USD' });
  assert.deepEqual(Shopping.parsePrice('$0.00', 'us'), { value: 0, currency: 'USD' });
  for (const raw of ['$20-$40', '$10/mo', '$10 per month', 'from $10', 'CA$10', '$1,23.00', '$10 shipping', 10, null, '10', 'EUR 10']) assert.deepEqual(Shopping.parsePrice(raw, 'us'), { value: null, currency: null });
  assert.deepEqual(Shopping.parsePrice('$10', 'ca'), { value: null, currency: null });
});

test('Metrics distinguishes repeated products from repeated slots and zero denominators', () => {
  const record = Metrics.measure(normalized([card(1, 'repeat'), card(2, 'repeat'), card(2, 'repeat')]), job());
  assert.equal(record.slots_held, 2);
  assert.equal(record.unique_target_products, 1);
  assert.equal(record.share_of_shelf_pct, 100);
  const empty = Metrics.measure(normalized([]), job());
  assert.equal(empty.share_of_shelf_pct, null);
  assert.equal(empty.best_position, null);
  const gaps = Metrics.measure(normalized([card(1, 'rival', 'Other'), card(25, 'target')]), job());
  assert.equal(gaps.best_position, 25);
  assert.equal(gaps.shelf_seen, 1);
  assert.equal(gaps.share_of_shelf_pct, 0);
  assert.equal(gaps.competitors[0].relation, 'above_target');
  const absent = Metrics.measure(normalized([card(1, 'rival', 'Other')]), job());
  assert.equal(absent.competitors[0].relation, 'top_observed_product');
});

function savedRecord(overrides = {}) {
  const j = job();
  return { ...Metrics.measure(normalized(Array.from({ length: 20 }, (_, i) => card(i + 1, `p${i}`, i === 7 ? 'JBL target' : 'Other', { price: '$100' }))), j), snapshot_id: 'previous', checked_at: '2026-01-01T00:00:00.000Z', snapshot_complete: true, ...overrides };
}

test('History strictly selects latest prior valid scope, including Sheets string types', () => {
  const baseline = savedRecord();
  const stringRow = Object.fromEntries(Object.entries(History.metricRow(baseline)).map(([key, value]) => [key, value === null ? '' : String(value)]));
  const selected = History.selectBaseline([
    stringRow, { ...baseline, snapshot_id: 'older', checked_at: '2025-12-01T00:00:00Z' },
    { ...baseline, snapshot_id: 'equal', checked_at: '2026-01-02T00:00:00Z' },
    { ...baseline, snapshot_id: 'partial', checked_at: '2026-01-01T12:00:00Z', collection_status: 'partial' },
    { ...baseline, snapshot_id: 'unsaved', checked_at: '2026-01-01T12:00:00Z', snapshot_complete: 'false' },
    { ...baseline, snapshot_id: 'collision', checked_at: '2026-01-01T12:00:00Z', scope_json: '{}' }
  ], job(), '2026-01-02T00:00:00Z');
  assert.equal(selected.snapshot_id, 'previous');
  assert.equal(selected.best_position, 8);
  assert.equal(selected.share_of_shelf_pct, 5);
  assert.equal(selected.shelf_complete, true);
});

test('History does not treat malformed rank strings or flags as missing/valid baselines', () => {
  const baseline = savedRecord();
  for (const change of [{ best_position: 'not a rank' }, { snapshot_complete: 1 }, { shelf_complete: 'yes' }, { share_of_shelf_pct: '' }]) {
    assert.equal(History.selectBaseline([{ ...baseline, ...change }], job(), '2026-01-02T00:00:00Z'), null);
  }
});

test('History gates comparisons and distinguishes observation from delisting', () => {
  const baseline = savedRecord();
  const current = { ...baseline, snapshot_id: 'current', checked_at: '2026-01-02T00:00:00Z' };
  const partial = History.compare({ ...current, collection_status: 'partial' }, baseline, [], job());
  assert.equal(partial.rank_delta, null);
  assert.equal(partial.share_delta_pp, null);
  assert.equal(History.compare(current, null, [], job()).comparison_status, 'baseline_created');
  const newly = History.compare(current, { ...baseline, best_position: null, target_observed: false, share_of_shelf_pct: 0 }, [], job());
  assert.equal(newly.comparison_status, 'newly_observed');
  assert.equal(newly.rank_delta, null);
  const missing = History.compare({ ...current, best_position: null, target_observed: false, share_of_shelf_pct: 0 }, baseline, [], job());
  assert.equal(missing.comparison_status, 'not_observed');
  assert.equal(missing.rank_delta, null);
});

test('History compares same offer prices only in selected baseline and suppresses conflicts/zero', () => {
  const baseline = savedRecord();
  const current = { ...baseline, snapshot_id: 'current', checked_at: '2026-01-02T00:00:00Z', products: baseline.products.map(p => ({ ...p, price_value: 110 })) };
  const prior = History.productRows(baseline);
  assert.equal(History.compare(current, baseline, prior, job()).price_changes[0].change_pct, 10);
  for (const changes of [{ price_value: 0 }, { merchant: 'Other' }, { currency: 'CAD' }, { snapshot_id: 'wrong' }]) {
    const altered = prior.map(p => ({ ...p, ...changes }));
    assert.equal(History.compare(current, baseline, altered, job()).price_changes.length, 0);
  }
  const conflicting = prior.concat({ ...prior[7], price_value: 101 });
  assert.equal(History.compare(current, baseline, conflicting, job()).price_changes.length, 0);
});

test('History threshold equality triggers changes and emitted columns are exact', () => {
  const baseline = savedRecord({ share_of_shelf_pct: 20 });
  const current = { ...baseline, checked_at: '2026-01-02T00:00:00Z', best_position: 5, share_of_shelf_pct: 30, products: baseline.products.map(p => ({ ...p, price_value: 105 })) };
  const result = History.compare(current, baseline, History.productRows(baseline), job());
  assert.deepEqual(result.alert_reasons, ['rank_change', 'share_change', 'price_change']);
  assert.deepEqual(Object.keys(History.metricRow(result)), History.METRIC_COLUMNS);
  assert.deepEqual(Object.keys(History.productRows(result)[0]), History.PRODUCT_COLUMNS);
  assert.equal(JSON.parse(History.metricRow(result).price_changes_json)[0].change_pct, 5);
});

test('History acknowledges metric error data as successful saved data', () => {
  const metric = History.metricRow({ ...savedRecord(), error_message: 'Upstream collection failed' });
  assert.equal(History.confirm([metric], [{ json: metric }], 'snapshot_id').status, 'saved');
  assert.equal(History.confirm([{ snapshot_id: 'a' }], [{ json: {} }], 'snapshot_id').status, 'unconfirmed');
  assert.equal(History.confirm([], [], 'record_id').status, 'saved');
});

test('Settings preserves valid supplied UTC run anchors and positive alert thresholds', () => {
  const run_anchor = '2026-01-01T00:00:00.000Z';
  assert.equal(Settings.parse({ ...baseInput, run_anchor }, 'x').run_anchor, run_anchor);
  for (const anchor of ['tomorrow', '2026-01-01', '2026-01-01T00:00:00+01:00', '2026-02-30T00:00:00.000Z', null]) assert.throws(() => Settings.parse({ ...baseInput, run_anchor: anchor }, 'x'), /run_anchor/);
  for (const key of ['rank_alert_threshold', 'share_alert_threshold_pp', 'price_alert_threshold_pct']) assert.throws(() => Settings.parse({ ...baseInput, [key]: 0 }, 'x'));
  const config = Settings.parse({ ...baseInput, brand_aliases: ['JBL', 'jbl'], product_ids: ['1', '1'] }, 'x');
  assert.deepEqual(config.brand_aliases, ['JBL']);
  assert.deepEqual(config.product_ids, ['1']);
});

test('Shopping preserves source strings and validates optional ratings', () => {
  const p = normalized([card(1, '1', '  JBL speaker  ', { source: ' Best Buy ', rating: Infinity, rating_count: -1 })]).products[0];
  assert.equal(p.title, '  JBL speaker  ');
  assert.equal(p.merchant, ' Best Buy ');
  assert.equal(p.rating, null);
  assert.equal(p.rating_count, null);
  assert.equal(p.match_reason, 'title_alias:JBL');
  const err = Shopping.normalize({ error: { message: 'Search timed out' } }, job());
  assert.match(err.error_message, /Search timed out/);
});

test('Metrics counts unique targets across the whole returned first page', () => {
  const record = Metrics.measure(normalized([card(1, 'a'), card(25, 'b')]), job());
  assert.equal(record.slots_held, 1);
  assert.equal(record.unique_target_products, 2);
});

test('History stores full precision and no observation event when both snapshots lack a target', () => {
  const baseline = savedRecord({ best_position: null, target_observed: false, share_of_shelf_pct: 0 });
  const current = { ...baseline, checked_at: '2026-01-02T00:00:00Z', share_of_shelf_pct: 100 / 3, products: [] };
  const compared = History.compare(current, baseline, [], job());
  assert.equal(compared.share_delta_pp, 100 / 3);
  assert.equal(compared.comparison_status, 'compared');
});

test('Sanitized native fixtures reproduce observed complete shelves and preserve long IDs', () => {
  const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/shopping-${name}.json`, import.meta.url), 'utf8'));
  const earbuds = fixture('earbuds');
  const record = Metrics.measure(Shopping.normalize(earbuds, job()), job());
  assert.equal(record.collection_status, 'success');
  assert.equal(record.valid_cards, 40);
  assert.equal(record.best_position, 2);
  assert.equal(record.slots_held, 4);
  assert.equal(record.share_of_shelf_pct, 20);
  assert.equal(record.unique_target_products, 8);
  assert.equal(record.products[1].product_id, '1749519698216963169');
  const desk = fixture('standing-desk');
  const deskJob = job({ ...baseInput, keywords: ['standing desk'] });
  const absent = Metrics.measure(Shopping.normalize(desk, deskJob), deskJob);
  assert.equal(absent.collection_status, 'success');
  assert.equal(absent.best_position, null);
  assert.equal(absent.share_of_shelf_pct, 0);
  for (const result of [earbuds.result, desk.result]) {
    assert.ok(!Object.hasOwn(result, 'spider_parameter'));
    assert.equal(result.shopping.length, 40);
  }
});

test('History ignores overflowing numeric strings in offer prices', () => {
  const baseline = savedRecord();
  const current = { ...baseline, snapshot_id: 'current', checked_at: '2026-01-02T00:00:00Z' };
  const products = History.productRows(baseline).map(product => ({ ...product, price_value: '9'.repeat(400) }));
  assert.equal(History.compare(current, baseline, products, job()).price_changes.length, 0);
});

test('Failed, invalid, and empty collections never expose trusted numeric shelf metrics', () => {
  const j = job();
  const responses = [
    { error: 'timeout' },
    { engine: 'google_shopping', query: j.keyword, result: { code: 200 } },
    { engine: 'google_shopping', query: j.keyword, result: { code: 200, shopping: [] } },
    { engine: 'google_shopping', query: j.keyword, result: { code: 200, shopping: [card(1, 'a'), card(1, 'b'), card(2, 'c')] } },
    { engine: 'google_shopping', query: j.keyword, result: { code: 200, shopping: Array.from({ length: 20 }, (_, i) => card(i + 1, `p${i}`)).concat(card(25, 'x'), card(25, 'y')) } },
  ];
  for (const response of responses) {
    const record = Metrics.measure(Shopping.normalize(response, j), j);
    for (const key of ['best_position', 'share_of_shelf_pct', 'shelf_seen', 'slots_held', 'unique_target_products', 'target_observed']) assert.equal(record[key], null, `${record.collection_status}: ${key}`);
    assert.equal(record.shelf_complete, false);
    assert.deepEqual(record.competitors, []);
    assert.equal(typeof record.cards_received, 'number');
  }
});

test('Identifiers hash the documented canonical component arrays', () => {
  const j = job({ ...baseInput, product_ids: ['2', '1'], brand_aliases: ['JBL Audio', 'JBL'] });
  const scope = ['google_shopping', 'wireless earbuds', 'us', 'en', 0, 20, ['jbl', 'jbl audio'], ['1', '2'], 1];
  assert.equal(j.scope_json, JSON.stringify(scope));
  assert.equal(j.scope_id, Settings.hash(JSON.stringify(scope)));
  assert.equal(j.query_id, Settings.hash(JSON.stringify(['google_shopping', 'wireless earbuds', 'us', 'en', 0])));
  assert.equal(j.snapshot_id, Settings.hash(JSON.stringify(['execution-1', j.scope_id])));
  const sample = Shopping.normalize({ engine: 'google_shopping', query: j.keyword, result: { code: 200, shopping: [card(1, '1', 'Other', { source: ' BEST   BUY ' })] } }, j);
  assert.equal(sample.products[0].record_id, Settings.hash(JSON.stringify([j.snapshot_id, 1, '1', 'best buy'])));
});

test('Product IDs preserve exact whitespace in settings, responses, and matching', () => {
  const config = Settings.parse({ ...baseInput, brand_aliases: [], product_ids: ['001', ' 001 ', '001'] }, 'id-test');
  assert.deepEqual(config.product_ids, ['001', ' 001 ']);
  const sample = normalized([card(1, ' 001 ', 'Other')], { ...baseInput, brand_aliases: [], product_ids: ['001'] });
  assert.equal(sample.products[0].product_id, ' 001 ');
  assert.equal(sample.products[0].is_target, false);
  assert.equal(normalized([card(1, ' ', 'Other')]).valid_cards, 0);
});

test('Missing optional source strings are null and rejected-card coverage stays explicit', () => {
  const sample = normalized([{ position: 1, product_id: '1', title: 'JBL' }]);
  assert.equal(sample.products[0].merchant, null);
  assert.equal(sample.products[0].link, null);
  assert.equal(sample.products[0].image_url, null);
  const completeWithReject = normalized(Array.from({ length: 20 }, (_, i) => card(i + 1, String(i))).concat({ title: 'broken' }));
  assert.equal(completeWithReject.collection_status, 'partial');
  assert.equal(completeWithReject.shelf_complete, true);
  assert.match(completeWithReject.coverage_note, /1.*reject|reject.*1/iu);
});

test('Competitor evidence retains display-only prices and returned links', () => {
  const input = { ...baseInput, country: 'de' };
  const record = Metrics.measure(normalized([card(1, 'other', 'Other', { price: 'EUR 99,00', link: 'https://example.com/product' })], input), job(input));
  assert.equal(record.competitors[0].price_value, null);
  assert.equal(record.competitors[0].price_raw, 'EUR 99,00');
  assert.equal(record.competitors[0].link, 'https://example.com/product');
});

test('Submitted keyword whitespace collapses and alert thresholds have only documented bounds', () => {
  const config = Settings.parse({ ...baseInput, keywords: ['  Wireless \t Earbuds ', 'wireless earbuds'], rank_alert_threshold: 41, price_alert_threshold_pct: 100001 }, 'x');
  assert.deepEqual(config.keywords, ['Wireless Earbuds']);
  assert.equal(Settings.jobs(config)[0].query, 'Wireless Earbuds');
  assert.equal(config.rank_alert_threshold, 41);
  assert.equal(config.price_alert_threshold_pct, 100001);
});

test('Full Unicode case folding is shared by aliases, keyword identity, and merchant identity', () => {
  const config = Settings.parse({ ...baseInput, keywords: ['Stra\u00dfe', 'STRASSE'], brand_aliases: ['Stra\u00dfe', 'STRASSE', '\u03bf\u03c2', '\u039f\u03a3'] }, 'fold');
  assert.deepEqual(config.keywords, ['Stra\u00dfe']);
  assert.deepEqual(config.brand_aliases, ['Stra\u00dfe', '\u03bf\u03c2']);
  assert.equal(job({ ...baseInput, keywords: ['Stra\u00dfe'] }).scope_id, job({ ...baseInput, keywords: ['STRASSE'] }).scope_id);
  for (const [alias, title] of [['Stra\u00dfe', 'STRASSE speaker'], ['\u03bf\u03c2', '\u039f\u03a3 speaker'], ['\u039f\u03a3', '\u03bf\u03c2 speaker']]) {
    assert.equal(normalized([card(1, 'x', title)], { ...baseInput, brand_aliases: [alias] }).products[0].is_target, true);
  }
  const baseline = savedRecord();
  const current = { ...baseline, checked_at: '2026-01-02T00:00:00Z', products: baseline.products.map(p => ({ ...p, merchant: 'STRASSE', price_value: 110 })) };
  const prior = History.productRows(baseline).map(p => ({ ...p, merchant: 'Stra\u00dfe' }));
  assert.equal(History.compare(current, baseline, prior, job()).price_changes[0].change_pct, 10);
});

test('All identifiers use at least 128 hash bits and avoid known cross-execution snapshot collisions', () => {
  const make = run => Settings.jobs(Settings.parse(baseInput, run))[0];
  const a = make('54009');
  const b = make('341824');
  assert.notEqual(a.snapshot_id, b.snapshot_id);
  assert.equal(a.scope_id, b.scope_id);
  const sample = Shopping.normalize({ engine: 'google_shopping', query: a.keyword, result: { code: 200, shopping: [card(1, '1')] } }, a);
  for (const id of [a.query_id, a.scope_id, a.snapshot_id, sample.products[0].record_id]) assert.match(id, /^[a-f0-9]{32,}$/u);
  assert.equal(Settings.hash(''), '6c62272e07bb014262b821756295c58d');
});

test('Exact positive and negative five percent prices meet thresholds without rounding stored changes', () => {
  const baseline = savedRecord();
  for (const [previous, currentPrice] of [[0.20, 0.21], [0.20, 0.19], [100, 105], [100, 95]]) {
    const current = { ...baseline, checked_at: '2026-01-02T00:00:00Z', products: baseline.products.map(p => ({ ...p, price_value: currentPrice })) };
    const prior = History.productRows(baseline).map(p => ({ ...p, price_value: previous }));
    const compared = History.compare(current, baseline, prior, job());
    assert.equal(compared.price_changes[0].change_pct, (currentPrice - previous) / previous * 100);
    assert.ok(compared.alert_reasons.includes('price_change'), `${previous} to ${currentPrice}`);
  }
  const below = { ...baseline, checked_at: '2026-01-02T00:00:00Z', products: baseline.products.map(p => ({ ...p, price_value: 104.999999 })) };
  assert.ok(!History.compare(below, baseline, History.productRows(baseline), job()).alert_reasons.includes('price_change'));
  const fractional = { ...baseline, checked_at: '2026-01-02T00:00:00Z', products: baseline.products.map(p => ({ ...p, price_value: 110 })) };
  const prior = History.productRows(baseline).map(p => ({ ...p, price_value: 90 }));
  assert.equal(History.compare(fractional, baseline, prior, job()).price_changes[0].change_pct, 20 / 90 * 100);
});

test('Literal alias search checks overlapping occurrences with valid word boundaries', () => {
  assert.equal(Shopping.aliasMatches('XA-A-A', ['A-A']), 'A-A');
  assert.equal(Shopping.aliasMatches('XA-A-X', ['A-A']), null);
  assert.equal(Shopping.aliasMatches('\u{10400}A-A-A', ['A-A']), 'A-A');
});
