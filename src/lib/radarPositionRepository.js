import { supabase } from './supabase';

const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
};

export async function listRadarPositions() {
  const { data, error } = await supabase
    .from('positions')
    .select('id,ticker,company,buy_date,entry_price,amount_invested,pending_buy_price,pending_buy_amount,current_decision,current_thesis_status,closed_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    ticker: row.ticker,
    company: row.company || '',
    buyDate: row.buy_date,
    entryPrice: Number(row.entry_price),
    amount: Number(row.amount_invested),
    shares: Number(row.amount_invested) / Number(row.entry_price),
    pendingBuyPrice: row.pending_buy_price == null ? null : Number(row.pending_buy_price),
    pendingBuyAmount: row.pending_buy_amount == null ? null : Number(row.pending_buy_amount),
    decision: row.current_decision,
    thesisStatus: row.current_thesis_status,
    closedAt: row.closed_at || null,
  }));
}

export async function createRadarPosition(userId, alert, input) {
  const reviewDays = 30;
  const { data: position, error: positionError } = await supabase.from('positions').insert({
    user_id: userId,
    ticker: alert.ticker,
    company: alert.company || null,
    buy_date: input.buyDate,
    entry_price: input.entryPrice,
    amount_invested: input.amount,
    pending_buy_price: input.pendingBuyPrice || null,
    pending_buy_amount: input.pendingBuyAmount || null,
    target_price: alert.base_target_price || alert.take_profit_1_price || null,
    time_horizon: 'Radar position',
    review_interval_days: reviewDays,
    current_decision: 'HOLD',
    current_thesis_status: 'VALID',
    next_review_date: addDays(input.buyDate, reviewDays),
  }).select().single();
  if (positionError) throw positionError;

  const { data: thesis, error: thesisError } = await supabase.from('theses').insert({
    user_id: userId,
    position_id: position.id,
  }).select().single();
  if (thesisError) throw thesisError;

  const thesisText = alert.story || alert.what_changed || `Radar thesis for ${alert.ticker}`;
  const expectedOutcome = alert.key_trigger || alert.bull_case || null;
  const breakCondition = alert.stop_or_thesis_exit || alert.primary_risk || alert.bear_case || 'ทบทวนเมื่อ Thesis อ่อนลงอย่างมีนัยสำคัญ';

  const { error: versionError } = await supabase.from('thesis_versions').insert({
    thesis_id: thesis.id,
    version_number: 1,
    thesis_text: thesisText,
    expected_outcome: expectedOutcome,
  });
  if (versionError) throw versionError;

  const { error: breakError } = await supabase.from('break_conditions').insert({
    thesis_id: thesis.id,
    condition_text: breakCondition,
  });
  if (breakError) throw breakError;

  const { error: decisionError } = await supabase.from('decisions').insert({
    user_id: userId,
    position_id: position.id,
    decision: 'HOLD',
    rationale: `Position opened from Radar alert ${alert.id || alert.ticker}`,
  });
  if (decisionError) throw decisionError;

  return position.id;
}
