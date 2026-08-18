import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { parseEvstockCommand, reportToRadarAlert, decisionLabel } from './evstockEngine';
import './evstock.css';

function App() {
  const [command, setCommand] = useState('Evstock HIVE USD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [saved, setSaved] = useState('');

  async function run(e) {
    e.preventDefault();
    setError(''); setSaved(''); setReport(null);
    const parsed = parseEvstockCommand(command);
    if (!parsed) return setError('ใช้รูปแบบ: Evstock HIVE USD');
    if (!isSupabaseConfigured) return setError('ยังไม่ได้ตั้งค่า Supabase ใน .env.local');
    try {
      setBusy(true);
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) throw new Error('กรุณา Sign in ใน Stock Decision Journal ก่อน');
      const { data, error: fnError } = await supabase.functions.invoke('evstock', { body: parsed });
      if (fnError) throw fnError;
      if (!data?.report) throw new Error(data?.error || 'EVSTOCK ไม่ได้ส่งรายงานกลับมา');
      setReport(data.report);
    } catch (err) { setError(err.message || String(err)); }
    finally { setBusy(false); }
  }

  async function saveRun() {
    try {
      setBusy(true); setError(''); setSaved('');
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) throw new Error('Session หมดอายุ กรุณา Sign in ใหม่');
      const sources = (report.sources || []).map((s) => s.url).filter(Boolean);
      const { error: insertError } = await supabase.from('evstock_runs').insert({
        user_id: user.id, ticker: report.ticker, currency: report.currency || 'USD',
        status: report.status || 'COMPLETED', model: report.model || null,
        as_of: report.as_of || new Date().toISOString(), report_json: report, source_urls: sources,
      });
      if (insertError) throw insertError;
      setSaved('บันทึก EVSTOCK snapshot แล้ว');
    } catch (err) { setError(err.message || String(err)); }
    finally { setBusy(false); }
  }

  async function sendToRadar() {
    try {
      setBusy(true); setError(''); setSaved('');
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) throw new Error('Session หมดอายุ กรุณา Sign in ใหม่');
      const payload = { ...reportToRadarAlert(report), user_id: user.id };
      const { error: insertError } = await supabase.from('radar_alerts').insert(payload);
      if (insertError) throw insertError;
      setSaved('ส่งเข้า Radar Journal แล้ว และระบบจะสร้าง +1/+7/+30/+90 follow-up ให้อัตโนมัติ');
    } catch (err) { setError(err.message || String(err)); }
    finally { setBusy(false); }
  }

  const card = report ? decisionLabel(report) : null;
  return <main className="ev-shell">
    <header className="ev-head"><div><a href="/">← Stock Decision Journal</a><h1>EVSTOCK Workflow</h1><p>Research → Valuation → Technical → Decision → Journal</p></div><span className="vtag">V1</span></header>
    <form className="command" onSubmit={run}><input value={command} onChange={(e) => setCommand(e.target.value)} aria-label="EVSTOCK command"/><button disabled={busy}>{busy ? 'กำลังวิเคราะห์…' : 'RUN'}</button></form>
    <p className="hint">ตัวอย่าง: <code>Evstock HIVE USD</code> · ระบบต้องมี OPENAI_API_KEY ใน Supabase Edge Function secrets</p>
    {error && <div className="msg err">{error}</div>}
    {saved && <div className="msg ok">{saved}</div>}

    {report && <>
      <section className="decision">
        <div><small>{report.ticker} · {report.company}</small><h2>{card.action}</h2><p>{report.decision?.reason}</p></div>
        <div className="decision-grid"><Metric k="ราคาอ้างอิง" v={report.market?.price != null ? `$${report.market.price}` : 'N/A'} /><Metric k="Entry Zone" v={card.entry} /><Metric k="Target" v={card.target} /><Metric k="Confidence" v={card.confidence} /></div>
      </section>

      <section className="grid">
        <Panel title="Narrative"><p>{report.narrative}</p><h4>อะไรเปลี่ยน</h4><p>{report.what_changed}</p></Panel>
        <Panel title="Valuation"><p>Fair value: {range(report.valuation?.fair_value_low, report.valuation?.fair_value_high)}</p><p>Bear: {money(report.valuation?.bear_value)} · Base: {money(report.valuation?.base_value)} · Bull: {money(report.valuation?.bull_value)}</p><p>{report.valuation?.summary}</p></Panel>
        <Panel title="DEEP"><Score name="Demand" v={report.deep?.demand} /><Score name="Economics" v={report.deep?.economics} /><Score name="Execution" v={report.deep?.execution} /><Score name="Price" v={report.deep?.price} /></Panel>
        <Panel title="Risk"><p><strong>Bear case:</strong> {report.bear_case}</p><p><strong>Thesis breaker:</strong> {(report.thesis_breakers || []).join(' · ') || 'N/A'}</p><p><strong>Exit:</strong> {report.decision?.stop_or_thesis_exit}</p></Panel>
      </section>

      <section className="sources"><h3>Sources</h3>{(report.sources || []).map((s, i) => <div key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a><span>{s.as_of || ''}</span></div>)}</section>
      <div className="actions"><button onClick={saveRun} disabled={busy}>บันทึก EVSTOCK Snapshot</button><button className="primary" onClick={sendToRadar} disabled={busy}>ส่งเข้า Radar Journal</button></div>
    </>}
  </main>;
}

const money = (v) => v == null ? 'N/A' : `$${Number(v).toFixed(2)}`;
const range = (a,b) => a == null || b == null ? 'N/A' : `${money(a)} – ${money(b)}`;
function Metric({k,v}) { return <div className="metric"><span>{k}</span><strong>{v}</strong></div>; }
function Panel({title,children}) { return <section className="panel"><h3>{title}</h3>{children}</section>; }
function Score({name,v}) { return <div className="score"><span>{name}</span><strong>{v == null ? 'N/A' : `${v}/5`}</strong></div>; }

createRoot(document.getElementById('root')).render(<App />);
