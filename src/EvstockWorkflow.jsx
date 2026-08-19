import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { reportToRadarAlert, decisionLabel } from './evstockEngine';
import './evstock.css';

function App() {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [saved, setSaved] = useState('');

  const samplePrompt = useMemo(() => `Evstock HIVE USD\n\nส่งผลลัพธ์เป็น EVSTOCK JSON สำหรับนำเข้า Stock Decision Journal โดยต้องมีอย่างน้อย: ticker, company, currency, as_of, status, model, summary, narrative, what_changed, market, valuation, deep, radar, decision, bull_case, bear_case, thesis_breakers, sources`, []);

  function importReport(e) {
    e.preventDefault();
    setError(''); setSaved(''); setReport(null);
    try {
      const parsed = JSON.parse(raw.trim());
      if (!parsed?.ticker) throw new Error('JSON ต้องมี ticker');
      if (!parsed?.decision) throw new Error('JSON ต้องมี decision');
      if (!Array.isArray(parsed.sources)) parsed.sources = [];
      setReport(parsed);
    } catch (err) {
      setError(`นำเข้าไม่ได้: ${err.message || String(err)}`);
    }
  }

  async function saveRun() {
    try {
      setBusy(true); setError(''); setSaved('');
      if (!isSupabaseConfigured) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) throw new Error('กรุณา Sign in ใน Stock Decision Journal ก่อน');
      const sources = (report.sources || []).map((s) => s.url).filter(Boolean);
      const { error: insertError } = await supabase.from('evstock_runs').insert({
        user_id: user.id,
        ticker: report.ticker,
        currency: report.currency || 'USD',
        status: report.status || 'COMPLETED',
        model: report.model || 'ChatGPT/Codex',
        as_of: report.as_of || new Date().toISOString(),
        report_json: report,
        source_urls: sources,
      });
      if (insertError) throw insertError;
      setSaved('บันทึก EVSTOCK Snapshot แล้ว');
    } catch (err) { setError(err.message || String(err)); }
    finally { setBusy(false); }
  }

  async function sendToRadar() {
    try {
      setBusy(true); setError(''); setSaved('');
      if (!isSupabaseConfigured) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) throw new Error('กรุณา Sign in ใน Stock Decision Journal ก่อน');
      const payload = { ...reportToRadarAlert(report), user_id: user.id };
      const { error: insertError } = await supabase.from('radar_alerts').insert(payload);
      if (insertError) throw insertError;
      setSaved('ส่งเข้า Radar Journal แล้ว และระบบจะสร้าง +1/+7/+30/+90 follow-up ให้อัตโนมัติ');
    } catch (err) { setError(err.message || String(err)); }
    finally { setBusy(false); }
  }

  const card = report ? decisionLabel(report) : null;
  return <main className="ev-shell">
    <header className="ev-head">
      <div><a href="/">← Stock Decision Journal</a><h1>EVSTOCK Import</h1><p>ChatGPT/Codex Research → Import JSON → Journal → Follow-up</p></div>
      <span className="vtag">V1B</span>
    </header>

    <section className="panel">
      <h3>1. วิเคราะห์ใน ChatGPT/Codex</h3>
      <p>ใช้คำสั่งเดิม เช่น <code>Evstock HIVE USD</code> แล้วขอผลลัพธ์เป็น EVSTOCK JSON</p>
      <textarea readOnly value={samplePrompt} aria-label="EVSTOCK prompt template" />
      <p className="hint">โหมดนี้ไม่เรียก OpenAI API จาก Supabase จึงไม่มีค่า API เพิ่มจากหน้า Journal</p>
    </section>

    <form className="panel form" onSubmit={importReport}>
      <h3>2. วาง EVSTOCK JSON</h3>
      <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='วาง JSON ที่ได้จาก ChatGPT/Codex ที่นี่' aria-label="EVSTOCK JSON" />
      <div className="actions"><button className="primary" disabled={busy || !raw.trim()}>นำเข้ารายงาน</button></div>
    </form>

    {error && <div className="msg err">{error}</div>}
    {saved && <div className="msg ok">{saved}</div>}

    {report && <>
      <section className="decision">
        <div><small>{report.ticker} · {report.company || ''}</small><h2>{card.action}</h2><p>{report.decision?.reason}</p></div>
        <div className="decision-grid">
          <Metric k="ราคาอ้างอิง" v={report.market?.price != null ? `$${report.market.price}` : 'N/A'} />
          <Metric k="Entry Zone" v={card.entry} />
          <Metric k="Target" v={card.target} />
          <Metric k="Confidence" v={card.confidence} />
        </div>
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
