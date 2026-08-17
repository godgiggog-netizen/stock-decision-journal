import { supabase } from './supabase';

export async function loadProofData(){
  const [{data:alerts,error:aErr},{data:reviews,error:rErr}] = await Promise.all([
    supabase.from('radar_alerts').select('*, radar_followups(*)').order('alert_time',{ascending:false}),
    supabase.from('radar_reviews').select('*').order('created_at',{ascending:false}),
  ]);
  if(aErr) throw aErr;
  if(rErr) throw rErr;
  return {alerts:alerts||[],reviews:reviews||[]};
}
