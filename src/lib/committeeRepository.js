import { supabase } from './supabase';

export async function getLatestEvstockRun(ticker) {
  if (!supabase || !ticker) return null;
  const { data, error } = await supabase
    .from('evstock_runs')
    .select('id,ticker,as_of,report_json,created_at')
    .eq('ticker', String(ticker).toUpperCase())
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    id: data.id,
    ticker: data.ticker,
    asOf: data.as_of,
    createdAt: data.created_at,
    report: data.report_json || null,
  } : null;
}
