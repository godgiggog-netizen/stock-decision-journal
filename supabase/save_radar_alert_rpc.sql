-- Safe write path for Stock Radar alerts.
-- Use public.save_radar_alert(email, jsonb) instead of raw INSERT/UPDATE from automation.

create or replace function public.save_radar_alert(p_user_email text, p_alert jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_alert_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(p_user_email)
  limit 1;

  if v_user_id is null then
    raise exception 'User not found for email %', p_user_email;
  end if;

  insert into public.radar_alerts (
    user_id, alert_key, alert_time, ticker, company, sector, theme, stage, verdict, radar_score,
    what_changed, story, previous_narrative, emerging_narrative, catalyst, next_catalyst, next_catalyst_date,
    fact_summary, analysis_summary, expectation_summary, evidence_summary, evidence_urls,
    market_expectation, actual_development, expectation_gap,
    bull_case, bear_case, thesis_breakers, bull_triggers, key_trigger, key_trigger_date,
    primary_risk,
    score_fundamental_change, score_catalyst, score_evidence, score_earnings_revision,
    score_price_momentum, score_volume_attention, score_risk_reward,
    business_quality, thesis_direction, entry_status, entry_reason,
    price_at_alert, current_action
  ) values (
    v_user_id,
    p_alert->>'alert_key',
    coalesce((p_alert->>'alert_time')::timestamptz, now()),
    upper(p_alert->>'ticker'),
    p_alert->>'company',
    p_alert->>'sector',
    p_alert->>'theme',
    (p_alert->>'stage')::public.radar_stage,
    (p_alert->>'verdict')::public.radar_verdict,
    (p_alert->>'radar_score')::numeric,
    p_alert->>'what_changed',
    p_alert->>'story',
    p_alert->>'previous_narrative',
    p_alert->>'emerging_narrative',
    p_alert->>'catalyst',
    p_alert->>'next_catalyst',
    nullif(p_alert->>'next_catalyst_date','')::date,
    p_alert->>'fact_summary',
    p_alert->>'analysis_summary',
    p_alert->>'expectation_summary',
    p_alert->>'evidence_summary',
    coalesce(p_alert->'evidence_urls','[]'::jsonb),
    p_alert->>'market_expectation',
    p_alert->>'actual_development',
    nullif(p_alert->>'expectation_gap',''),
    p_alert->>'bull_case',
    p_alert->>'bear_case',
    coalesce(p_alert->'thesis_breakers','[]'::jsonb),
    coalesce(p_alert->'bull_triggers','[]'::jsonb),
    p_alert->>'key_trigger',
    nullif(p_alert->>'key_trigger_date','')::date,
    p_alert->>'primary_risk',
    nullif(p_alert->>'score_fundamental_change','')::numeric,
    nullif(p_alert->>'score_catalyst','')::numeric,
    nullif(p_alert->>'score_evidence','')::numeric,
    nullif(p_alert->>'score_earnings_revision','')::numeric,
    nullif(p_alert->>'score_price_momentum','')::numeric,
    nullif(p_alert->>'score_volume_attention','')::numeric,
    nullif(p_alert->>'score_risk_reward','')::numeric,
    nullif(p_alert->>'business_quality',''),
    coalesce(nullif(p_alert->>'thesis_direction',''),'UNCHANGED')::public.radar_thesis_direction,
    nullif(p_alert->>'entry_status','')::public.entry_status,
    p_alert->>'entry_reason',
    nullif(p_alert->>'price_at_alert','')::numeric,
    coalesce(nullif(p_alert->>'current_action',''),'WATCH')::public.radar_action
  )
  on conflict (user_id, alert_key) do nothing
  returning id into v_alert_id;

  if v_alert_id is null then
    select id into v_alert_id
    from public.radar_alerts
    where user_id = v_user_id and alert_key = p_alert->>'alert_key';
  end if;

  return v_alert_id;
end;
$$;

revoke all on function public.save_radar_alert(text, jsonb) from public;
grant execute on function public.save_radar_alert(text, jsonb) to service_role;
