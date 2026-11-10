# Setup and operation

## Prepare n8n and credentials

Use self-hosted n8n with `n8n-nodes-thordata@0.1.6` installed. Import `thordata-shopping-share-of-shelf.json`; the export is inactive and contains no saved credential selections.

Select a **Thordata SERP API** credential on **Thordata Google Shopping**. Keep the production token in n8n's credential store, not Settings, Code, screenshots, shared JSON, or worksheet cells. A credential test can consume a SERP request.

Select Google Sheets OAuth2 credentials with edit access on **Read Keyword History**, **Read Baseline Products**, **Save Product Snapshots**, and **Save Keyword Metrics**. Use the same destination spreadsheet for all four nodes.

OpenAI and Slack credentials are needed only when their respective Settings flags are enabled. Set `enable_ai=false` to skip AI entirely. When enabling AI, select an OpenAI credential on **OpenAI Chat Model** and verify the selected model is available to your account. The export starts with [gpt-5.6-terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), using low reasoning effort and no forced temperature; the model can be changed in that node. Its documented Chat Completions interface is compatible with the native model node's request path. A live OpenAI account call is not part of the offline validation. When enabling Slack, select its credential on **Send Shopping Alert**, invite the bot to the channel, and set the channel ID in Settings.

## Prepare Google Sheets

Create one spreadsheet and import each CSV template as a separate worksheet:

| Template | Exact worksheet name | Upsert key |
| --- | --- | --- |
| `templates/Keyword Metrics.csv` | `Keyword Metrics` | `snapshot_id` |
| `templates/Product Snapshots.csv` | `Product Snapshots` | `record_id` |

Keep every header in row 1, in the supplied order. Do not add a title row above it. Copy the spreadsheet ID from its URL into Settings. Leave `cellFormat=RAW` and explicit mappings on the write nodes.

The read nodes return all rows, including empty history on the first run. The workflow does not silently cap history. Google Sheets has finite capacity; archive old matching metric/product snapshots together and retain at least one complete compatible baseline per monitored scope. Do not edit stored scope IDs or product identifiers.

Each new execution appends one metric row per keyword and one product row per **valid returned first-page card**, including cards beyond `shelf_depth`. With three keywords and 40 valid cards per request, one daily run adds about 120 product rows and three metric rows: 10,800 product rows in 90 days, or 43,800 in 365 days. Actual response sizes and extra manual runs change these totals. Reducing shelf depth does not reduce the product rows collected.

Review retention every 90 days. Copy older metric snapshots and their product rows into an archive spreadsheet, verify their `snapshot_id` associations and row counts, then remove those archived rows from the active spreadsheet. Retain the latest complete, successfully saved baseline and all its product rows for every active scope, even if it is older than 90 days. Archive by snapshot rather than deleting arbitrary product rows; historical scopes being retired can be archived together. There is no automatic deletion. Retrying the same execution ID updates the same row IDs; a new manual execution creates new observations.

## Configure the monitor

**Settings** contains the following values:

| Setting | Example / meaning |
| --- | --- |
| `keywords` | `["wireless earbuds"]`; use an array, not a comma-separated string |
| `target_name` | `JBL`; display label |
| `brand_aliases` | `["JBL"]`; literal title matches |
| `product_ids` | `["1749519698216963169"]`; exact string IDs; the shown value is an example |
| `country`, `language` | `us`, `en` |
| `shelf_depth` | `20`; allowed 1-40 |
| `rank_alert_threshold` | `3`; absolute position change |
| `share_alert_threshold_pp` | `10`; percentage points, not percent relative change |
| `price_alert_threshold_pct` | `5`; percentage price change for the same comparable offer |
| `enable_ai` | Defaults to `true`; set `false` for a test without AI |
| `enable_slack` | Defaults to `true`; configure its credential/channel or explicitly set `false` |
| `slack_channel` | A channel ID when Slack is enabled |
| `spreadsheet_id` | The destination spreadsheet ID |
| `run_anchor` | Keep its built-in current-time expression |

At least one alias or product ID is required. When both are supplied, either can match, and exact IDs take precedence for the recorded match reason. For exact product tracking, leave aliases empty. The target label alone does not select products.

Countries and languages must be supported by Google Shopping's Thordata schema. Inputs such as ` US `, `EN`, and `PT-BR` are trimmed and lowercased before validation; case changes alone do not create a new scope. Changing the market, depth, aliases, IDs, or metric version starts a new scope and baseline. Original keywords and product data remain in their source language; all authored labels and generated explanations are English.

## Run and inspect

Start with one keyword. For a metrics-only test, explicitly switch AI and Slack off; both now default to on. Otherwise configure the enabled services before executing **Run Manually**, then open **Show Shopping Report**. An enabled Slack setting with an empty `slack_channel` fails configuration validation before any paid searches. **Finalize Report** retains the structured records and `report.html`, `report.markdown`, and `report.slackText` for export.

Check the report's coverage and persistence status. Confirm both worksheets contain the expected rows. A first complete observation establishes a baseline; it cannot show a numeric historical change. Run again to verify historical comparison. A keyword with no target is an observation about the returned first page, not a delisting claim.

Enable optional AI after selecting its model and credential. Model failures fall back to measured facts. Enable Slack only after setting its credential and destination. It sends a single digest for threshold events, newly observed or unobserved targets, and operational issues. Successful first runs and unchanged successful runs do not send routine movement messages.

`Best position` covers the entire returned first page, while share covers only the configured Top N. A target at position 25 with Top 20 coverage therefore shows `25 (outside Top 20 shelf)` and zero Top 20 share. This retains the observed rank without implying a calculation error.

The schedule runs at 09:00 Asia/Shanghai daily. Change the native Schedule Trigger and workflow timezone together if another schedule is needed. Avoid overlapping manual and scheduled executions; concurrent writes to the same scope are outside v1 support.

## Reading failures

- **History read error:** fix spreadsheet access or worksheet names; no SERP calls should have started.
- **Request failed:** collection did not succeed. It is not zero visibility.
- **Empty:** the API returned an explicit empty product array. No new baseline is created.
- **Partial:** some requested positions or valid cards are missing. Observed metrics are labeled; movement alerts and baseline replacement are suppressed.
- **Invalid response:** the payload or slot identities cannot support trustworthy metrics.
- **AI failed:** the report still contains deterministic measurements and fallback guidance.
- **Save failed/unconfirmed:** inspect the report and node error. The execution fails after making the report available. Product writes must be confirmed before a complete keyword snapshot is eligible as a baseline.
- **Slack failed:** previously saved data remains. A fresh full execution can create another observation and another notification; inspect history before rerunning.

Never interpret `Not observed`, `Not available`, or `No baseline` as zero. Numeric price monitoring and price alerts support US/USD only. For other markets, reports and Slack explicitly state that price monitoring is unavailable while displaying raw prices and keeping ranking/share monitoring active. Merchant or currency changes are not comparable price movements. Raw price labels are limited to 40 characters in reports; Product Snapshots keeps their full value. Changes of 1,000% or more are labeled `unusually large change; verify source prices`, with no clamping of stored values or alert decisions.

## Updating an existing import

The default change applies to newly imported workflow JSON. It does not modify an existing workflow in n8n. To update, reimport the new export and transfer your Settings and credential selections, or apply the corresponding code/settings changes to your existing copy. Keep your existing spreadsheet ID and Slack channel private; shared exports leave these fields empty.
