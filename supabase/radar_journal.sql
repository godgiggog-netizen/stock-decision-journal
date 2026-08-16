-- Stock Radar Alert Journal v1
-- Adds alert, follow-up, decision and learning records alongside the existing Stock Decision Journal.
-- Run in Supabase SQL Editor after supabase/schema.sql.

create type public.radar_stage as enum ('EARLY', 'CONFIRMED', 'CROWDED');
create type public.radar_verdict as enum ('EARLY RADAR', 'WATCH', 'HIGH PRIORITY', 'MATERIAL CHANGE');
create type public.entry_status as enum ('BUY ZONE', 'WAIT FOR PULLBACK', 'WAIT FOR CONFIRMATION', 'EXTENDED', 'CROWDED', 'AVOID');
create type public.radar_action as enum ('WATCH', 'BUY', 'ADD', 'HOLD', 'REDUCE', 'SELL', 'IGNORE');
create type public.radar_thesis_direction as enum ('STRONGER', 'UNCHANGED', 'WEAKER');
create type public.alert_timing as enum ('EARLY', 'GOOD', 'LATE', 'TOO LATE');
create type public.signal_quality as enum ('EXCELLENT', 'GOOD', 'NOISY', 'FALSE POSITIVE');
create type public.final_outcome as enum ('BIG WINNER', 'WINNER', 'NEUTRAL', 'LOSER', 'FALSE POSITIVE', 'MISSED OPPORTUNITY');

create table public.radar_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  alert_time timestamptz not null default now(),
  ticker text not null,
  company text,
  sector text,
  theme text,
  stage public.radar_stage not null,
  verdict public.radar_verdict not null,
  radar_score numeric(5,2) not null check (radar_score between 0 and 100),

  what_changed text not null,
  story text,
  previous_narrative text,
  emerging_narrative text,
  catalyst text,
  next_catalyst text,
  next_catalyst_date date,

  fact_summary text,
  analysis_summary text,
  expectation_summary text,
  evidence_summary text,
  evidence_urls jsonb not null default '[]'::jsonb,

  revenue numeric(20,2),
  revenue_growth_pct numeric(10,4),
  gross_margin_pct numeric(10,4),
  operating_margin_pct numeric(10,4),
  adjusted_ebitda numeric(20,2),
  free_cash_flow numeric(20,2),
  cash numeric(20,2),
  debt numeric(20,2),
  backlog_or_contracted_revenue numeric(20,2),
  arr numeric(20,2),
  shares_outstanding numeric(20,2),
  dilution_notes text,

  price_at_alert numeric(18,4),
  one_day_change_pct numeric(10,4),
  five_day_change_pct numeric(10,4),
  one_month_change_pct numeric(10,4),
  distance_from_52w_high_pct numeric(10,4),
  above_20dma boolean,
  above_50dma boolean,
  above_200dma boolean,
  volume_vs_average numeric(10,4),
  relative_strength_notes text,
  earnings_revision_notes text,

  market_expectation text,
  actual_development text,
  expectation_gap text check (expectation_gap in ('POSITIVE','NEUTRAL','NEGATIVE') or expectation_gap is null),

  bull_case text,
  bear_case text,
  thesis_breakers jsonb not null default '[]'::jsonb,
  bull_triggers jsonb not null default '[]'::jsonb,
  key_trigger text,
  key_trigger_date date,

  valuation_risk smallint check (valuation_risk between 1 and 5),
  execution_risk smallint check (execution_risk between 1 and 5),
  dilution_risk smallint check (dilution_risk between 1 and 5),
  debt_risk smallint check (debt_risk between 1 and 5),
  customer_concentration_risk smallint check (customer_concentration_risk between 1 and 5),
  competition_risk smallint check (competition_risk between 1 and 5),
  regulatory_risk smallint check (regulatory_risk between 1 and 5),
  macro_risk smallint check (macro_risk between 1 and 5),
  primary_risk text,

  score_fundamental_change numeric(5,2) check (score_fundamental_change between 0 and 20),
  score_catalyst numeric(5,2) check (score_catalyst between 0 and 20),
  score_evidence numeric(5,2) check (score_evidence between 0 and 15),
  score_earnings_revision numeric(5,2) check (score_earnings_revision between 0 and 15),
  score_price_momentum numeric(5,2) check (score_price_momentum between 0 and 10),
  score_volume_attention numeric(5,2) check (score_volume_attention between 0 and 10),
  score_risk_reward numeric(5,2) check (score_risk_reward between 0 and 10),

  business_quality text check (business_quality in ('WEAK','IMPROVING','STRONG') or business_quality is null),
  thesis_direction public.radar_thesis_direction not null default 'UNCHANGED',
  entry_status public.entry_status,
  entry_reason text,
  preferred_entry_price numeric(18,4),
  entry_zone_low numeric(18,4),
  entry_zone_high numeric(18,4),
  initial_position_pct numeric(8,4),
  max_position_pct numeric(8,4),
  add_on_trigger text,
  stop_or_thesis_exit text,
  max_acceptable_loss_pct numeric(8,4),

  current_action public.radar_action not null default 'WATCH',
  decision_date timestamptz,
  decision_price numeric(18,4),
  decision_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, alert_key)
);

create table public.radar_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.radar_alerts(id) on delete cascade,
  checkpoint_days integer not null check (checkpoint_days in (1,7,30,90)),
  checkpoint_date date not null,
  observed_at timestamptz,
  price numeric(18,4),
  return_since_alert_pct numeric(10,4),
  max_gain_pct numeric(10,4),
  max_drawdown_pct numeric(10,4),
  new_information text,
  thesis_direction public.radar_thesis_direction,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_id, checkpoint_days)
);

create table public.radar_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null unique references public.radar_alerts(id) on delete cascade,
  alert_timing public.alert_timing,
  signal_quality public.signal_quality,
  story_priced_in text check (story_priced_in in ('YES','PARTLY','NO') or story_priced_in is null),
  entry_attractive boolean,
  fundamental_thesis_improved boolean,
  missed_information text,
  noisy_signals text,
  useful_signals text,
  radar_got_right text,
  radar_got_wrong text,
  investor_got_right text,
  investor_got_wrong text,
  final_classification public.final_outcome,
  final_return_pct numeric(10,4),
  holding_period_days integer,
  final_thesis_result text,
  one_line_lesson text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index radar_alerts_user_time_idx on public.radar_alerts(user_id, alert_time desc);
create index radar_alerts_ticker_idx on public.radar_alerts(user_id, ticker, alert_time desc);
create index radar_alerts_score_idx on public.radar_alerts(user_id, radar_score desc);
create index radar_followups_due_idx on public.radar_followups(user_id, completed, checkpoint_date);

alter table public.radar_alerts enable row level security;
alter table public.radar_followups enable row level security;
alter table public.radar_reviews enable row level security;

create policy "radar_alerts_owner_all" on public.radar_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "radar_followups_owner_all" on public.radar_followups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "radar_reviews_owner_all" on public.radar_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Automatically seed +1/+7/+30/+90 day checkpoints after every alert.
create or replace function public.seed_radar_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.radar_followups (user_id, alert_id, checkpoint_days, checkpoint_date)
  values
    (new.user_id, new.id, 1,  (new.alert_time at time zone 'Asia/Bangkok')::date + 1),
    (new.user_id, new.id, 7,  (new.alert_time at time zone 'Asia/Bangkok')::date + 7),
    (new.user_id, new.id, 30, (new.alert_time at time zone 'Asia/Bangkok')::date + 30),
    (new.user_id, new.id, 90, (new.alert_time at time zone 'Asia/Bangkok')::date + 90)
  on conflict (alert_id, checkpoint_days) do nothing;
  return new;
end;
$$;

create trigger seed_radar_followups_after_alert
  after insert on public.radar_alerts
  for each row execute function public.seed_radar_followups();
