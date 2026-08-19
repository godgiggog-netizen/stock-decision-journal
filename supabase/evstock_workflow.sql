-- EVSTOCK Workflow V1
-- Run after supabase/schema.sql and supabase/radar_journal.sql.

create table if not exists public.evstock_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  currency text not null default 'USD',
  status text not null default 'COMPLETED' check (status in ('COMPLETED','FAILED','PARTIAL')),
  model text,
  as_of timestamptz not null default now(),
  report_json jsonb not null default '{}'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  linked_radar_alert_id uuid references public.radar_alerts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists evstock_runs_user_ticker_idx
  on public.evstock_runs(user_id, ticker, created_at desc);

alter table public.evstock_runs enable row level security;

grant select, insert, update, delete on public.evstock_runs to authenticated;

drop policy if exists "evstock_runs_owner_all" on public.evstock_runs;
create policy "evstock_runs_owner_all" on public.evstock_runs
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.evstock_runs is
  'Immutable snapshots produced by the EVSTOCK research workflow. Keep historical runs instead of overwriting them.';
