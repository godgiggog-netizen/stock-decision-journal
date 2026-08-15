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

## Current app state

The UI is runnable now and still stores prototype data in browser LocalStorage. The Supabase client and production database schema are already in the repository, so the next step is to add authentication and replace LocalStorage reads/writes with Supabase data access.

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a new Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Start the app with `npm run dev`.

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

## Product rule

> Never rewrite the old thesis. Add a new thesis version.
