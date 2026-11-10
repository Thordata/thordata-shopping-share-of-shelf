export function createWorkflow({ Settings, Shopping, Metrics, History, Report }) {
  const one = json => [{ json }];
  const rows = items => items.map(item => item.json ?? item).filter(row => row && Object.keys(row).length);
  function prepare(input, executionId) {
    const config = Settings.parse(input, executionId);
    return one({ config, jobs: Settings.jobs(config) });
  }
  function baselines(context, historyItems) {
    const history = rows(historyItems);
    if (history.some(row => row.error)) throw new Error('Keyword history could not be read. No searches were started.');
    return one({ ...context, baselines: Object.fromEntries(context.jobs.map(job => [job.query_id, History.selectBaseline(history, job, context.config.run_anchor)])) });
  }
  function searches(context, productItems) {
    const products = rows(productItems);
    if (products.some(row => row.error)) throw new Error('Product history could not be read. No searches were started.');
    return context.jobs.map(job => ({ json: { ...job, config: context.config,
      baseline: context.baselines[job.query_id],
      prior_products: products.filter(product => product.snapshot_id === context.baselines[job.query_id]?.snapshot_id),
    }, pairedItem: { item: 0 } }));
  }
  function normalize(jobs, pairs) {
    const samples = jobs.map(job => {
      const matches = pairs.filter(pair => pair.query_id === job.query_id);
      const response = matches.length === 1 ? matches[0].response : { error: matches.length ? 'Ambiguous response association for this keyword.' : 'No response received for this keyword.' };
      return Shopping.normalize(response, job);
    });
    return one({ config: jobs[0].config, samples });
  }
  function measure(envelope) {
    const records = envelope.samples.map(sample => History.compare(Metrics.measure(sample, envelope.config), sample.baseline, sample.prior_products ?? [], envelope.config));
    return one({ config: envelope.config, records, should_analyze: envelope.config.enable_ai && records.some(record => record.valid_cards > 0 && record.collection_status !== 'invalid_response') });
  }
  function analysisInput(envelope) {
    return one({ prompt: Report.prompt(envelope) });
  }
  function report(envelope, analysisItems) {
    let analysis;
    try { analysis = Report.analysis(envelope, envelope.should_analyze ? rows(analysisItems)[0] : null); }
    catch { analysis = { status: 'failed', summary: 'AI analysis was unavailable. Review the measured changes and source products below.', findings: [] }; }
    const records = envelope.records.map(record => {
      const finding = analysis.findings?.find(item => item.query_id === record.query_id);
      return { ...record, analysis_status: analysis.status, analysis_summary: finding ? `${finding.observation} ${finding.action}` : analysis.summary };
    });
    const result = { ...envelope, records, analysis, product_rows: records.flatMap(record => History.productRows(record)), save: { products: { status: 'pending' }, metrics: { status: 'pending' } } };
    result.report = Report.render(result);
    return one(result);
  }
  function expandProducts(envelope) { return envelope.product_rows.map(json => ({ json, pairedItem: { item: 0 } })); }
  function productSaves(envelope, responseItems) {
    const responses = envelope.product_rows.length ? rows(responseItems) : [];
    const overall = History.confirm(envelope.product_rows, responses, 'record_id');
    const records = envelope.records.map(record => {
      const expected = envelope.product_rows.filter(row => row.snapshot_id === record.snapshot_id);
      const relevant = responses.filter(row => row.error || expected.some(e => e.record_id === row.record_id));
      const confirmation = History.confirm(expected, relevant, 'record_id');
      return { ...record, snapshot_complete: confirmation.status === 'saved', product_save_status: confirmation.status };
    });
    return one({ ...envelope, records, metric_rows: records.map(record => History.metricRow(record)), save: { ...envelope.save, products: overall } });
  }
  function expandMetrics(envelope) { return envelope.metric_rows.map(json => ({ json, pairedItem: { item: 0 } })); }
  function metricSaves(envelope, responseItems) {
    const responses = rows(responseItems);
    const confirmation = History.confirm(envelope.metric_rows, responses, 'snapshot_id');
    const records = envelope.records.map(record => ({ ...record, metric_save_status: History.confirm(envelope.metric_rows.filter(row => row.snapshot_id === record.snapshot_id), responses.filter(row => row.error || row.snapshot_id === record.snapshot_id), 'snapshot_id').status }));
    return one({ ...envelope, records, save: { ...envelope.save, metrics: confirmation } });
  }
  function finalize(envelope) {
    const saveFailed = ['products', 'metrics'].some(key => envelope.save[key].status !== 'saved');
    const allSourcesFailed = envelope.records.length > 0 && envelope.records.every(record => ['request_failed', 'invalid_response'].includes(record.collection_status));
    const operationalIssue = saveFailed || envelope.records.some(record => record.collection_status !== 'success');
    const hasEvents = envelope.records.some(record => record.alert_reasons?.length);
    const result = { ...envelope, fatal_reasons: [allSourcesFailed ? 'All keyword collections failed' : null, saveFailed ? 'Snapshot persistence failed or was unconfirmed' : null].filter(Boolean),
      should_notify: envelope.config.enable_slack && Boolean(operationalIssue || hasEvents) };
    result.report = Report.render(result);
    return one(result);
  }
  function outcome(envelope) {
    if (envelope.fatal_reasons.length) throw new Error(`${envelope.fatal_reasons.join('. ')}. Open Show Shopping Report or Finalize Report for the complete results.`);
    return one(envelope);
  }
  function searchWithHistory(context, metricItems, productItems) {
    return searches(baselines(context, metricItems)[0].json, productItems);
  }
  function analyzeSearches(jobs, pairs) {
    const envelope = measure(normalize(jobs, pairs)[0].json)[0].json;
    return one({ ...envelope, ...(envelope.should_analyze ? { prompt: Report.prompt(envelope) } : {}) });
  }
  function batchWithContext(envelope, batch) {
    const items = batch.length ? batch : [{ json: {}, pairedItem: { item: 0 } }];
    return items.map((item, index) => ({ ...item, json: { ...item.json, ...(index === 0 ? { _context: envelope } : {}) } }));
  }
  function productBatch(envelope, analysisItems) {
    const result = report(envelope, analysisItems)[0].json;
    return batchWithContext(result, expandProducts(result));
  }
  function metricBatch(envelope, responseItems) {
    const result = productSaves(envelope, responseItems)[0].json;
    return batchWithContext(result, expandMetrics(result));
  }
  function completeReport(envelope, responseItems) {
    return finalize(metricSaves(envelope, responseItems)[0].json);
  }
  return { prepare, baselines, searches, normalize, measure, analysisInput, report, expandProducts, productSaves, expandMetrics, metricSaves, finalize, outcome, searchWithHistory, analyzeSearches, productBatch, metricBatch, completeReport };
}
