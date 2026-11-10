# Google Shopping Rank and Share of Shelf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans when implementation is requested. Follow the tasks and acceptance cases below. This document does not authorize deployment, publication, or sending live notifications.

**Goal:** Build an English-only n8n workflow that uses the published Thordata SERP node to monitor Google Shopping keyword rankings, observed share of shelf, and comparable product prices, with historical reporting and optional notifications.

**Architecture:** Make one first-page Google Shopping request per unique keyword and market. Calculate metrics deterministically, compare them with compatible successful snapshots in Google Sheets, and use OpenAI only to explain the evidence. Always produce an English HTML report, including explicit collection, analysis, and persistence status.

**Tech stack:** Self-hosted n8n, `n8n-nodes-thordata@0.1.6`, native Code, Google Sheets, HTML, OpenAI Chat Model/Basic LLM Chain, and Slack nodes; Node.js ES modules and the built-in test runner for development.

**Date:** 2026-11-05. **Status:** Implemented and verified. See [Validation](VALIDATION.md) for actual test results and service boundaries. This document preserves the development contract and records the delivered layout below.

## 1. Scope and product language

Workflow title:

> Track Google Shopping keyword rankings and share of shelf with Thordata and OpenAI

The workflow monitors product visibility in Google Shopping. It does not measure sales, market share, impressions, clicks, or rankings on a merchant's own website. It does not require Amazon data or the unpublished Web Scraper resource. No changes to the Thordata node package or backend are required.

All authored content in the deliverable workflow must be English:

- Workflow title, node names, sticky notes, node notes, field labels, and configuration help.
- Settings identifiers, validation messages, status labels, and fallback messages.
- AI instructions and generated explanations, HTML reports, Slack messages, and worksheet headers.
- Comments embedded in exported Code nodes, sample reports, and setup instructions.

Original user keywords, product titles, merchant names, prices, and URLs remain verbatim source data. Do not translate them or change matching behavior to make a report appear English. There is no report-language selector in v1; generated explanations always use English.

## 2. Verified integration facts

These observations were checked on 2026-11-05; they are evidence, not guarantees about every future response.

| Item | Verified result |
| --- | --- |
| Published npm package | `n8n-nodes-thordata@0.1.6` |
| Native node type/version | `n8n-nodes-thordata.thordata`, type version `1` |
| Resource / operation | `serp` / `google_shopping` |
| Credential type | `thordataApi` |
| Visible request parameters | `q`, `gl`, `hl`, `start` |
| Native output envelope | `{ engine, query, taskId?, result }` |
| Product array for observed responses | `result.shopping` |
| Card fields observed | `position`, `title`, `price`, `source`, `product_id`, `link`, `image_url`, `rating`, `rating_count` |
| Live sample: `wireless earbuds`, US/en | HTTP/business success, 40 cards, 2 reported credits |
| Live sample: `standing desk`, US/en | HTTP/business success, 40 cards, 2 reported credits |

Neither sample had a brand field or sponsored flag. `source` describes the displayed merchant, not the product brand. `product_id` is a Google product identifier and must remain a string; its numeric length can exceed JavaScript's safe integer range.

The second sample used `direct_link=true` but still returned Google product links. Therefore v1 preserves returned links and does not promise merchant landing URLs. It does not classify cards as organic or paid.

The published node handles authentication and form encoding. Its request builder sets JSON response controls, and its response normalizer preserves the raw result under `result`. Reuse that node instead of replacing it with a generic HTTP Request node.

Relevant existing implementation references:

- `../../thordata-striking-distance-seo/`: source modules, generated workflow, runtime harness, Sheets mapping, and English canvas documentation conventions.
- `../../../n8n-nodes-thordata/nodes/Thordata/Thordata.node.ts`: native parameter contract and item association.
- `../../../n8n-nodes-thordata/nodes/Thordata/request.ts`: request construction.
- `../../../n8n-nodes-thordata/nodes/Thordata/response.ts`: output normalization.

The adjacent SEO workflow documents an isolated n8n 1.97.1 environment. Reuse it only after checking the required native node versions. Record the actual n8n, Node.js, and package versions used for this workflow's runtime verification; do not assume compatibility from another workflow's results.

## 3. User settings and operating limits

One `Settings` node owns all business configuration. Capture `run_anchor` once per execution; use it for every report and snapshot timestamp.

| Setting | Default | Validation / behavior |
| --- | --- | --- |
| `keywords` | `wireless earbuds`, `bluetooth headphones`, `portable speakers` | Array of 1-20 strings; trim and collapse whitespace; each 1-200 characters; deduplicate case-insensitively |
| `target_name` | `JBL` | Required display label, 1-100 characters |
| `brand_aliases` | `["JBL"]` | At most 20 literal aliases, each 1-100 characters; deduplicate after normalization; empty allowed when product IDs are supplied |
| `product_ids` | `[]` | At most 100 nonempty string identifiers, each at most 100 characters; deduplicate exactly; never cast to numbers |
| `country` | `us` | One supported two-letter Thordata country code |
| `language` | `en` | A language supported by the selected engine |
| `shelf_depth` | `20` | Integer 1-40; an analysis window, not a promised API result count |
| `rank_alert_threshold` | `3` | Positive integer; trigger on an absolute movement at or above this value |
| `share_alert_threshold_pp` | `10` | Percentage points, greater than 0 and at most 100 |
| `price_alert_threshold_pct` | `5` | Positive percentage; only applies to comparable numeric prices |
| `enable_ai` | `true` | False skips inference and uses deterministic report text |
| `enable_slack` | `true` | Slack is enabled by default; configure a channel and credential, or explicitly disable it |
| `slack_channel` | Empty | A selected channel ID when notifications are enabled |
| `spreadsheet_id` | Empty | Required before execution; use `Keyword Metrics` and `Product Snapshots` worksheets |
| `run_anchor` | `={{ $now.toUTC().toISO() }}` | UTC instant derived once at workflow entry |

Require at least one nonblank alias or product ID. Validate all required settings before any paid request. Configure the OpenAI model and credential in the native model node rather than hardcoding an API key or duplicating model configuration in Settings.

Manual execution is available. The schedule is daily at 09:00 in `Asia/Shanghai`; worksheet timestamps use UTC ISO 8601. Export the workflow with `active=false` so import does not start a schedule.

Only one execution of this workflow may run at a time. Document this requirement in setup; concurrent writers to the same monitoring scope are outside v1 support.

## 4. Request and normalization contract

The generated Thordata node uses this parameter shape; its credential is selected after import:

```json
{
  "resource": "serp",
  "operation": "google_shopping",
  "parameters": {
    "mappingMode": "defineBelow",
    "value": {
      "q": "={{ $json.keyword }}",
      "gl": "={{ $json.config.country }}",
      "hl": "={{ $json.config.language }}",
      "start": 0
    },
    "matchingColumns": []
  },
  "options": {}
}
```

The builder must include the mapper's visible schema entries, using the published node contract, so imported fields display correctly. Do not put the token, an Authorization header, or existing credential IDs into the workflow JSON.

For each unique keyword/country/language combination:

1. Request `start=0` once. Do not add pagination, inferred page sizes, `num`, merchant filters, or hidden parameters in v1.
2. Retain a stable `query_id` and input association through native `pairedItem` links; never associate responses only by array index.
3. Inspect the normalized response and business status. A node error, missing `shopping`, and an explicit empty array are different outcomes.
4. Preserve all returned cards for audit. A valid metric card needs a positive integer `position`, a string product ID, and a nonblank title.
5. Retain `price_raw`, `merchant` from `source`, rating, review count, and returned URLs. Missing optional fields stay null.
6. Sort metric cards by the API's `position`; never renumber positions or infer missing ranks.
7. Collapse exact repeated copies of a card at the same position. Conflicting cards at one position mark the keyword `invalid_response`; do not compute a trustworthy shelf from that ambiguity.
8. The same product at different positions still occupies multiple slots. Track unique products separately; do not collapse distinct slots when calculating share.

Use these collection statuses: `success`, `partial`, `empty`, `request_failed`, `invalid_response`. Invalid cards and missing positions mark the sample partial when some trustworthy cards remain. A timeout is never an empty successful result.

Store `position`, `product_id`, `title`, `merchant`, `price_raw`, `price_value`, `currency`, `rating`, `rating_count`, `link`, `image_url`, `is_target`, and `match_reason` on normalized cards. Numeric optional fields must be finite and valid for their meaning; absent or malformed fields become null, not zero.

For v1, automatic numeric price comparisons are supported for US results with unambiguous USD prices, such as `$1,299.99` or `USD 1299.99`. Ranges, installment text, ambiguous amounts, and other markets remain display-only until an explicit, tested currency parser is added. A missing or unparseable price never invalidates an otherwise usable ranking sample.

## 5. Target matching and metric definitions

Match a target by either an exact configured product ID or a normalized title alias. Normalize aliases and titles with Unicode normalization, case folding, and whitespace normalization. Use Unicode-aware letter/number boundaries so `JBL` does not match a longer unrelated word. Treat aliases as literal text, not regular expressions.

An ID match takes precedence over an alias match. Record `product_id` or `title_alias:<alias>` in `match_reason`. Title matching is evidence of an alias appearing in a title, not proof of brand ownership; accessories can mention a brand. Users who require precise product identity should configure product IDs only. Do not use AI to decide ownership and do not infer aliases such as sub-brands.

Let `S` be the valid returned slots with `1 <= position <= shelf_depth`, and `T` be target slots in `S`.

```text
shelf_seen = count(S)
slots_held = count(T)
share_of_shelf_pct = 100 * slots_held / shelf_seen
shelf_complete = every position from 1 through shelf_depth is present once
best_position = minimum position of a target across valid first-page cards
```

`share_of_shelf_pct` is null when `shelf_seen=0`. `best_position` is null when no target is observed; never use 0 or a fabricated rank. A target outside Top N can have a best position while holding zero Top N slots.

Store unrounded values and round only for display. Show both `slots_held/shelf_seen` and the requested depth. A partial shelf may show an explicitly labeled observed share, but must not generate share-change alerts or replace a complete baseline.

Examples:

- Four target slots in a complete Top 20: `4/20`, share `20%`.
- Four target slots among 12 retrieved Top 20 positions: `4/12`, observed share `33.33%`, incomplete coverage; no share-change alert.
- No target in a complete Top 20: `0/20`, share `0%`; this does not establish absence from the entire Shopping result set.

Competitor output contains up to five non-target cards from the observed Top N. Label a card `above_target` only when its position is lower than an observed target's best position; otherwise label it `top_observed_product`. Retain the source merchant and price without claiming sales leadership or paid placement.

## 6. History, identifiers, and comparison rules

Generate IDs from canonical JSON arrays of their components, using the same portable deterministic hash in source and exported Code nodes. The hash implementation must not depend on external runtime modules. Version the metric definition as `metric_version=1`. Normalize merchant identity with Unicode normalization, case folding, and whitespace normalization; preserve the original merchant for display.

- `query_id`: engine, normalized keyword, country, language, and `start=0`; identifies a request independently of target matching settings.
- `scope_id`: engine, normalized keyword, country, language, `start=0`, shelf depth, sorted normalized aliases, sorted exact product IDs, and metric version.
- `run_id`: workflow execution ID; include a fixed injected ID in offline tests.
- `snapshot_id`: `run_id` plus `scope_id`.
- `record_id` for a product slot: snapshot ID, position, product ID, and normalized merchant.

Store the canonical scope alongside its ID and verify equality before comparing, so an ID alone never establishes scope compatibility. A changed target, market, depth, or matching definition starts a new baseline.

Read history before making SERP requests. For each scope, select the latest strictly earlier snapshot with matching canonical scope, `collection_status=success`, `shelf_complete=true`, and `snapshot_complete=true`. Never assume a record is exactly yesterday's. Display both observation timestamps and the elapsed interval.

Only complete, trustworthy current snapshots generate movement alerts. Partial, empty, and failed samples remain visible in reports and history, but cannot replace a successful baseline. Such samples use `comparison_status=not_comparable`, null change values, and an explicit coverage/error explanation. Use `compared` for eligible current/prior pairs and `baseline_created` when no eligible prior snapshot exists.

| Comparison | Calculation / event |
| --- | --- |
| Both ranks observed | `rank_delta = previous_best_position - current_best_position`; positive means improvement |
| Both shares comparable | `share_delta_pp = current_share - previous_share`; use percentage points |
| Newly observed target | Previous complete sample had no observed target; current complete sample has one; label `newly_observed` |
| Target no longer observed | Previous complete sample had a target; current complete sample has none; label `not_observed`, not delisted |
| No compatible prior snapshot | `baseline_created`; no fabricated changes and no movement alert |
| Comparable product price | `100 * (current_price - previous_price) / previous_price`, with previous price greater than zero |

Price identity requires the same scope, product ID, normalized merchant, and currency. Use target product details from the selected baseline snapshot; do not compare the current best-ranked product with a different previous best-ranked product. Repeated slots with conflicting prices for one product/merchant make that offer's price comparison ambiguous and suppress its price alert.

## 7. Google Sheets schema and persistence

Use one spreadsheet with two English-named worksheets. Generate the two CSV header templates from shared column definitions, and use explicit RAW field mapping in Sheets writes to avoid formulas from source text.

### Keyword Metrics

One row per keyword scope per execution:

```text
snapshot_id, run_id, scope_id, scope_json, metric_version, checked_at,
target_name, keyword, country, language, shelf_depth,
collection_status, coverage_note, cards_received, valid_cards,
shelf_seen, shelf_complete, slots_held, share_of_shelf_pct,
unique_target_products, target_observed, best_position,
baseline_snapshot_id, baseline_checked_at, comparison_status,
rank_delta, share_delta_pp, price_changes_json, competitors_json,
alert_reasons_json, api_credits, cache_status, upstream_response_id,
analysis_status, analysis_summary,
snapshot_complete, error_message
```

`unique_target_products` counts distinct target product IDs across valid first-page cards. `target_observed` refers to that same first-page sample. Store optional `cache_status` and `upstream_response_id` only if present; otherwise leave them null. `coverage_note` is a readable English explanation of missing positions, rejected cards, or other collection limitations.

### Product Snapshots

One row per returned trustworthy slot, including target and competitor cards:

```text
record_id, snapshot_id, scope_id, checked_at, keyword, country, language,
position, product_id, title, merchant, price_raw, price_value, currency,
rating, rating_count, link, image_url, is_target, match_reason
```

Preserve malformed raw cards in execution diagnostics with an explicit reason. Do not insert fake slot rows to make counts match. Document that Sheets contains normalized usable cards, while execution diagnostics retain rejected entries.

Persistence order is deliberate:

1. Build the complete report object in memory, including every configured keyword.
2. Upsert product rows by `record_id`; skip the write branch when there are no usable cards.
3. Inspect actual write outputs. Confirm the expected product row identities for each snapshot, not merely the absence of an error.
4. Write keyword rows by `snapshot_id`. Set `snapshot_complete=true` only when all expected product rows were confirmed for that snapshot. Collection status still controls baseline eligibility.
5. Inspect keyword write outputs and finalize the HTML report's saved/failed/unconfirmed counts.

Unconfirmed or failed writes cannot be reported as saved. Do not allow a new baseline when its product details are incomplete. Orphan product rows from an interrupted execution are ignored because no eligible keyword snapshot references them. A retry of the same execution updates the same IDs; a new manual execution records a new observation.

If history cannot be read, stop before paid requests rather than silently reporting every keyword as a first run. Sheets has finite capacity; setup must explain retention and archiving. Do not silently truncate history reads, and do not delete history automatically in v1.

## 8. Canvas and runtime flow

Use these English node names and stages. The compact export uses 22 execution/model nodes and four notes, with all main-flow nodes on one horizontal row. Only the alternate daily trigger and model subnode sit below their related nodes. See [Compact layout](COMPACT-LAYOUT.md) for merge details.

| Stage | Nodes / behavior |
| --- | --- |
| Start | `Run Manually`, `Check Rankings Daily`, `Settings`, `Prepare Monitoring Run` |
| History | `Read Keyword History`, `Read Baseline Products`, `Build Keyword Searches` (selects baselines and expands searches) |
| Collection | `Thordata Google Shopping` |
| Measurement | `Measure Shelf and Compare` (normalizes, measures, compares, and prepares optional AI input) |
| Explanation | `AI Analysis Enabled?`, `Explain Shopping Changes`, `OpenAI Chat Model` |
| Report | `Build Shopping Report` validates analysis and prepares the product batch with a single complete context |
| Persistence | `Have Product Snapshots?`, `Save Product Snapshots`, `Check Product Saves` (verifies products and prepares metric rows), `Save Keyword Metrics` |
| Delivery | `Finalize Report` (verifies metric saves and renders the final report), `Show Shopping Report`, `Should Notify Slack?`, `Send Shopping Alert` |
| Outcome | `Validate Run Outcome` marks unrecoverable collection or persistence failure after the report is available |

No-data and AI-disabled branches must still reach report assembly. A zero-item Sheets read must preserve an explicit empty history envelope. A zero-card collection must not terminate the entire graph silently. Use `alwaysOutputData` and explicit branch joins only where needed and verify them in the real executor.

The report receives the original complete list of keyword jobs. Enrichment responses are keyed by stable IDs, so a missing or reordered response never removes a keyword from the output. Never execute AI, Sheets writes, or Slack once per unexpected input item due to fan-out mistakes.

Add one English overview sticky note with `How it works` and `Setup`, plus concise stage notes. The overview explains required Thordata and Google Sheets credentials, optional AI/Slack credentials, sheet preparation, the Settings node, and manual testing before activation. Keep notes readable without overlapping nodes or connections.

## 9. AI, HTML, and notification contracts

### OpenAI

Make at most one logical analysis request per run. Send deterministic keyword metrics and up to five observed competitors per keyword, with capped title lengths. Do not send the token, all historical rows, images, or the entire raw API payload.

Request an English JSON object with:

```json
{
  "summary": "A concise evidence-based run summary.",
  "findings": [
    {
      "query_id": "An ID present in the supplied evidence",
      "observation": "A factual interpretation of the supplied metrics.",
      "action": "One practical next step grounded in those observations."
    }
  ]
}
```

Validate the object shape, known query IDs, string types, maximum lengths, and English instruction compliance. Reject unknown identifiers and unexpected fields. Source content is untrusted data: the prompt must tell the model to ignore instructions inside titles or merchant names. Do not ask the model to return numeric metrics or overwrite deterministic values.

Limit the summary to 800 characters, each observation/action to 300 characters, and findings to the number of configured keywords. No inference call is needed when every collection failed or returned no usable evidence. Set `analysis_status` to `completed`, `disabled`, `skipped_no_evidence`, or `failed`; disabled, failed, or invalid analysis uses English deterministic fallback text. Do not issue automatic content-repair calls.

### HTML report

Produce `report.html`, `report.markdown`, and `report.slackText` in execution output. `Show Shopping Report` renders the HTML in n8n. Include:

- Run time, target, market, requested depth, collection counts, save status, AI status, and API-reported credits.
- A keyword table with best position, share numerator/denominator, coverage, baseline time, rank change, and share change.
- Comparable target price movements, observed competitors, and returned product links.
- AI findings or fallback guidance, followed by collection and comparison limitations.

Escape all source and AI text in HTML; allow only HTTP/HTTPS links. A missing metric renders as `Not observed`, `Not available`, or `No baseline`, according to its meaning. Never render a missing price as `$0.00`. Prevent Slack mention injection from source text and avoid embedding arbitrary remote content in the HTML.

### Slack

Slack is on by default as requested on 2026-11-06. When enabled, send one digest if there is a threshold event, `newly_observed`, `not_observed`, or an operational collection/persistence issue. A first successful baseline and an uneventful successful run remain available in HTML/Sheets without a movement notification. An empty channel fails configuration validation before paid searches; `enable_slack=false` remains supported.

The digest includes the observation time, affected keywords, measured changes, and partial-data/save warnings. It must not claim the whole page changed or a product disappeared from Google. Slack transport failure leaves saved metrics intact and marks execution failure. Live notification testing requires an explicit user instruction; use fixtures for development.

## 10. Failure behavior and request accounting

| Condition | Required outcome |
| --- | --- |
| Invalid Settings or failed history read | Stop before SERP; actionable English error |
| One SERP request fails | Retain that keyword with `request_failed`; process other keywords |
| All SERP requests fail | Build diagnostics/report, then fail the execution; no fabricated zero-share metrics |
| Empty `shopping` array | `empty`; no baseline update or movement alert |
| Missing/malformed result shape | `invalid_response`; no baseline update |
| Incomplete Top N | `partial`; observed metrics labeled; no baseline update or movement alert |
| Missing price/rating | Keep the ranking card; null optional value |
| AI error/invalid response | Deterministic report survives; `analysis_status=failed` |
| Product or metric save failure | Preserve report, show failed/unconfirmed saves, and fail execution after report generation |
| Slack disabled | Skip its node entirely; no Slack credential required |
| Slack enabled but delivery fails | Fail execution; previously confirmed data remains saved |

Use the Thordata node's per-item error continuation. Disable automatic node-level retries on the multi-item SERP node, which could repeat previously successful billable requests. Do not implement a polling loop for this synchronous SERP operation.

At the default three unique keywords, the intended run performs three logical SERP requests and at most one logical AI request. The two live samples each reported two credits, so six credits is a sample-based estimate for three similar requests, not a billing guarantee. Sum reported credits from unique responses; unknown costs remain unknown. Request counts describe logical calls, not hidden provider retries or billing.

## 11. File layout and ownership

All new implementation files belong under:

`thordata-shopping-share-of-shelf/`

```text
README.md
package.json
thordata-shopping-share-of-shelf.json
docs/
  DEVELOPMENT.md
  SETUP.md
  VALIDATION.md
src/
  settings.mjs
  shopping.mjs
  metrics.mjs
  history.mjs
  report.mjs
  workflow.mjs
scripts/
  build-workflow.mjs
  validate-workflow.mjs
  test-n8n-runtime.mjs
  runtime-support.mjs
  check-native-contracts.mjs
  run-unit-tests.mjs
  sample-report.mjs
templates/
  Keyword Metrics.csv
  Product Snapshots.csv
tests/
  core.test.mjs
  coordinator.test.mjs
  report.test.mjs
  report-integration.test.mjs
  workflow.test.mjs
  fixtures/
    shopping-earbuds.json
    shopping-standing-desk.json
artifacts/
  sample-report.html
  sample-report.md
  runtime-validation.json
  native-contracts.json
```

`settings` validates and normalizes configuration. `shopping` adapts the native envelope and preserves source evidence. `metrics` owns matching, coverage, and deterministic calculations. `history` owns identifiers, baseline selection, comparison, and write confirmation. `report` owns AI prompts/validation and English output. `workflow` coordinates complete envelopes and item association.

The builder inlines these modules into Code nodes. The imported JSON must run without local source files, external npm imports, local filesystem paths, or environment-variable secrets. Keep the existing published package and sibling workflows unchanged.

## 12. Implementation sequence

The following completed checkpoints trace the implementation to the acceptance cases in section 13. Core unit cases share `tests/core.test.mjs`; report and coordinator cases have separate files. The imported workflow is self-contained, while the development checks also use the adjacent node package and isolated n8n installation.

### Task 1: Configuration and real response fixtures

- [x] Create `package.json` with build, test, validate, and isolated runtime scripts.
- [x] Add sanitized copies of the two observed responses to `tests/fixtures/`; exclude request credentials and local execution metadata.
- [x] Implement `src/settings.mjs` and its tests: defaults, empty identifiers, keyword deduplication, limits, stable run time, English errors.
- [x] Verify: `proxy node --test tests/core.test.mjs`.

### Task 2: Normalize cards and calculate metrics

- [x] Implement `src/shopping.mjs` with the observed native envelope and distinct failure states.
- [x] Implement `src/metrics.mjs` with exact ID/alias matching, preserved positions, slot identity, coverage, and null handling.
- [x] Add `tests/core.test.mjs` using the concrete metric cases in section 13.
- [x] Verify: `proxy node --test tests/core.test.mjs`.

### Task 3: History and Sheets contracts

- [x] Implement `src/history.mjs`, canonical scopes, snapshot/slot IDs, compatible baseline selection, deltas, and write-result inspection.
- [x] Define both worksheet column arrays in this module; generate CSV templates from them.
- [x] Add `tests/core.test.mjs` for changed scopes, incomplete saves, target absence, duplicate offers, and reruns.
- [x] Verify: `proxy node --test tests/core.test.mjs`.

### Task 4: English reporting and optional analysis

- [x] Implement `src/report.mjs` with HTML/Markdown/Slack rendering, text escaping, evidence-limited AI prompts, and strict response validation.
- [x] Add `tests/report.test.mjs` for deterministic fallback, no baseline, null prices, invalid AI content, and injected HTML/Slack text.
- [x] Generate `artifacts/sample-report.html` from fixtures and visually inspect the rendered tables and limitations.
- [x] Verify: `proxy node --test tests/report.test.mjs`.

### Task 5: Generate the importable workflow

- [x] Implement `src/workflow.mjs` and `scripts/build-workflow.mjs`, including all success, empty, AI-disabled, and failure branches.
- [x] Reuse the published Thordata mapper shape; native Sheets/HTML/LLM/Slack parameters must match the actual test installation.
- [x] Generate the inactive JSON, both CSV headers, English overview/stage notes, and node notes.
- [x] Implement `scripts/validate-workflow.mjs` and `tests/workflow.test.mjs` for graph ports, references, embedded-code syntax, all-English authored text, and export hygiene.
- [x] Verify: `npm run build`, `npm test`, and `npm run validate`.

### Task 6: Isolated runtime and delivery documentation

- [x] Implement `scripts/test-n8n-runtime.mjs` using isolated n8n state and fixture-backed external services. Block unmocked network calls.
- [x] Execute the runtime cases in section 13 through real native nodes, including baseline reads and write acknowledgments.
- [x] Write English `README.md` and `docs/SETUP.md`: install package 0.1.6, prepare sheets, select credentials, configure targets, run manually, inspect report, then enable scheduling.
- [x] Write `docs/VALIDATION.md` and `artifacts/runtime-validation.json` with actual versions, timestamps, outcomes, and the boundary between simulated and live checks.
- [x] Verify: `npm run test:runtime`; inspect the exported workflow canvas and generated HTML report before claiming completion.

No publication, deployment, live Google Sheets write, or live Slack message is required for these checkpoints. The supplied production SERP token may be used for small authorized collection checks, but must remain outside all committed artifacts. Existing live samples are sufficient for initial development.

## 13. Acceptance cases and final checks

### Deterministic metric and history cases

| Case | Exact expected result |
| --- | --- |
| Positions 1-20 complete; target at 2, 5, 11, 18 | Best 2; slots 4; shelf seen 20; share 20%; complete true |
| Same product at positions 2 and 5 | Two occupied slots; one unique target product |
| Identical card repeated at position 2 | One occupied slot; duplicate removed |
| Different products claim position 2 | `invalid_response`; no trusted shelf or baseline |
| Only positions 1-12 returned; four targets | Seen 12; share 33.333...%; complete false; no movement alert |
| Target only at position 25, depth 20 | Best 25; Top 20 slots 0; share 0% when Top 20 is complete |
| Previous best 8, current best 3 | Rank delta +5; improvement event at threshold 3 |
| Previous share 20%, current 35% | Share delta +15 percentage points; threshold 10 fires |
| Previous absent, current best 6 | `newly_observed`; numeric rank delta null |
| Previous best 6, current complete sample absent | `not_observed`; numeric rank delta null; no delisting claim |
| Current request fails | Null current metrics; previous baseline unchanged |
| Country, aliases, or depth changes | Different scope; no comparison with the old scope |
| Latest row incomplete; earlier row complete | Select the earlier eligible baseline |
| Product/merchant/currency unchanged, $100 to $110 | Price delta +10%; threshold 5 fires |
| Product, merchant, or currency differs | No price comparison |
| Missing price or previous price zero | Null percentage change; no divide-by-zero or zero-price invention |
| Product ID `1749519698216963169` | Same exact string survives normalization, persistence, and matching |
| Alias `JBL`, title contains only `JBLX` | No alias match |

### Real n8n executor cases

1. First successful run: all keywords present, baseline rows saved, no movement Slack message.
2. Second successful run: compatible baseline selected, exact deltas, one threshold digest when enabled.
3. Mixed source outcomes: success, partial, empty, and failure each retain their keyword and distinct status.
4. All source requests fail: report available and execution marked failed.
5. History read failure: no SERP request occurs.
6. AI disabled or malformed/error response: deterministic report and persistence still run.
7. Product save fails: no complete baseline for that snapshot; failure visible in report and execution.
8. Metric save fails or acknowledgment omits an expected ID: no false saved claim; execution fails.
9. Slack disabled: no call and no credential requirement; enabled delivery failure preserves saved rows and fails execution.
10. Reordered/omitted responses and empty Sheets reads: stable item associations; no dropped keyword or accidental per-item digest fan-out.

### Release artifact checks

- All authored workflow text and generated narrative output are English, including error and fallback paths.
- Source text remains unchanged; non-English evidence is not mistaken for a localization defect.
- JSON imports with the published Thordata package and contains no unpublished resource usage.
- Metric calculations are reproducible from saved normalized cards and documented rejected-card diagnostics.
- Existing files outside this workflow directory remain unchanged.
- Export is inactive and contains no real token, saved credential ID, pin data, execution history, or local paths.
- CSV headers, explicit Sheets mappings, generated Code, and source modules agree.
- HTML displays readable tables, correct null labels, coverage and save status, and safe links.
- Verification records describe what actually ran; fixture-backed runtime tests are not represented as live end-to-end service tests.

## 14. Sources and observation boundary

The [2026-11-06 review follow-up](REVIEW-2026-11-06.md) records report clarifications, case-insensitive locale inputs, bounded price display, retention guidance, and the Slack default change. Ranking calculations, stored metric precision, sheet columns, and notification thresholds remain compatible with existing snapshots.

- [Thordata node package on npm](https://www.npmjs.com/package/n8n-nodes-thordata) and its published 0.1.6 archive, inspected on 2026-11-05.
- [Thordata public SERP schema](https://api.thordata.com/serp/playground/schema?lang=en), inspected on 2026-11-05.
- [Original reference template](https://n8n.io/workflows/19071), used only for the ranking/history/notification business pattern. This workflow uses a different source and explicitly different metric scope.
- Two authorized production Google Shopping samples collected on 2026-11-05. No live Sheets, OpenAI, or Slack integration has been validated for this new workflow at documentation time.
