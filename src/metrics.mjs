export const Metrics = (() => {
function round(value, places = 2) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(places));
}
function number(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

  function measure(sample = {}, config = {}) {
    const products = Array.isArray(sample.products) ? sample.products : [];
    const depth = Number(config.shelf_depth ?? sample.shelf_depth ?? 20);
    const top = products.filter((product) => Number.isInteger(product.position) && product.position > 0 && product.position <= depth).sort((a, b) => a.position - b.position);
    const targets = top.filter((product) => product.is_target);
    const allTargets = products.filter((product) => product.is_target);
    const denominator = top.length;
    const share = denominator ? (targets.length / denominator) * 100 : null;
    const unique = new Set(allTargets.map((product) => product.product_id)).size;
    const firstTargetPosition = allTargets.length ? Math.min(...allTargets.map((product) => product.position)) : null;
    const competitors = top.filter((product) => !product.is_target).slice(0, 5).map((product) => ({
      position: product.position, product_id: product.product_id, title: product.title, merchant: product.merchant,
      price_raw: product.price_raw, price_value: product.price_value, currency: product.currency, link: product.link,
      relation: firstTargetPosition != null && product.position < firstTargetPosition ? 'above_target' : 'top_observed_product',
    }));
    const trusted = sample.collection_status === 'success' || sample.collection_status === 'partial';
    const record = {
      ...config,
      ...sample,
      products,
      scope_id: sample.scope_id ?? config.scope_id ?? null,
      scope_json: sample.scope_json ?? config.scope_json ?? null,
      snapshot_id: sample.snapshot_id ?? config.snapshot_id ?? null,
      run_id: sample.run_id ?? config.run_id ?? null,
      checked_at: sample.checked_at ?? config.run_anchor ?? null,
      target_name: config.target_name ?? sample.target_name ?? null,
      keyword: sample.keyword ?? config.keyword ?? null,
      country: config.country ?? sample.country ?? null,
      language: config.language ?? sample.language ?? null,
      shelf_depth: depth,
      collection_status: sample.collection_status ?? 'invalid_response',
      coverage_note: sample.coverage_note ?? '',
      cards_received: number(sample.cards_received) ?? 0,
      valid_cards: number(sample.valid_cards) ?? products.length,
      shelf_seen: trusted ? (number(sample.shelf_seen) ?? top.length) : null,
      shelf_complete: trusted && sample.shelf_complete === true,
      slots_held: trusted ? targets.length : null,
      share_of_shelf_pct: trusted ? share : null,
      unique_target_products: trusted ? unique : null,
      target_observed: trusted ? allTargets.length > 0 : null,
      best_position: trusted ? firstTargetPosition : null,
      baseline_snapshot_id: null, baseline_checked_at: null, comparison_status: 'not_comparable', rank_delta: null, share_delta_pp: null,
      price_changes: [], competitors: trusted ? competitors : [], alert_reasons: [],
      api_credits: sample.api_credits ?? null, cache_status: sample.cache_status ?? null, upstream_response_id: sample.upstream_response_id ?? null,
      analysis_status: 'not_requested', analysis_summary: '', snapshot_complete: false, error_message: sample.error_message ?? '',
    };
    if (record.collection_status === 'success' && record.shelf_complete) record.snapshot_complete = false;
    return record;
  }
  return { measure, round, number };
})();
