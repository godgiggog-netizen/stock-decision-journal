import { supabase, isSupabaseConfigured } from './supabase';

export async function getCloudState(stateKey) {
  if (!isSupabaseConfigured) return null;
  const { data: auth } = await supabase.auth.getSession();
  const user = auth.session?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_workspace_state')
    .select('state_json,updated_at')
    .eq('user_id', user.id)
    .eq('state_key', stateKey)
    .maybeSingle();
  if (error) throw error;
  return data ? { state: data.state_json, updatedAt: data.updated_at } : null;
}

export async function saveCloudState(stateKey, state) {
  if (!isSupabaseConfigured) return null;
  const { data: auth } = await supabase.auth.getSession();
  const user = auth.session?.user;
  if (!user) throw new Error('กรุณา Sign in ก่อน Sync ข้อมูล');
  const payload = {
    user_id: user.id,
    state_key: stateKey,
    state_json: state,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('user_workspace_state')
    .upsert(payload, { onConflict: 'user_id,state_key' })
    .select('state_json,updated_at')
    .single();
  if (error) throw error;
  return { state: data.state_json, updatedAt: data.updated_at };
}

export function subscribeCloudState(stateKey, onChange) {
  if (!isSupabaseConfigured) return () => {};
  let channel;
  let active = true;
  supabase.auth.getSession().then(({ data: auth }) => {
    const user = auth.session?.user;
    if (!active || !user) return;
    channel = supabase
      .channel(`workspace:${stateKey}:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_workspace_state',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new;
        if (row?.state_key === stateKey) onChange?.({ state: row.state_json, updatedAt: row.updated_at });
      })
      .subscribe();
  });
  return () => {
    active = false;
    if (channel) supabase.removeChannel(channel);
  };
}

export function subscribeTable(table, onChange) {
  if (!isSupabaseConfigured) return () => {};
  let channel;
  let active = true;
  supabase.auth.getSession().then(({ data: auth }) => {
    const user = auth.session?.user;
    if (!active || !user) return;
    channel = supabase
      .channel(`sync:${table}:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `user_id=eq.${user.id}`,
      }, () => onChange?.())
      .subscribe();
  });
  return () => {
    active = false;
    if (channel) supabase.removeChannel(channel);
  };
}
