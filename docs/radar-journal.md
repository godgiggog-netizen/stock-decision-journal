# Stock Radar Alert Journal

This module turns US Emerging Stock Opportunity Radar alerts into a decision and learning dataset.

## Goal

For every meaningful alert, preserve the information that existed at alert time, separate discovery from entry timing, and measure whether the signal was early, useful, late, noisy, or wrong.

## Core record

Each alert stores:

- Identity: alert key, time, ticker, company, sector/theme
- Stage: EARLY / CONFIRMED / CROWDED
- Radar score and score breakdown
- What Changed
- FACT / ANALYSIS / EXPECTATION
- Story and narrative shift
- Current and next catalyst
- Evidence and source URLs
- Financial and business metrics
- Price, trend, volume and earnings revision context at alert time
- Expectation Gap
- Bull case / Bear case / Thesis breakers
- Risk scores
- Entry status and entry plan
- User decision

## Key design rule

Radar quality and entry quality are separate.

A 90/100 company can still be `EXTENDED` or `WAIT FOR PULLBACK`. The journal must preserve both states independently.

## Automatic follow-ups

Every inserted alert automatically creates four checkpoints:

- +1 day
- +7 days
- +30 days
- +90 days

Each checkpoint should store:

- market price
- return since alert
- maximum gain
- maximum drawdown
- new material information
- thesis direction: STRONGER / UNCHANGED / WEAKER

The database trigger creates the checkpoint rows. A scheduled worker or review process still needs to populate market data at the due dates.

## Learning review

After enough evidence exists, each alert receives a quality review:

- Alert timing: EARLY / GOOD / LATE / TOO LATE
- Signal quality: EXCELLENT / GOOD / NOISY / FALSE POSITIVE
- Was the story already priced in?
- Was entry attractive at alert time?
- Did the fundamental thesis improve?
- What information was missed?
- What signals were noisy?
- What signals were useful?
- What the radar got right/wrong
- What the investor got right/wrong
- Final outcome and one-line lesson

## Recommended alert key

Use a deterministic identifier such as:

`YYYYMMDD-TICKER-01`

If the same ticker gets a second genuinely new material alert on the same day, increment the suffix.

## Proposed workflow

1. Radar discovers a new >=80 score alert or material watchlist change.
2. Create one `radar_alerts` record immediately using only information known at that time.
3. Do not overwrite old alert facts when the story changes later.
4. The trigger creates +1/+7/+30/+90 follow-up rows.
5. Update only the relevant follow-up row at each checkpoint.
6. Record the investor decision separately from the radar verdict.
7. Complete `radar_reviews` once enough evidence exists.
8. Use accumulated reviews to evaluate scoring weights. Do not silently rewrite historical scores.

## Database installation

Run the existing `supabase/schema.sql` first, then run:

`supabase/radar_journal.sql`

The Radar Journal tables use the same authenticated-user ownership model and Row Level Security pattern as the Stock Decision Journal.

## Next implementation layer

The next UI should add two main views:

1. **Radar Alerts** dashboard showing score, stage, entry status, latest thesis direction and next due follow-up.
2. **Alert Detail** page showing the original alert snapshot, decision, checkpoints and final learning review.

For full automation, a scheduled worker needs a reliable market-data source to fill checkpoint prices and calculate return, max gain and max drawdown. The database structure is ready for that layer.
