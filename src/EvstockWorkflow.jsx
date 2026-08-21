import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { getCloudState, saveCloudState, subscribeCloudState } from './lib/cloudSync';
import { reportToRadarAlert, decisionLabel } from './evstockEngine';
import './evstock.css';

const DRAFT_KEY = 'evstock_v1b_draft';
const CLOUD_KEY = 'evstock_latest_draft';
const thAction = (v) => ({ WATCH:'เฝ้าดู', BUY:'ซื้อ', HOLD:'ถือต่อ', SELL:'ขาย', AVOID:'หลีกเลี่ยง', TRIM:'ลดสัดส่วน' }[String(v || '').toUpperCase()] || v || 'เฝ้าดู');
const thConfidence = (v) => ({ LOW:'ต่ำ', MEDIUM:'ปานกลาง', HIGH:'สูง' }[String(v || '').toUpperCase()] || v || 'ต่ำ');

function App() {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [saved, setSaved] = useState('');
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'กำลัง Sync' : 'เฉพาะเครื่องนี้');
  const hydrated = useRef(false);
  const remoteApply = useRef(false);

  const samplePrompt = useMemo(() => `Evstock HIVE USD\n\nส่งผลลัพธ์เป็น EVSTOCK JSON สำหรับนำเข้า Stock Decision Journal โดยต้องมีอย่างน้อย: ticker, company, currency, as_of, status, model, summary, narrative, what_changed, market, valuation, deep, radar, decision, bull_case, bear_case, thesis_breakers, sources\n\nสำคัญ: ข้อความอธิบายทั้งหมดต้องเป็นภาษาไทย อ่านง่ายสำหรับนักลงทุนไทย ใช้ศัพท์เทคนิคอังกฤษได้เฉพาะคำที่คุ้นเคย เช่น EVSTOCK, DEEP, Radar, Entry Zone, Target, Stop Loss, Risk/Reward, HPC, ARR และชื่อเฉพาะ ห้ามสร้างย่อหน้าคำอธิบายภาษาอังกฤษ`, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      let local = null;
      try { local = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) {}
      try {
        const cloud = await getCloudState(CLOUD_KEY);
        if (cancelled) return;
        const cloudState = cloud?.state || null;
        const localTime = new Date(local?.updated_at || 0).getTime();
        const cloudTime = new Date(cloudState?.updated_at || cloud?.updatedAt || 0).getTime();
        const chosen = cloudState && cloudTime >= localTime ? cloudState : local;
        if (chosen) {
          remoteApply.current = true;
          if (chosen.raw) setRaw(chosen.raw);
          if (chosen.report?.ticker && chosen.report?.decision) {
            setReport(chosen.report);
            setSaved(`กู้รายงาน ${chosen.report.ticker} ล่าสุดกลับมาแล้ว`);
          }
          setTimeout(() => { remoteApply.current = false; }, 0);
        }
        if (isSupabaseConfigured && local && (!cloudState || localTime > cloudTime)) {
          await saveCloudState(CLOUD_KEY, local);
        }
        setSyncStatus(isSupabaseConfigured ? '✓ Synced' : 'เฉพาะเครื่องนี้');
      } catch (e) {
        if (local && !cancelled) {
          if (local.raw) setRaw(local.raw);
          if (local.report?.ticker && local.report?.decision) setReport(local.report);
        }
        setSyncStatus('Sync มีปัญหา');
      } finally { hydrated.current = true; }
    }
    hydrate();
    const unsubscribe = subscribeCloudState(CLOUD_KEY, ({ state }) => {
      if (!state || !hydrated.current) return;
      remoteApply.current = true;
      setRaw(state.raw || '');
      setReport(state.report || null);
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch (_) {}
      setSyncStatus('✓ Synced');
      setTimeout(() => { remoteApply.current = false; }, 0);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!hydrated.current || remoteApply.current) return;
    const state = { raw, report, updated_at: new Date().toISOString() };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch (_) {}
    if (!isSupabaseConfigured) return;
    setSyncStatus('กำลัง Sync');
    const timer = setTimeout(() => {
      saveCloudState(CLOUD_KEY, state)
        .then(() => setSyncStatus('✓ Synced'))
        .catch(() => setSyncStatus('Sync มีปัญหา'));
    }, 500);
    return () => clearTimeout(timer);
  }, [raw, report]);

  function importReport(e) { e.preventDefault(); setError(''); setSaved(''); try { const parsed = JSON.parse(raw.trim()); if (!parsed?.ticker) throw new Error('JSON ต้องมี ticker'); if (!parsed?.decision) throw new Error('JSON ต้องมี decision'); if (!Array.isArray(parsed.sources)) parsed.sources = []; setReport(parsed); } catch (err) { setError(`นำเข้าไม่ได้: ${err.message || String(err)}`); } }
  async function clearDraft() {
    localStorage.removeItem(DRAFT_KEY); setRaw(''); setReport(null); setSaved(''); setError('');
    if (isSupabaseConfigured) {
      try { setSyncStatus('กำลัง Sync'); await saveCloudState(CLOUD_KEY, { raw:'', report:null, updated_at:new Date().toISOString() }); setSyncStatus('✓ Synced'); }
      catch (_) { setSyncStatus('Sync มีปัญหา'); }
    }
  }

  async function saveRun() { try { setBusy(true); setError(''); setSaved(''); if (!isSupabaseConfigured) throw new Error('ยังไม่ได้ตั้งค่า Supabase'); const { data: auth } = await supabase.auth.getSession(); const user = auth.session?.user; if (!user) throw new Error('กรุณาเข้าสู่ระบบ Stock Decision Journal ก่อน'); const sources = (report.sources || []).map((s) => s.url).filter(Boolean); const { error: insertError } = await supabase.from('evstock_runs').insert({ user_id:user.id, ticker:report.ticker, currency:report.currency || 'USD', status:report.status || 'COMPLETED', model:report.model || 'ChatGPT/Codex', as_of:report.as_of || new Date().toISOString(), report_json:report, source_urls:sources }); if (insertError) throw insertError; setSaved('✓ บันทึก EVSTOCK Snapshot สำเร็จแล้ว และ Sync ข้ามอุปกรณ์แล้ว'); window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }); } catch (err) { setError(err.message || String(err)); } finally { setBusy(false); } }
  async function sendToRadar() { try { setBusy(true); setError(''); setSaved(''); if (!isSupabaseConfigured) throw new Error('ยังไม่ได้ตั้งค่า Supabase'); const { data:auth } = await supabase.auth.getSession(); const user = auth.session?.user; if (!user) throw new Error('กรุณาเข้าสู่ระบบ Stock Decision Journal ก่อน'); const payload = { ...reportToRadarAlert(report), user_id:user.id }; const { error:insertError } = await supabase.from('radar_alerts').insert(payload); if (insertError) throw insertError; setSaved('✓ ส่งเข้า Radar Journal สำเร็จแล้ว ระบบจะติดตามผล +1 / +7 / +30 / +90 วัน'); window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }); } catch (err) { setError(err.message || String(err)); } finally { setBusy(false); } }

  const card = report ? decisionLabel(report) : null;
  return <main className="ev-shell">
    <header className="ev-head"><div><a href="/">← Stock Decision Journal</a><h1>นำเข้ารายงาน EVSTOCK</h1><p>วิเคราะห์ใน ChatGPT/Codex → นำเข้า JSON → บันทึก Journal → ติดตามผล</p></div><div><span className="vtag">V1B</span><div className="sync-pill">{syncStatus}</div></div></header>
    <section className="panel"><h3>1. วิเคราะห์ใน ChatGPT/Codex</h3><p>ใช้คำสั่งเดิม เช่น <code>Evstock HIVE USD</code> แล้วขอผลลัพธ์เป็น EVSTOCK JSON ภาษาไทย</p><textarea readOnly value={samplePrompt} aria-label="แม่แบบคำสั่ง EVSTOCK" /><p className="hint">โหมดนี้ไม่เรียก OpenAI API จาก Supabase จึงไม่มีค่า API เพิ่มจากหน้า Journal</p></section>
    <form className="panel form" onSubmit={importReport}><h3>2. วาง EVSTOCK JSON</h3><textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="วาง JSON ที่ได้จาก ChatGPT/Codex ที่นี่" aria-label="EVSTOCK JSON" /><div className="actions"><button className="primary" disabled={busy || !raw.trim()}>นำเข้ารายงาน</button>{(raw || report) && <button type="button" onClick={clearDraft} disabled={busy}>ล้างรายงานล่าสุด</button>}</div><p className="hint">Draft ล่าสุดเก็บบน Supabase และ Sync ข้ามมือถือ/คอมที่ Sign in ด้วยบัญชีเดียวกัน โดย localStorage ใช้เป็นสำรองเมื่อเน็ตมีปัญหา</p></form>
    {error && <div className="msg err">{error}</div>}{saved && <div className="msg ok">{saved}</div>}
    {report && <><section className="decision"><div><small>{report.ticker} · {report.company || ''}</small><h2>{thAction(card.action)}</h2><p>{report.decision?.reason}</p></div><div className="decision-grid"><Metric k="ราคาอ้างอิง" v={report.market?.price != null ? `$${report.market.price}` : 'ไม่มีข้อมูล'} /><Metric k="ช่วงราคาเข้าซื้อ" v={card.entry} /><Metric k="ราคาเป้าหมาย" v={card.target} /><Metric k="ความมั่นใจ" v={thConfidence(card.confidence)} /></div></section>
    <section className="grid"><Panel title="เรื่องราวการลงทุน"><p>{report.narrative}</p><h4>อะไรเปลี่ยนไป</h4><p>{report.what_changed}</p></Panel><Panel title="มูลค่าเหมาะสม"><p>ช่วงมูลค่าเหมาะสม: {range(report.valuation?.fair_value_low, report.valuation?.fair_value_high)}</p><p>กรณีแย่: {money(report.valuation?.bear_value)} · กรณีฐาน: {money(report.valuation?.base_value)} · กรณีดี: {money(report.valuation?.bull_value)}</p><p>{report.valuation?.summary}</p></Panel><Panel title="DEEP"><Score name="อุปสงค์ (Demand)" v={report.deep?.demand} /><Score name="เศรษฐศาสตร์ธุรกิจ (Economics)" v={report.deep?.economics} /><Score name="การลงมือทำ (Execution)" v={report.deep?.execution} /><Score name="ราคา (Price)" v={report.deep?.price} /></Panel><Panel title="ความเสี่ยง"><p><strong>กรณีแย่:</strong> {report.bear_case}</p><p><strong>เหตุที่ทำให้ Thesis ใช้ไม่ได้:</strong> {(report.thesis_breakers || []).join(' · ') || 'ไม่มีข้อมูล'}</p><p><strong>เงื่อนไขลดหรือออก:</strong> {report.decision?.stop_or_thesis_exit}</p></Panel></section>
    <section className="sources"><h3>แหล่งข้อมูล</h3>{(report.sources || []).map((s,i) => <div key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a><span>{s.as_of || ''}</span></div>)}</section><div className="actions"><button onClick={saveRun} disabled={busy}>บันทึก EVSTOCK Snapshot</button><button className="primary" onClick={sendToRadar} disabled={busy}>ส่งเข้า Radar Journal</button><button onClick={clearDraft} disabled={busy}>ล้างหลังทำเสร็จ</button></div></>}
  </main>;
}
const money = (v) => v == null ? 'ไม่มีข้อมูล' : `$${Number(v).toFixed(2)}`; const range = (a,b) => a == null || b == null ? 'ยังไม่มีข้อมูลที่น่าเชื่อถือ' : `${money(a)} – ${money(b)}`;
function Metric({k,v}) { return <div className="metric"><span>{k}</span><strong>{v}</strong></div>; } function Panel({title,children}) { return <section className="panel"><h3>{title}</h3>{children}</section>; } function Score({name,v}) { return <div className="score"><span>{name}</span><strong>{v == null ? 'ไม่มีข้อมูล' : `${v}/5`}</strong></div>; }
createRoot(document.getElementById('root')).render(<App />);
