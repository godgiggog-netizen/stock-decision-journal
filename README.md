# Stock Decision Journal

A decision-memory app for long-term investors. It records why a position was opened, what would invalidate the thesis, how the thesis changes over time, and what decision followed each review.

## v0.2 architecture

- React + Vite frontend
- Supabase Auth + PostgreSQL
- Row Level Security for per-user data isolation
- Append-only thesis version history
- Structured 30/60/90-day review records

## Core model

`Position -> Thesis -> Thesis Versions -> Break Conditions -> Reviews -> Decisions`

A thesis version is never overwritten. When a thesis changes, insert a new row in `thesis_versions` with the next `version_number` and a reason for change.

## Stock Radar Alert Journal

The repository now also contains the data layer for the US Emerging Stock Opportunity Radar.

Core flow:

`Radar Alert -> Entry Decision -> +1/+7/+30/+90 Follow-ups -> Alert Quality Review -> Learning`

The Radar Journal deliberately separates **company/opportunity quality** from **entry quality**. A high-scoring alert can still be marked `EXTENDED`, `CROWDED`, `WAIT FOR PULLBACK`, or `AVOID`.

Install it after the main schema:

```sql
-- First run supabase/schema.sql
-- Then run supabase/radar_journal.sql
```

Every new radar alert automatically seeds +1, +7, +30 and +90 day follow-up rows. See `docs/radar-journal.md` for the complete workflow and data dictionary.

## Current app state

The UI is runnable now with Supabase-backed authentication and repository access when environment variables are configured. When Supabase is not configured, the app falls back to browser LocalStorage for prototype use.

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a new Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Run `supabase/radar_journal.sql` to enable Radar Journal records.
4. Copy `.env.example` to `.env.local`.
5. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Start the app with `npm run dev`.

## Thesis states

- `STRENGTHENING`
- `VALID`
- `WEAKENING`
- `BROKEN`

## Decision states

- `BUY MORE`
- `HOLD`
- `REDUCE`
- `EXIT`

## Product rules

> Never rewrite the old thesis. Add a new thesis version.

> Never rewrite an old radar alert with hindsight. Follow-up evidence belongs in checkpoint or review records.
