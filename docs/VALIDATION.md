# Validation and service boundaries

This workflow is validated as an inactive, portable n8n export. No production spreadsheet, OpenAI account, or Slack channel was used during implementation testing.

## Reproduce the checks

Run from the workflow directory using Node.js >=20:

```powershell
npm run build
npm test
npm run validate
npm run test:native
npm run test:runtime
npm run sample
```

The unit-test launcher enumerates `tests/*.test.mjs` explicitly. This avoids Windows glob differences between Node versions and prevents accidental execution of the separate runtime harness during unit tests.

`test:runtime` locates the adjacent isolated test installation, or uses `N8N_RUNTIME_HOME` and `N8N_RUNTIME_NODE`. `validate` uses `N8N_NODE_MODULES` when supplied, otherwise the adjacent installation. The runtime test requires compatible native node versions, not a specific global Node executable.

For a focused runtime reproduction, use `npm run test:runtime -- first-run`. A focused run records `fullSuite=false`; only an unfiltered run verifies the full scenario suite.

`test:native` defaults to the adjacent local Thordata package. To reproduce the published-package check, extract the npm `n8n-nodes-thordata@0.1.6` archive outside the project and set `THORDATA_PACKAGE_DIR` to its `package` directory and `THORDATA_PACKAGE_SOURCE` to a descriptive label. This check does not modify the installed node package.

## Verified layers

| Layer | Scope |
| --- | --- |
| Build | Generates the JSON and two CSV headers from source; the export is inactive |
| Unit tests | 80 checks passed on Node.js 20.17.0 and 25.7.0, including review regressions and compact graph/batching cases |
| Export validation | 26 canvas items, including seven embedded Code nodes; 26 local native parameter contracts checked; one horizontal main row and no stale removed-node references |
| Published node contract | Actual npm 0.1.6 `execute()` called with fixture HTTP helpers, including successful and failed requests |
| Sheets action contract | Actual native `appendOrUpdate` actions called with fixture transport; RAW values and returned row IDs checked |
| Isolated n8n runtime | All 18 scenarios passed on the compact graph, including expected failure outcomes, native sandbox hyperlinks, first-baseline/no-change Slack suppression, both history-read failures, and GB outside-shelf reporting; `fullSuite=true` |
| Example report | Generated from the two sanitized production Shopping samples; persistence is explicitly pending in this preview |

The compact canvas contains 22 execution/model nodes and four English sticky notes. Its main path is one horizontal row, with the alternate trigger and model attached below. All exported node names, notes, configuration help, report labels, AI instructions, and fallback messages are English. Source keywords and product data preserve their original language. The layout preview in `artifacts/compact-canvas.png` was generated from exported coordinates and visually inspected; it is not a screenshot from n8n.

The annotation pass follows the supplied team's documentation checklist: one yellow overview at the upper left (245 English words), `How it works` and `Setup` headings, and three white section notes below 50 words (38, 41, and 39). Setup lists all credential types, editable settings, and manual testing. Notes reserve space above the grouped nodes and avoid overlapping regions. No red warning note is needed; limitations appear in the overview and relevant node notes.

The validator checks these documentation constraints, nonempty English notes on all execution/model nodes, and absence of Han characters from the exported workflow and all `.mjs` files in `src` and `scripts`. Negative language-test fixtures are intentionally outside this production-code scan. This checklist is supplied team guidance, not a claim that all current Template Library review rules were independently verified.

After these annotation edits, 80 unit tests and export/native parameter validation passed again. [Annotation verification](../artifacts/annotation-validation.json) confirms execution nodes, their positions and parameters, connections, and workflow settings match the previous repository version exactly after excluding node notes and sticky notes. No fresh live request or full runtime rerun was needed for this documentation-only change; the runtime results below apply to the unchanged execution graph.

The latest full-suite verification completed on 2026-11-07 using n8n 1.97.1, n8n-nodes-base 1.95.1, @n8n/n8n-nodes-langchain 1.96.1, and Node.js 20.17.0. The runtime artifact records the exact timestamp. Its temporary database directory was removed after execution.

## Runtime cases

The isolated harness imports generated workflows into temporary SQLite state and runs them using the real n8n CLI. It retains the production graph and original Code, IF, Set, Schedule, Manual Trigger, and HTML definitions. External service nodes are replaced with expression-aware fixtures; the disconnected model subnode is removed. A preload blocks network connections and listeners.

Cases cover:

1. First successful baseline with Slack enabled but no movement notification.
2. Compatible historical changes and one threshold digest.
3. Mixed successful, partial, empty, and failed keywords.
4. All requests failing, with the report generated before execution failure.
5. Either keyword-history or product-history read failure before any SERP work.
6. Explicit empty collections and skipped product-write branches.
7. AI disabled, malformed output, and request failure.
8. Product-write failure, metric-write failure, and missing acknowledgment IDs.
9. Slack delivery failure after earlier confirmed saves.
10. Reordered and omitted responses, preserving every configured keyword.
11. Uppercase GB/EN settings, raw GBP prices with explicit unsupported-price-alert text, and position 25 labeled outside the complete Top 20 shelf.
12. An unchanged complete observation with no Slack notification, and first-item-only context in write batches excluded from Sheets column mappings.

The final runtime assertions also require product links to survive the real Code sandbox and native HTML rendering. The report implements portable URL validation because this n8n sandbox does not provide the browser `URL` global. It escapes source braces so the HTML node does not evaluate product text as an n8n expression.

Expected operational failures count as passing scenarios only when execution fails at the required node, the report remains accessible, and metrics/save outcomes remain truthful. They are not silently converted into successful runs.

## Evidence files

- [Runtime results](../artifacts/runtime-validation.json): actual runtime versions, scenario outcomes, timestamp, and whether the full suite ran.
- [Native action results](../artifacts/native-contracts.json): package provenance and separately verified native actions.
- [Example HTML report](../artifacts/sample-report.html) and [Markdown report](../artifacts/sample-report.md): fixture-backed output, with no claim of live persistence.
- [Live user simulation](../artifacts/live-user-simulation.json) and [live HTML report](../artifacts/live-user-simulation-report.html): one authorized real SERP request passed through the published node and offline workflow stages. No external write was performed.
- [Shopping fixtures](../tests/fixtures/): sanitized responses from two authorized production requests on 2026-11-05. Each original request returned 40 cards and reported two credits. These observations do not guarantee future result counts or charges.

## Limits of verification

Fixture-backed execution verifies graph routing, expressions, item associations, calculations, fallback behavior, HTML generation, and write-result interpretation. It does not verify live OAuth access, worksheet ownership, model entitlement, provider billing, Slack membership, or scheduled execution in the user's deployment. Follow the setup guide for a manual account integration run before activation.

The authorized live simulation used one US/en `wireless earbuds` query with `start=0`, target alias `JBL`, and Top 20 measurement. The published node returned business code 200, 40 cards, 40 valid normalized cards, and two reported credits. The target appeared at positions 2, 7, 16, and 18 within the returned page, so the measured Top 20 result was complete with four held slots and 20% observed share. The run established a baseline in memory and left product/metric save status pending; it did not write Google Sheets, call OpenAI, or send Slack.

The model is configurable. Its current default, [gpt-5.6-terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), documents Chat Completions support; the native node sends low reasoning effort and does not force a temperature. No live model request was made for this workflow.

AI schema, identifiers, lengths, and conservative English-language checks are enforced. The language check is a lexical heuristic, not proof of semantic language correctness. Uncertain or invalid output falls back to deterministic English guidance, while numeric metrics remain unchanged.

Desktop and narrow-layout report checks were performed during report development. A later attempt to open the local HTML in the built-in browser was blocked because its URL policy disallows `file://`; no alternate browser route was used to bypass that rejection. The local artifact remains available for manual viewing.
