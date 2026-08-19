# EVSTOCK Workflow V1B

## Goal

Turn an EVSTOCK analysis produced in ChatGPT/Codex into an evidence-backed snapshot that flows through:

`ChatGPT/Codex Research -> EVSTOCK JSON -> Stock Decision Journal -> Radar Journal -> +1/+7/+30/+90 learning`

This version intentionally does not call the OpenAI API from Supabase. It is designed for users who already use ChatGPT/Codex and do not want separate API billing.

## Architecture

1. Run a normal command in ChatGPT/Codex, for example `Evstock HIVE USD`.
2. Ask for the result as EVSTOCK JSON.
3. Open `/evstock.html` and paste the JSON into the import box.
4. `src/EvstockWorkflow.jsx` validates and previews the report.
5. `supabase/evstock_workflow.sql` stores immutable EVSTOCK snapshots.
6. `src/evstockEngine.js` maps the structured report into the existing `radar_alerts` model.
7. The existing Radar Journal trigger seeds +1/+7/+30/+90 checkpoints after the report is sent to Radar.

## Why V1B

ChatGPT subscriptions and OpenAI API billing are separate. V1B removes the paid server-side API dependency from the Journal. Research happens in ChatGPT/Codex, while Supabase is used only for storage, history and follow-up records.

## Safety and evidence rules

- Prefer SEC filings and company Investor Relations for financial facts.
- Use reputable market/news sources for current price and developments.
- Never invent a number. Unverified values should be `null`.
- Preserve source URLs and source dates in the imported report.
- Do not overwrite old EVSTOCK runs. New analysis creates a new snapshot.
- Keep company quality separate from entry quality.
- Entry, stop and target are decision support, not guaranteed outcomes.

## One-time setup

The existing Journal schema and Radar Journal must be installed first. Then run:

```sql
supabase/evstock_workflow.sql
```

No OpenAI API key and no EVSTOCK Edge Function are required for V1B.

The frontend still uses the existing Supabase variables:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Daily use

In ChatGPT/Codex:

```text
Evstock HIVE USD

ส่งผลลัพธ์เป็น EVSTOCK JSON สำหรับนำเข้า Stock Decision Journal โดยต้องมีอย่างน้อย:
ticker, company, currency, as_of, status, model, summary, narrative, what_changed,
market, valuation, deep, radar, decision, bull_case, bear_case, thesis_breakers, sources
```

Then open `/evstock.html`, paste the JSON, review the Decision Card, and choose one or both actions:

1. **บันทึก EVSTOCK Snapshot** stores the complete report in `evstock_runs`.
2. **ส่งเข้า Radar Journal** converts the report to `radar_alerts`, then the existing trigger creates +1/+7/+30/+90 checkpoints.

## Output

The decision card shows current reference price, narrative, valuation range, bear/base/bull values, DEEP scores, action, entry zone, target, thesis exit, confidence and evidence URLs when supplied in the imported JSON.

## Boundary

The workflow does not execute trades. It creates research and decision records. Brokerage execution remains a separate explicitly authorized layer.
