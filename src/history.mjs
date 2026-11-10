export const History = (() => {
// Supplementary full case folds generated from Python Unicode 14.0.0; standard lowercasing handles the remaining characters.
const CASE_FOLD = {"\u00b5":"\u03bc","\u00df":"ss","\u0149":"\u02bcn","\u017f":"s","\u01f0":"j\u030c","\u0345":"\u03b9","\u0390":"\u03b9\u0308\u0301","\u03b0":"\u03c5\u0308\u0301","\u03c2":"\u03c3","\u03d0":"\u03b2","\u03d1":"\u03b8","\u03d5":"\u03c6","\u03d6":"\u03c0","\u03f0":"\u03ba","\u03f1":"\u03c1","\u03f5":"\u03b5","\u0587":"\u0565\u0582","\uab70":"\u13a0","\uab71":"\u13a1","\uab72":"\u13a2","\uab73":"\u13a3","\uab74":"\u13a4","\uab75":"\u13a5","\uab76":"\u13a6","\uab77":"\u13a7","\uab78":"\u13a8","\uab79":"\u13a9","\uab7a":"\u13aa","\uab7b":"\u13ab","\uab7c":"\u13ac","\uab7d":"\u13ad","\uab7e":"\u13ae","\uab7f":"\u13af","\uab80":"\u13b0","\uab81":"\u13b1","\uab82":"\u13b2","\uab83":"\u13b3","\uab84":"\u13b4","\uab85":"\u13b5","\uab86":"\u13b6","\uab87":"\u13b7","\uab88":"\u13b8","\uab89":"\u13b9","\uab8a":"\u13ba","\uab8b":"\u13bb","\uab8c":"\u13bc","\uab8d":"\u13bd","\uab8e":"\u13be","\uab8f":"\u13bf","\uab90":"\u13c0","\uab91":"\u13c1","\uab92":"\u13c2","\uab93":"\u13c3","\uab94":"\u13c4","\uab95":"\u13c5","\uab96":"\u13c6","\uab97":"\u13c7","\uab98":"\u13c8","\uab99":"\u13c9","\uab9a":"\u13ca","\uab9b":"\u13cb","\uab9c":"\u13cc","\uab9d":"\u13cd","\uab9e":"\u13ce","\uab9f":"\u13cf","\uaba0":"\u13d0","\uaba1":"\u13d1","\uaba2":"\u13d2","\uaba3":"\u13d3","\uaba4":"\u13d4","\uaba5":"\u13d5","\uaba6":"\u13d6","\uaba7":"\u13d7","\uaba8":"\u13d8","\uaba9":"\u13d9","\uabaa":"\u13da","\uabab":"\u13db","\uabac":"\u13dc","\uabad":"\u13dd","\uabae":"\u13de","\uabaf":"\u13df","\uabb0":"\u13e0","\uabb1":"\u13e1","\uabb2":"\u13e2","\uabb3":"\u13e3","\uabb4":"\u13e4","\uabb5":"\u13e5","\uabb6":"\u13e6","\uabb7":"\u13e7","\uabb8":"\u13e8","\uabb9":"\u13e9","\uabba":"\u13ea","\uabbb":"\u13eb","\uabbc":"\u13ec","\uabbd":"\u13ed","\uabbe":"\u13ee","\uabbf":"\u13ef","\u13f8":"\u13f0","\u13f9":"\u13f1","\u13fa":"\u13f2","\u13fb":"\u13f3","\u13fc":"\u13f4","\u13fd":"\u13f5","\u1c80":"\u0432","\u1c81":"\u0434","\u1c82":"\u043e","\u1c83":"\u0441","\u1c84":"\u0442","\u1c85":"\u0442","\u1c86":"\u044a","\u1c87":"\u0463","\u1c88":"\ua64b","\u1e96":"h\u0331","\u1e97":"t\u0308","\u1e98":"w\u030a","\u1e99":"y\u030a","\u1e9a":"a\u02be","\u1e9b":"\u1e61","\u1f50":"\u03c5\u0313","\u1f52":"\u03c5\u0313\u0300","\u1f54":"\u03c5\u0313\u0301","\u1f56":"\u03c5\u0313\u0342","\u1f80":"\u1f00\u03b9","\u1f81":"\u1f01\u03b9","\u1f82":"\u1f02\u03b9","\u1f83":"\u1f03\u03b9","\u1f84":"\u1f04\u03b9","\u1f85":"\u1f05\u03b9","\u1f86":"\u1f06\u03b9","\u1f87":"\u1f07\u03b9","\u1f90":"\u1f20\u03b9","\u1f91":"\u1f21\u03b9","\u1f92":"\u1f22\u03b9","\u1f93":"\u1f23\u03b9","\u1f94":"\u1f24\u03b9","\u1f95":"\u1f25\u03b9","\u1f96":"\u1f26\u03b9","\u1f97":"\u1f27\u03b9","\u1fa0":"\u1f60\u03b9","\u1fa1":"\u1f61\u03b9","\u1fa2":"\u1f62\u03b9","\u1fa3":"\u1f63\u03b9","\u1fa4":"\u1f64\u03b9","\u1fa5":"\u1f65\u03b9","\u1fa6":"\u1f66\u03b9","\u1fa7":"\u1f67\u03b9","\u1fb2":"\u1f70\u03b9","\u1fb3":"\u03b1\u03b9","\u1fb4":"\u03ac\u03b9","\u1fb6":"\u03b1\u0342","\u1fb7":"\u03b1\u0342\u03b9","\u1fbe":"\u03b9","\u1fc2":"\u1f74\u03b9","\u1fc3":"\u03b7\u03b9","\u1fc4":"\u03ae\u03b9","\u1fc6":"\u03b7\u0342","\u1fc7":"\u03b7\u0342\u03b9","\u1fd2":"\u03b9\u0308\u0300","\u1fd3":"\u03b9\u0308\u0301","\u1fd6":"\u03b9\u0342","\u1fd7":"\u03b9\u0308\u0342","\u1fe2":"\u03c5\u0308\u0300","\u1fe3":"\u03c5\u0308\u0301","\u1fe4":"\u03c1\u0313","\u1fe6":"\u03c5\u0342","\u1fe7":"\u03c5\u0308\u0342","\u1ff2":"\u1f7c\u03b9","\u1ff3":"\u03c9\u03b9","\u1ff4":"\u03ce\u03b9","\u1ff6":"\u03c9\u0342","\u1ff7":"\u03c9\u0342\u03b9","\ufb00":"ff","\ufb01":"fi","\ufb02":"fl","\ufb03":"ffi","\ufb04":"ffl","\ufb05":"st","\ufb06":"st","\ufb13":"\u0574\u0576","\ufb14":"\u0574\u0565","\ufb15":"\u0574\u056b","\ufb16":"\u057e\u0576","\ufb17":"\u0574\u056d"};
function caseFold(value) {
  return Array.from(value.normalize('NFKC').toLowerCase(), char => CASE_FOLD[char] ?? char).join('');
}
  const METRIC_COLUMNS = 'snapshot_id,run_id,scope_id,scope_json,metric_version,checked_at,target_name,keyword,country,language,shelf_depth,collection_status,coverage_note,cards_received,valid_cards,shelf_seen,shelf_complete,slots_held,share_of_shelf_pct,unique_target_products,target_observed,best_position,baseline_snapshot_id,baseline_checked_at,comparison_status,rank_delta,share_delta_pp,price_changes_json,competitors_json,alert_reasons_json,api_credits,cache_status,upstream_response_id,analysis_status,analysis_summary,snapshot_complete,error_message'.split(',');
  const PRODUCT_COLUMNS = 'record_id,snapshot_id,scope_id,checked_at,keyword,country,language,position,product_id,title,merchant,price_raw,price_value,currency,rating,rating_count,link,image_url,is_target,match_reason'.split(',');
  const numeric = (value) => (typeof value === 'number' && Number.isFinite(value)) ? value : (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/u.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null);
  const boolean = (value) => value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
  const norm = (value) => typeof value === 'string' ? caseFold(value).replace(/\s+/gu, ' ').trim() : '';
  const unwrap = (value) => value?.json ?? value;
  const selectColumns = (row, columns) => Object.fromEntries(columns.map((key) => [key, row[key] ?? null]));
  function meetsThreshold(value, threshold) {
    if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) return false;
    const magnitude = Math.abs(value);
    // Allow only machine-precision error from subtraction and percentage division; stored values stay unrounded.
    const tolerance = 16 * Number.EPSILON * Math.max(magnitude, threshold);
    return magnitude >= threshold || threshold - magnitude <= tolerance;
  }

  function parseRow(raw) {
    const row = { ...unwrap(raw) };
    const rankValid = row.best_position === null || row.best_position === undefined || row.best_position === '' || numeric(row.best_position) !== null;
    for (const key of ['metric_version', 'shelf_depth', 'cards_received', 'valid_cards', 'shelf_seen', 'slots_held', 'share_of_shelf_pct', 'unique_target_products', 'best_position', 'rank_delta', 'share_delta_pp', 'api_credits']) row[key] = numeric(row[key]);
    for (const key of ['shelf_complete', 'snapshot_complete', 'target_observed']) row[key] = boolean(row[key]);
    return { ...row, _rank_valid: rankValid };
  }

  function selectBaseline(rows, job, checkedAt) {
    const now = Date.parse(checkedAt);
    if (!Number.isFinite(now)) return null;
    const candidates = (rows ?? []).map(parseRow).filter((row) => row.scope_id === job.scope_id && row.scope_json === job.scope_json &&
      row._rank_valid && row.metric_version === (job.metric_version ?? 1) && row.collection_status === 'success' && row.shelf_complete && row.snapshot_complete &&
      typeof row.snapshot_id === 'string' && row.snapshot_id.length > 0 && Number.isFinite(Date.parse(row.checked_at)) && Date.parse(row.checked_at) < now &&
      row.share_of_shelf_pct !== null && row.share_of_shelf_pct >= 0 && row.share_of_shelf_pct <= 100 &&
      (row.best_position === null || Number.isInteger(row.best_position) && row.best_position > 0));
    candidates.sort((a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at) || String(a.snapshot_id).localeCompare(String(b.snapshot_id)));
    if (!candidates.length) return null;
    const { _rank_valid, ...selected } = candidates[0];
    return selected;
  }

  function compare(record, baseline, priorProducts, config) {
    const next = { ...record, baseline_snapshot_id: null, baseline_checked_at: null, comparison_status: 'not_comparable', rank_delta: null, share_delta_pp: null, price_changes: [], alert_reasons: [] };
    if (record.collection_status !== 'success' || record.shelf_complete !== true) return next;
    if (!baseline) return { ...next, comparison_status: 'baseline_created' };
    const previous = selectBaseline([baseline], record, record.checked_at);
    if (!previous) return { ...next, comparison_status: 'baseline_created' };
    next.baseline_snapshot_id = previous.snapshot_id;
    next.baseline_checked_at = previous.checked_at;
    next.comparison_status = 'compared';
    const oldRank = previous.best_position;
    const newRank = numeric(record.best_position);
    if (oldRank !== null && newRank !== null) next.rank_delta = oldRank - newRank;
    else if (oldRank === null && newRank !== null) next.comparison_status = 'newly_observed';
    else if (oldRank !== null && newRank === null) next.comparison_status = 'not_observed';
    if (numeric(record.share_of_shelf_pct) !== null && previous.share_of_shelf_pct !== null) next.share_delta_pp = record.share_of_shelf_pct - previous.share_of_shelf_pct;

    function offers(rows) {
      const groups = new Map();
      for (const raw of rows) {
        const row = unwrap(raw);
        if (!row || typeof row.product_id !== 'string' || !norm(row.merchant) || typeof row.currency !== 'string' || !row.currency) continue;
        const key = JSON.stringify([row.product_id, norm(row.merchant), row.currency]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
      return groups;
    }
    const prior = offers((priorProducts ?? []).map(unwrap).filter((row) => row?.snapshot_id === previous.snapshot_id && row.scope_id === previous.scope_id));
    const current = offers(record.products ?? []);
    for (const [key, cards] of current) {
      if (!cards.some((row) => boolean(row.is_target))) continue;
      const oldCards = prior.get(key);
      if (!oldCards) continue;
      const oldPrices = oldCards.map((row) => numeric(row.price_value));
      const newPrices = cards.map((row) => numeric(row.price_value));
      if (oldPrices.some((price) => price === null) || newPrices.some((price) => price === null) || new Set(oldPrices).size !== 1 || new Set(newPrices).size !== 1 || oldPrices[0] <= 0 || newPrices[0] < 0) continue;
      const change = (newPrices[0] - oldPrices[0]) / oldPrices[0] * 100;
      next.price_changes.push({ product_id: cards[0].product_id, title: cards[0].title, merchant: cards[0].merchant, currency: cards[0].currency, previous_price: oldPrices[0], current_price: newPrices[0], change_pct: change });
    }
    if (next.rank_delta !== null && Math.abs(next.rank_delta) >= config.rank_alert_threshold) next.alert_reasons.push('rank_change');
    if (next.share_delta_pp !== null && meetsThreshold(next.share_delta_pp, config.share_alert_threshold_pp)) next.alert_reasons.push('share_change');
    if (next.price_changes.some((change) => meetsThreshold(change.change_pct, config.price_alert_threshold_pct))) next.alert_reasons.push('price_change');
    if (next.comparison_status === 'newly_observed' || next.comparison_status === 'not_observed') next.alert_reasons.push(next.comparison_status);
    return next;
  }

  function productRows(record) {
    return (record.products ?? []).map((product) => selectColumns({ ...product, snapshot_id: record.snapshot_id, scope_id: record.scope_id, checked_at: record.checked_at }, PRODUCT_COLUMNS));
  }
  function metricRow(record) {
    return selectColumns({ ...record, price_changes_json: JSON.stringify(record.price_changes ?? []), competitors_json: JSON.stringify(record.competitors ?? []), alert_reasons_json: JSON.stringify(record.alert_reasons ?? []) }, METRIC_COLUMNS);
  }
  function confirm(expectedRows, responses, key) {
    const expected = new Set((expectedRows ?? []).map(unwrap).map((row) => row?.[key]).filter((id) => typeof id === 'string' && id));
    const confirmed = new Set();
    const errors = [];
    for (const raw of responses ?? []) {
      const row = unwrap(raw);
      if (row?.error || row?.success === false) {
        errors.push(typeof row.error === 'string' ? row.error : row.error?.message ?? row.error_message ?? 'Sheets write failed');
        continue;
      }
      if (typeof row?.[key] === 'string' && expected.has(row[key])) confirmed.add(row[key]);
    }
    const missing = [...expected].filter((id) => !confirmed.has(id));
    const invalidExpected = (expectedRows ?? []).length !== expected.size;
    return { status: errors.length ? 'failed' : missing.length || invalidExpected ? 'unconfirmed' : 'saved', confirmed_ids: [...confirmed], missing_ids: missing, error_message: errors.join('; ') || (missing.length || invalidExpected ? 'Sheets did not acknowledge every expected row ID' : '') };
  }
  return { METRIC_COLUMNS, PRODUCT_COLUMNS, selectBaseline, compare, productRows, metricRow, confirm };
})();
