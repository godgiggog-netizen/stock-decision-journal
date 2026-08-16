import { supabase } from './supabase';

export async function listRadarAlerts() {
  const { data, error } = await supabase
    .from('radar_alerts')
    .select('*, radar_followups(*)')
    .order('alert_time', { ascending: false });
  if (error) throw error;
  return data || [];
}
