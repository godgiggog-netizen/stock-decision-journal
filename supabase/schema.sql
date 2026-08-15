-- Stock Decision Journal v0.2
-- Run this in the Supabase SQL editor for a new project.

create extension if not exists pgcrypto;

create type public.thesis_status as enum ('STRENGTHENING', 'VALID', 'WEAKENING', 'BROKEN');
create type public.investment_decision as enum ('BUY MORE', 'HOLD', 'REDUCE', 'EXIT');

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company text,
  buy_date date not null,
  entry_price numeric(18,4) not null check (entry_price >= 0),
  amount_invested numeric(18,2) not null check (amount_invested >= 0),
  target_price numeric(18,4),
  time_horizon text,
  review_interval_days integer not null default 30 check (review_interval_days > 0),
  current_decision public.investment_decision not null default 'HOLD',
  current_thesis_status public.thesis_status not null default 'VALID',
  next_review_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid not null unique references public.positions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.thesis_versions (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.theses(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  thesis_text text not null,
  expected_outcome text,
  reason_for_change text,
  created_at timestamptz not null default now(),
  unique (thesis_id, version_number)
);

create table public.break_conditions (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.theses(id) on delete cascade,
  condition_text text not null,
  is_triggered boolean not null default false,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  review_date date not null default current_date,
  what_changed text not null,
  thesis_status public.thesis_status not null,
  downside_risk text,
  would_buy_today text,
  evidence_for text,
  evidence_against text,
  what_would_change_my_mind text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete set null,
  decision public.investment_decision not null,
  rationale text,
  created_at timestamptz not null default now()
);

create index positions_user_id_idx on public.positions(user_id);
create index reviews_position_id_idx on public.reviews(position_id, review_date desc);
create index thesis_versions_thesis_id_idx on public.thesis_versions(thesis_id, version_number desc);

alter table public.positions enable row level security;
alter table public.theses enable row level security;
alter table public.thesis_versions enable row level security;
alter table public.break_conditions enable row level security;
alter table public.reviews enable row level security;
alter table public.decisions enable row level security;

create policy "positions_owner_all" on public.positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "theses_owner_all" on public.theses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "thesis_versions_owner_all" on public.thesis_versions
  for all using (
    exists (
      select 1 from public.theses t
      where t.id = thesis_versions.thesis_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.theses t
      where t.id = thesis_versions.thesis_id and t.user_id = auth.uid()
    )
  );

create policy "break_conditions_owner_all" on public.break_conditions
  for all using (
    exists (
      select 1 from public.theses t
      where t.id = break_conditions.thesis_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.theses t
      where t.id = break_conditions.thesis_id and t.user_id = auth.uid()
    )
  );

create policy "reviews_owner_all" on public.reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "decisions_owner_all" on public.decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Thesis history is intentionally append-only. Client apps should INSERT a new
-- thesis_versions row instead of updating an old one.
revoke update, delete on public.thesis_versions from authenticated;
