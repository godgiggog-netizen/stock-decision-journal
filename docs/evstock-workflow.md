# EVSTOCK Workflow V1

## Goal

Turn a single command such as `Evstock HIVE USD` into an evidence-backed snapshot that flows through:

`Research -> Valuation -> Technical/Entry -> DEEP -> Decision Card -> EVSTOCK Snapshot -> Radar Journal -> +1/+7/+30/+90 learning`

The workflow deliberately keeps company quality separate from entry quality. A strong company can still be `EXTENDED`, `CROWDED`, or `WAIT FOR PULLBACK`.

## Architecture

1. `evstock.html` is a dedicated Vite page.
2. `src/EvstockWorkflow.jsx` accepts the command and invokes the Supabase Edge Function.
3. `supabase/functions/evstock/index.ts` calls the OpenAI Responses API with built-in web search and a strict JSON schema.
4. `supabase/evstock_workflow.sql` stores immutable EVSTOCK snapshots.
5. `src/evstockEngine.js` maps the structured report into the existing `radar_alerts` model.
6. The existing Radar Journal trigger automatically seeds +1/+7/+30/+90 checkpoints after a report is sent to Radar.

## Safety and evidence rules

- Prefer SEC filings and company Investor Relations for financial facts.
- Use reputable market/news sources for current price and developments.
- Never invent a number. Unverified values must be `null`.
- Keep the source URL and source date in every report.
- Do not overwrite old EVSTOCK runs. New analysis creates a new snapshot.
- Entry, stop and target are decision support, not guaranteed outcomes.

## One-time setup

Run these SQL files in order:

```sql
-- Existing
supabase/schema.sql
supabase/radar_journal.sql

-- New
supabase/evstock_workflow.sql
```

Deploy the Edge Function and set secrets:

```bash
supabase functions deploy evstock
supabase secrets set OPENAI_API_KEY=YOUR_KEY
# Optional. The function defaults to gpt-5.6-terra.
supabase secrets set OPENAI_MODEL=gpt-5.6-terra
```

The frontend still uses the existing variables:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Run locally

```bash
npm install
npm run dev
```

Open `/evstock.html`, sign in to the main Stock Decision Journal on the same origin, then run:

```text
Evstock HIVE USD
```

## Output

The V1 decision card shows:

- current reference price and as-of time
- narrative and what changed
- bear/base/bull valuation and fair-value range
- DEEP scores: Demand, Economics, Execution, Price
- action and entry status
- preferred entry zone
- target price
- position-size guidance
- add trigger
- thesis-based exit
- confidence
- evidence URLs

Two explicit save actions are available:

1. **Save EVSTOCK Snapshot** stores the complete structured report in `evstock_runs`.
2. **Send to Radar Journal** converts the report to `radar_alerts`, after which the existing follow-up trigger creates +1/+7/+30/+90 checkpoints automatically.

## V1 boundary

The workflow does not execute trades. It creates research and decision records. Live brokerage execution should remain a separate, explicitly authorized layer.
