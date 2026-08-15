import { supabase } from './supabase';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
};

const mapPosition = (row) => {
  const thesis = row.theses?.[0];
  const versions = [...(thesis?.thesis_versions || [])].sort((a,b) => b.version_number - a.version_number);
  const reviews = [...(row.reviews || [])].sort((a,b) => String(b.review_date).localeCompare(String(a.review_date)));
  return {
    id: row.id,
    ticker: row.ticker,
    company: row.company || '',
    buyDate: row.buy_date,
    entryPrice: Number(row.entry_price),
    amount: Number(row.amount_invested),
    horizon: row.time_horizon || '',
    reviewPlan: row.review_interval_days,
    target: row.target_price == null ? null : Number(row.target_price),
    thesisStatus: row.current_thesis_status,
    decision: row.current_decision,
    nextReview: row.next_review_date,
    thesisId: thesis?.id || null,
    thesis: versions[0]?.thesis_text || '',
    expected: versions[0]?.expected_outcome || '',
    breakCondition: thesis?.break_conditions?.[0]?.condition_text || '',
    reviews: reviews.map((r) => ({
      id: r.id,
      date: r.review_date,
      changed: r.what_changed,
      thesisStatus: r.thesis_status,
      risk: r.downside_risk || '',
      buyAgain: r.would_buy_today || '',
      evidenceFor: r.evidence_for || '',
      evidenceAgainst: r.evidence_against || '',
      changeMind: r.what_would_change_my_mind || '',
      notes: r.notes || '',
      decision: r.decisions?.[0]?.decision || row.current_decision,
    })),
  };
};

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function listPositions() {
  const { data, error } = await supabase.from('positions').select(`
    *,
    theses(
      id,
      thesis_versions(id, version_number, thesis_text, expected_outcome, created_at),
      break_conditions(id, condition_text, is_triggered, triggered_at)
    ),
    reviews(
      id, review_date, what_changed, thesis_status, downside_risk,
      would_buy_today, evidence_for, evidence_against, what_would_change_my_mind,
      notes, created_at,
      decisions(id, decision, rationale, created_at)
    )
  `).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPosition);
}

export async function createPosition(userId, input) {
  const { data: position, error: positionError } = await supabase.from('positions').insert({
    user_id: userId,
    ticker: input.ticker,
    company: input.company || null,
    buy_date: input.buyDate,
    entry_price: input.entryPrice,
    amount_invested: input.amount,
    target_price: input.target,
    time_horizon: input.horizon || null,
    review_interval_days: input.reviewPlan,
    current_decision: 'HOLD',
    current_thesis_status: 'VALID',
    next_review_date: addDays(input.buyDate, input.reviewPlan),
  }).select().single();
  if (positionError) throw positionError;

  const { data: thesis, error: thesisError } = await supabase.from('theses').insert({ user_id: userId, position_id: position.id }).select().single();
  if (thesisError) throw thesisError;
  const { error: versionError } = await supabase.from('thesis_versions').insert({ thesis_id: thesis.id, version_number: 1, thesis_text: input.thesis, expected_outcome: input.expected || null });
  if (versionError) throw versionError;
  const { error: breakError } = await supabase.from('break_conditions').insert({ thesis_id: thesis.id, condition_text: input.breakCondition });
  if (breakError) throw breakError;
  const { error: decisionError } = await supabase.from('decisions').insert({ user_id: userId, position_id: position.id, decision: 'HOLD', rationale: 'Initial position recorded' });
  if (decisionError) throw decisionError;
  return position.id;
}

export async function createReview(userId, position, review) {
  const reviewDate = todayISO();
  const { data: saved, error: reviewError } = await supabase.from('reviews').insert({
    user_id: userId,
    position_id: position.id,
    review_date: reviewDate,
    what_changed: review.changed,
    thesis_status: review.thesisStatus,
    downside_risk: review.risk,
    would_buy_today: review.buyAgain,
    evidence_for: review.evidenceFor || null,
    evidence_against: review.evidenceAgainst || null,
    what_would_change_my_mind: review.changeMind || null,
    notes: review.notes || null,
  }).select().single();
  if (reviewError) throw reviewError;
  const { error: decisionError } = await supabase.from('decisions').insert({
    user_id: userId,
    position_id: position.id,
    review_id: saved.id,
    decision: review.decision,
    rationale: review.changed,
  });
  if (decisionError) throw decisionError;
  const { error: positionError } = await supabase.from('positions').update({
    current_thesis_status: review.thesisStatus,
    current_decision: review.decision,
    next_review_date: addDays(reviewDate, position.reviewPlan),
    updated_at: new Date().toISOString(),
    closed_at: review.decision === 'EXIT' ? new Date().toISOString() : null,
  }).eq('id', position.id);
  if (positionError) throw positionError;
}
