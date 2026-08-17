-- Radar x EVSTOCK Entry / Exit Engine
alter table public.radar_alerts
  add column if not exists breakout_entry_price numeric(18,4),
  add column if not exists base_target_price numeric(18,4),
  add column if not exists take_profit_1_price numeric(18,4),
  add column if not exists take_profit_1_pct numeric(8,4),
  add column if not exists take_profit_2_price numeric(18,4),
  add column if not exists take_profit_2_pct numeric(8,4),
  add column if not exists core_hold_rule text,
  add column if not exists trade_plan_notes text,
  add column if not exists risk_reward_ratio numeric(10,4),
  add column if not exists trade_plan_updated_at timestamptz;

create or replace function public.save_radar_trade_plan(p_user_email text, p_ticker text, p_plan jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user_id uuid; v_alert_id uuid;
begin
  select id into v_user_id from auth.users where lower(email)=lower(p_user_email) limit 1;
  if v_user_id is null then raise exception 'User not found for email %', p_user_email; end if;
  select id into v_alert_id from public.radar_alerts where user_id=v_user_id and upper(ticker)=upper(p_ticker) order by alert_time desc limit 1;
  if v_alert_id is null then raise exception 'No radar alert found for ticker %', p_ticker; end if;
  update public.radar_alerts set
    preferred_entry_price=nullif(p_plan->>'preferred_entry_price','')::numeric,
    entry_zone_low=nullif(p_plan->>'entry_zone_low','')::numeric,
    entry_zone_high=nullif(p_plan->>'entry_zone_high','')::numeric,
    breakout_entry_price=nullif(p_plan->>'breakout_entry_price','')::numeric,
    base_target_price=nullif(p_plan->>'base_target_price','')::numeric,
    take_profit_1_price=nullif(p_plan->>'take_profit_1_price','')::numeric,
    take_profit_1_pct=nullif(p_plan->>'take_profit_1_pct','')::numeric,
    take_profit_2_price=nullif(p_plan->>'take_profit_2_price','')::numeric,
    take_profit_2_pct=nullif(p_plan->>'take_profit_2_pct','')::numeric,
    initial_position_pct=nullif(p_plan->>'initial_position_pct','')::numeric,
    max_position_pct=nullif(p_plan->>'max_position_pct','')::numeric,
    add_on_trigger=p_plan->>'add_on_trigger',
    stop_or_thesis_exit=p_plan->>'stop_or_thesis_exit',
    max_acceptable_loss_pct=nullif(p_plan->>'max_acceptable_loss_pct','')::numeric,
    core_hold_rule=p_plan->>'core_hold_rule',
    trade_plan_notes=p_plan->>'trade_plan_notes',
    risk_reward_ratio=nullif(p_plan->>'risk_reward_ratio','')::numeric,
    trade_plan_updated_at=now(),updated_at=now()
  where id=v_alert_id;
  return v_alert_id;
end;
$$;