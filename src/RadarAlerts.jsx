import React, { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from './lib/supabase';
import { listRadarAlerts } from './lib/radarRepository';
import './radar.css';

const DEMO_ALERTS = [
  {id:'demo-hive',ticker:'HIVE',company:'HIVE Digital Technologies',theme:'AI Infrastructure + Bitcoin Mining',stage:'CONFIRMED',verdict:'HIGH PRIORITY',radar_score:84,entry_status:'WAIT FOR CONFIRMATION',thesis_direction:'STRONGER',alert_time:'2026-08-16T00:00:00Z',price_at_alert:null,what_changed:'GPU Cloud ARR แตะประมาณ $110M เมื่อรวม live + contracted และ Management ตั้งเป้า $200M ภายใน Q4 2026',story:'ธุรกิจกำลังเปลี่ยนจาก Bitcoin miner ที่มี AI optionality ไปสู่ Hybrid Digital Infrastructure Platform',key_trigger:'ยืนยัน deployment economics, HPC margin และ funding หลัง Earnings Call วันที่ 17 ส.ค.',primary_risk:'Execution และ Dilution ระหว่างเร่งขยาย AI/HPC',radar_followups:[1,7,30,90].map(d=>({checkpoint_days:d,checkpoint_date:`2026-${d===1?'08-17':d===7?'08-23':d===30?'09-15':'11-14'}`,completed:false}))},
  {id:'demo-iren',ticker:'IREN',company:'IREN',theme:'AI Cloud + Data Centers',stage:'CONFIRMED',verdict:'HIGH PRIORITY',radar_score:89,entry_status:'WAIT FOR CONFIRMATION',thesis_direction:'STRONGER',alert_time:'2026-08-16T01:00:00Z',price_at_alert:null,what_changed:'Horizon 1 ส่งมอบและได้รับการยอมรับแล้ว ลด Execution Risk ของ AI Cloud build-out',story:'Thesis กำลังเปลี่ยนจาก contracted AI capacity ไปสู่การส่งมอบและ customer acceptance ที่พิสูจน์ได้',key_trigger:'ผล FY2026 วันที่ 27 ส.ค. ดู AI Cloud revenue, margin, CapEx, funding และ Horizon 2-4',primary_risk:'CapEx และ Financing สูง อาจกดผลตอบแทนผู้ถือหุ้นแม้ AI revenue โต',radar_followups:[1,7,30,90].map(d=>({checkpoint_days:d,checkpoint_date:`2026-${d===1?'08-17':d===7?'08-23':d===30?'09-15':'11-14'}`,completed:false}))},
  {id:'demo-nbis',ticker:'NBIS',company:'Nebius Group',theme:'AI Infrastructure',stage:'CONFIRMED',verdict:'HIGH PRIORITY',radar_score:88,entry_status:'WAIT FOR PULLBACK',thesis_direction:'STRONGER',alert_time:'2026-08-12T14:00:00Z',price_at_alert:null,what_changed:'Demand visibility ดีขึ้นมากจากสัญญาขนาดใหญ่และการขยาย Capacity',story:'Nebius กำลังเปลี่ยนจาก Capacity-build story ไปสู่ Contracted Demand ที่มี Revenue Visibility สูงขึ้น',key_trigger:'สัญญา Capacity เพิ่ม, Backlog conversion และวินัยด้าน Funding',primary_risk:'Entry Risk หลังราคาพุ่งแรงหลัง Earnings',radar_followups:[1,7,30,90].map(d=>({checkpoint_days:d,checkpoint_date:`2026-${d===1?'08-13':d===7?'08-19':d===30?'09-11':'11-10'}`,completed:d===1}))}
];

const TH={stage:{EARLY:'ระยะเริ่มต้น',CONFIRMED:'ยืนยันแล้ว',CROWDED:'ตลาดรับรู้มากแล้ว'},entry:{'WAIT FOR CONFIRMATION':'รอการยืนยัน','WAIT FOR PULLBACK':'รอราคาย่อ','BUY ZONE':'โซนซื้อ','EXTENDED':'ราคาวิ่งไกลแล้ว','CROWDED':'ตลาดหนาแน่น','AVOID':'หลีกเลี่ยง'},thesis:{STRONGER:'Thesis แข็งขึ้น',UNCHANGED:'Thesis คงเดิม',WEAKER:'Thesis อ่อนลง'},verdict:{'HIGH PRIORITY':'สำคัญสูง',WATCH:'เฝ้าดู','EARLY RADAR':'Radar ระยะแรก','MATERIAL CHANGE':'มีการเปลี่ยนแปลงสำคัญ'}};
const t=(map,v)=>map[v]||v||'—';
const fmtDate=v=>v?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(v)):'—';
const scoreClass=n=>n>=85?'score-hot':n>=80?'score-priority':'score-watch';
function Badge({children,tone=''}){return <span className={`radar-badge ${tone}`}>{children}</span>}
function decisionSummary(a){
  const score=Number(a.radar_score||0);
  const interesting=score>=85?'น่าสนใจมาก':score>=80?'น่าสนใจ':'เฝ้าดู';
  const entry=a.entry_status||'WAIT FOR CONFIRMATION';
  const canBuy=entry==='BUY ZONE'?'เข้าโซนพิจารณาซื้อ':entry==='WAIT FOR PULLBACK'?'ยังไม่ควรไล่ราคา':entry==='WAIT FOR CONFIRMATION'?'ยังรอข้อมูลยืนยัน':entry==='AVOID'?'ยังไม่ควรเข้า':'ต้องระวังจังหวะเข้า';
  const tone=entry==='BUY ZONE'?'go':entry==='AVOID'||entry==='CROWDED'||entry==='EXTENDED'?'stop':'wait';
  return {interesting,canBuy,tone};
}

export default function RadarAlerts(){
  const [alerts,setAlerts]=useState(DEMO_ALERTS),[selectedId,setSelectedId]=useState(DEMO_ALERTS[0].id),[loading,setLoading]=useState(false),[error,setError]=useState(''),[filter,setFilter]=useState('ALL');
  useEffect(()=>{if(!isSupabaseConfigured)return;let alive=true;setLoading(true);listRadarAlerts().then(rows=>{if(alive&&rows.length){setAlerts(rows);setSelectedId(rows[0].id)}}).catch(e=>alive&&setError(`ยังโหลดข้อมูล Radar ไม่สำเร็จ: ${e.message}`)).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[]);
  const filtered=useMemo(()=>filter==='ALL'?alerts:alerts.filter(a=>a.stage===filter),[alerts,filter]);
  const selected=alerts.find(a=>a.id===selectedId)||filtered[0]||alerts[0];
  const due=alerts.flatMap(a=>(a.radar_followups||[]).map(f=>({...f,ticker:a.ticker}))).filter(f=>!f.completed).sort((a,b)=>a.checkpoint_date.localeCompare(b.checkpoint_date));
  const priorityCount=alerts.filter(a=>Number(a.radar_score)>=80).length,strongerCount=alerts.filter(a=>a.thesis_direction==='STRONGER').length;
  const selectAlert=id=>{setSelectedId(id);if(window.innerWidth<=720)setTimeout(()=>document.querySelector('.radar-detail')?.scrollIntoView({behavior:'smooth',block:'start'}),60)};
  const decision=selected?decisionSummary(selected):null;
  return <div className="radar-page">
    <div className="page-head radar-head"><div><h1>Radar หุ้น</h1><p>คัดโอกาส แยกคุณภาพหุ้นออกจากจังหวะเข้า และติดตามผลทุก Alert ถึง +90 วัน</p></div><div className="radar-live"><span></span>{loading?'กำลังโหลด':isSupabaseConfigured?'เชื่อมต่อ Supabase แล้ว':'โหมดตัวอย่าง'}</div></div>
    {error&&<div className="radar-warning">{error} ระบบจะแสดงข้อมูลตัวอย่างชั่วคราว</div>}
    <div className="metrics radar-metrics"><div className="metric"><span>Alert ทั้งหมด</span><strong>{alerts.length}</strong></div><div className="metric"><span>Priority ≥ 80</span><strong>{priorityCount}</strong></div><div className="metric"><span>Thesis แข็งขึ้น</span><strong>{strongerCount}</strong></div><div className="metric"><span>ติดตามครั้งถัดไป</span><strong>{due[0]?`${due[0].ticker} +${due[0].checkpoint_days}`:'ไม่มีค้าง'}</strong></div></div>
    <div className="radar-toolbar">{[['ALL','ทั้งหมด'],['EARLY','ระยะเริ่มต้น'],['CONFIRMED','ยืนยันแล้ว'],['CROWDED','ตลาดรับรู้มาก']].map(([x,label])=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{label}</button>)}</div>
    <div className="radar-layout">
      <section className="panel radar-list-panel"><div className="radar-section-title"><h2>คิวโอกาสลงทุน</h2><span>{filtered.length} รายการ</span></div><div className="radar-alert-list">{filtered.map(a=><button key={a.id} className={`radar-alert-row ${selected?.id===a.id?'selected':''}`} onClick={()=>selectAlert(a.id)}><div className="ticker-block"><strong>{a.ticker}</strong><small>{a.company||''}</small></div><div className="alert-mid"><div><Badge tone={a.stage?.toLowerCase()}>{t(TH.stage,a.stage)}</Badge><Badge>{t(TH.entry,a.entry_status||'UNSET')}</Badge></div><p>{a.what_changed}</p></div><div className={`radar-score ${scoreClass(Number(a.radar_score))}`}><strong>{Number(a.radar_score).toFixed(0)}</strong><span>/100</span></div></button>)}</div></section>
      {selected&&<section className="panel radar-detail">
        <div className="radar-detail-head"><div><span className="eyebrow">{selected.theme||selected.sector||'หุ้นสหรัฐฯ'}</span><h2>{selected.ticker} <small>{selected.company}</small></h2></div><div className={`radar-score large ${scoreClass(Number(selected.radar_score))}`}><strong>{Number(selected.radar_score).toFixed(0)}</strong><span>/100</span></div></div>
        <div className="radar-badge-line"><Badge tone={selected.stage?.toLowerCase()}>{t(TH.stage,selected.stage)}</Badge><Badge tone="priority">{t(TH.verdict,selected.verdict)}</Badge><Badge>{t(TH.entry,selected.entry_status||'ENTRY UNSET')}</Badge><Badge tone={selected.thesis_direction==='STRONGER'?'stronger':''}>{t(TH.thesis,selected.thesis_direction||'UNCHANGED')}</Badge></div>
        <div className="radar-decision-card">
          <div className="decision-card-title"><div><span>Decision Card</span><h3>สรุปให้ตัดสินใจใน 20 วินาที</h3></div><Badge tone={selected.thesis_direction==='STRONGER'?'stronger':''}>{t(TH.thesis,selected.thesis_direction||'UNCHANGED')}</Badge></div>
          <div className="decision-card-grid">
            <article><span>น่าสนใจไหม</span><strong>{decision.interesting}</strong><small>Radar Score {Number(selected.radar_score).toFixed(0)}/100 · {t(TH.stage,selected.stage)}</small></article>
            <article className={decision.tone}><span>ซื้อได้หรือยัง</span><strong>{decision.canBuy}</strong><small>{selected.entry_reason||t(TH.entry,selected.entry_status)}</small></article>
            <article><span>ต้องรออะไร</span><strong>{selected.key_trigger?'Key Trigger':'ข้อมูลยืนยันเพิ่ม'}</strong><small>{selected.key_trigger||'รอข้อมูลใหม่ที่ยืนยัน Thesis'}</small></article>
            <article className="risk"><span>อะไรทำให้ Thesis พัง</span><strong>Risk / Thesis Breaker</strong><small>{selected.stop_or_thesis_exit||selected.primary_risk||selected.bear_case||'ยังไม่มีข้อมูล'}</small></article>
          </div>
          <div className="decision-card-bottom"><div><span>Action ตอนนี้</span><strong>{selected.current_action||'WATCH'}</strong></div><div><span>จังหวะเข้า</span><strong>{t(TH.entry,selected.entry_status||'Not set')}</strong></div></div>
        </div>
        <div className="radar-mobile-callout"><span>สถานะตอนนี้</span><strong>{t(TH.entry,selected.entry_status||'ENTRY UNSET')}</strong><small>{selected.entry_reason||'ดู Key Trigger ก่อนตัดสินใจเข้า Position'}</small></div>
        <div className="radar-detail-grid"><article><h3>อะไรเปลี่ยนไป</h3><p>{selected.what_changed||'—'}</p></article><article><h3>Story / Narrative</h3><p>{selected.story||selected.emerging_narrative||'—'}</p></article><article><h3>Key Trigger ที่ต้องรอ</h3><p>{selected.key_trigger||'—'}</p></article><article><h3>ความเสี่ยงหลัก</h3><p>{selected.primary_risk||selected.bear_case||'—'}</p></article></div>
        <div className="decision-strip"><div><span>วันที่แจ้งเตือน</span><strong>{fmtDate(selected.alert_time)}</strong></div><div><span>ราคาตอน Alert</span><strong>{selected.price_at_alert?`$${Number(selected.price_at_alert).toFixed(2)}`:'ยังไม่ได้บันทึก'}</strong></div><div><span>จังหวะเข้า</span><strong>{t(TH.entry,selected.entry_status||'Not set')}</strong></div><div><span>Action</span><strong>{selected.current_action||'WATCH'}</strong></div></div>
        <div className="radar-action-guide"><h3>ใช้ข้อมูลนี้ตัดสินใจอย่างไร</h3><div><span>1</span><p><strong>ดู What Changed</strong> ว่าธุรกิจเปลี่ยนจริงหรือเป็นแค่กระแส</p></div><div><span>2</span><p><strong>เช็ก Key Trigger</strong> ก่อนเพิ่มความมั่นใจใน Thesis</p></div><div><span>3</span><p><strong>ดูจังหวะเข้า</strong> คะแนนสูงไม่ได้แปลว่าต้องซื้อทันที</p></div></div>
        <div className="followup-box"><h3>จุดติดตามผล</h3><div className="followup-track">{[1,7,30,90].map(days=>{const f=(selected.radar_followups||[]).find(x=>Number(x.checkpoint_days)===days);return <div key={days} className={`followup-step ${f?.completed?'done':''}`}><span>+{days} วัน</span><strong>{f?fmtDate(f.checkpoint_date):'รอกำหนด'}</strong><small>{f?.completed?'ติดตามแล้ว':'รอติดตาม'}</small></div>})}</div></div>
      </section>}
    </div>
  </div>
}
