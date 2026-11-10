# Google Shopping rankings and share of shelf

Monitor where your products appear for selected Google Shopping keywords, how many observed Top N slots they occupy, and how comparable prices change. Thordata collects the product cards; deterministic code calculates the metrics; optional OpenAI analysis explains the evidence in English.

The Shopping data comes from [Thordata SERP API](https://www.thordata.com/products/serp-api/mcp-server?op=cianna&from=mcp) — live Google Shopping results as structured JSON, with no headless browsers or scraping infrastructure to maintain. One Thordata credential powers the whole workflow.

**Import:** [thordata-shopping-share-of-shelf.json](thordata-shopping-share-of-shelf.json)  
**Configure:** [Setup guide](docs/SETUP.md)  
**Development contract:** [Development document](docs/DEVELOPMENT.md)

The workflow uses the published `n8n-nodes-thordata@0.1.6` SERP resource with `google_shopping`. It requires self-hosted n8n with community nodes enabled. It does not use Web Scraper or a merchant's internal search engine.

## Turn Shopping visibility into actionable insight

Give your ecommerce team a repeatable view of the Google Shopping results that matter to your business. With Thordata and n8n, bring keyword visibility, observed shelf coverage, and comparable offer prices into one workflow, so your team can spend less time assembling reports and more time investigating changes.

Use the evidence to guide merchandising discussions, review competing offers, and prioritize keywords for closer attention. The workflow keeps observed results and calculated metrics visible, giving your team a clear starting point for decisions.

## What you receive

- Best observed first-page position for each keyword.
- Target slots, observed shelf size, coverage, and share of shelf.
- Changes since the latest compatible, complete, successfully saved snapshot.
- Comparable US/USD offer-price movements and observed competing products.
- An English HTML report inside n8n, plus Markdown and Slack text.
- Historical keyword metrics and product snapshots in Google Sheets.
- Optional English AI findings and optional Slack alerts.

Share of shelf is the fraction of observed search-result slots occupied by the target. It is not market share, sales share, or an impression metric. Partial samples show their actual denominator and do not generate ranking-change alerts or replace a complete baseline.

## Get your Thordata SERP API key

Before your first run, you need one Thordata SERP API key. It takes about two minutes:

1. **Create a Thordata account.** Sign up at [https://www.thordata.com/?ls=community&lk=proxyip](https://www.thordata.com/?ls=community&lk=proxyip). New accounts include a SERP API free trial — 5,000 requests over 7 days.
2. **Open the dashboard.** Log in and go to the [Thordata dashboard](https://www.thordata.com/dashboard).
3. **Find the API Keys section.** In the dashboard menu, open the **API Keys** page (exact location follows the dashboard layout; if the menu has moved, look under Account or API settings).
4. **Create and copy your key.** Click **Create API Key** (or **Generate**), name it, and copy the key shown. You will not be able to see it again after closing the dialog, so copy it now.
5. **Paste it into n8n.** In n8n, create a Thordata credential and paste the key, then select that credential on the **Thordata Google Shopping** node (see Start below).

SERP API pricing starts at $0.70 per 1,000 requests; each Shopping search in this workflow costs about 2 credits in the development samples. See the [SERP API n8n integration guide](https://www.thordata.com/products/serp-api/n8n-integration?op=cianna&from=n8n) for current plans, and the [Thordata documentation](https://doc.thordata.com/doc) for the full API reference.

## Start with one keyword

1. Install the community package and import the inactive workflow JSON.
2. Import [Keyword Metrics.csv](templates/Keyword%20Metrics.csv) and [Product Snapshots.csv](templates/Product%20Snapshots.csv) as two worksheets in one Google spreadsheet.
3. Configure `spreadsheet_id`, `keywords`, and `brand_aliases` or exact Google `product_ids` in **Settings**.
4. Select Thordata credentials on **Thordata Google Shopping** and Google Sheets OAuth2 credentials on all four Sheets nodes.
5. AI and Slack both default to `true`. Configure their credentials and the Slack channel, or explicitly set `enable_ai=false` and `enable_slack=false` for a metrics-only first test. Run one keyword manually.
6. Open **Show Shopping Report** and check the saved worksheet rows. A second run can compare against the first complete snapshot.
7. For AI, select a model ID and OpenAI credential on **OpenAI Chat Model**. For Slack, select the credential on **Send Shopping Alert** and set `slack_channel`. Setting `enable_slack=true` does not send a routine first-baseline message; event thresholds and operational issues still control delivery.
8. Enable the schedule after successful manual testing. The default is daily at 09:00 Asia/Shanghai.

## Matching and pricing

Exact Google product IDs are the most precise target definition. Brand aliases match literal text at letter/number boundaries in product titles; accessories can mention a brand, so title matches are not proof of brand ownership. The `source` field names a merchant and is never used as the product brand. Keep long product IDs as strings.

Numeric price comparisons currently support unambiguous USD prices in US results. Other price strings remain visible without inferred amounts or currencies. Comparisons require the same product ID, merchant, and currency; a missing price is not zero. Returned product links may point to Google.

Reports explicitly identify unsupported price-monitoring markets. A best position beyond the requested Top N is labeled `outside Top N shelf`; it remains the best position across all returned first-page cards. Price changes of at least 1,000% are flagged for source verification without changing the values or alert decisions.

## Limits and failure behavior

The workflow makes one first-page request per unique keyword, with at most 20 configured keywords. It does not paginate or classify cards as organic/paid. In the development samples, each search returned 40 cards and reported two credits; actual response sizes and charges may differ. API-reported credits are shown when available.

History-read failure stops before paid searches. Failed, empty, partial, and invalid collections remain distinct. AI errors preserve a deterministic report. Failed/unconfirmed saves produce a report and a failed execution, rather than a false success. Slack is optional; a Slack send error fails the execution after any earlier successful saves.

Only one execution should run at a time for the same workflow. New executions preserve new observations; retries within an execution use stable row IDs. Archive old snapshots intentionally and keep matching keyword/product records together.

## Put your monitoring to work

- **For ecommerce teams:** track how your products appear across selected Shopping keywords and spot changes worth investigating.
- **For pricing teams:** review comparable US/USD offers alongside competing products, with historical snapshots for context.
- **For agencies and analysts:** use the HTML report, Markdown, and Slack text to make findings easier to share with stakeholders.
- **For automation teams:** connect Thordata data collection with n8n reporting and Google Sheets history in a repeatable process.

Start with one keyword, validate your target matching, and build a monitoring routine around the questions your team needs answered. Follow the [setup guide](docs/SETUP.md) to configure your first run.

## More Thordata resources

The same Thordata credential can power more of your commerce and search workflows:

- [Thordata SERP API on n8n](https://www.thordata.com/products/serp-api/n8n-integration?op=cianna&from=n8n) — the integration guide this workflow builds on, with setup details and more n8n examples.
- [Thordata SERP API MCP Server](https://www.thordata.com/products/serp-api/mcp-server?op=cianna&from=mcp) — bring live Google, Bing and DuckDuckGo search directly into Claude, Cursor or any MCP-compatible AI assistant.
- [Thordata documentation](https://doc.thordata.com/doc) — full API reference, including Google Shopping parameters and the `statistics` endpoint for tracking your credits.

## Development

Node.js >=20 is required for the build and unit tests. Run from this directory:

```powershell
npm run build
npm test
npm run validate
npm run test:runtime
```

The generated JSON contains its runtime code and requires no project files after import. Runtime verification uses isolated n8n state, fixture-backed service responses, and blocked networking. See [Validation](docs/VALIDATION.md) for actual results and the scope of verification.

## License

MIT — see [LICENSE](./LICENSE).
