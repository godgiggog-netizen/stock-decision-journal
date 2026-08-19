import React,{useEffect,useMemo,useState}from'react';
import{getLatestEvstockRun}from'./lib/committeeRepository';
import'./investmentCommittee.css';

const val=(v,fallback='ยังไม่มีข้อมูลใน Journal')=>v!==null&&v!==undefined&&v!==''?v:fallback;
const money=v=>v!==null&&v!==undefined&&v!==''?`$${Number(v).toFixed(2)}`:'—';
const pct=v=>v!==null&&v!==undefined&&v!==''?`${Number(v).toFixed(1)}%`:'—';
const actionTH=v=>({ADD:'เพิ่ม',HOLD:'ถือ',TRIM:'ลด',EXIT:'ออก',WATCH:'เฝ้าดู',BUY:'ซื้อ'}[v]||v||'เฝ้าดู');

function deriveAction(a,e,p){
  const evAction=String(e?.decision?.action||'').toUpperCase();
  const price=Number(a.price_at_alert||0);
  const low=Number(e?.valuation?.fair_value_low||0);
  const high=Number(e?.valuation?.fair_value_high||0);
  const hasPosition=Boolean(p);

  if(hasPosition&&(a.thesis_direction==='WEAKER'||['SELL','AVOID'].includes(evAction)))
    return{action:'EXIT',confidence:'สูง',reason:'Thesis หรือ EVSTOCK ส่งสัญญาณลบชัดเจน ควรทบทวนการถือทั้งหมดก่อน'};
  if(hasPosition&&(evAction==='TRIM'||a.entry_status==='CROWDED'||a.entry_status==='EXTENDED'||(high&&price>high)))
    return{action:'TRIM',confidence:'ปานกลาง',reason:'ราคาหรือ Valuation เริ่มตึงเมื่อเทียบกับข้อมูลล่าสุด การลดความเสี่ยงบางส่วนเหมาะกว่าการเพิ่ม'};
  if(hasPosition&&a.thesis_direction==='STRONGER'&&Number(a.radar_score)>=80&&a.entry_status==='BUY ZONE'&&!['SELL','AVOID','TRIM'].includes(evAction)&&(low?price<=low:true))
    return{action:'ADD',confidence:e?'ปานกลาง':'ต่ำ',reason:'Thesis แข็งขึ้นและ Entry อยู่ใน BUY ZONE โดยยังไม่ชนข้อห้ามจาก EVSTOCK'};
  if(hasPosition)
    return{action:'HOLD',confidence:e?'ปานกลาง':'ต่ำ',reason:'หลักฐานยังไม่พอให้เพิ่มหรือลด Position อย่างมีนัยสำคัญ จึงให้ถือและรอ Key Trigger'};
  if(Number(a.radar_score)>=80&&a.entry_status==='BUY ZONE'&&!['SELL','AVOID'].includes(evAction))
    return{action:'BUY',confidence:e?'ปานกลาง':'ต่ำ',reason:'Opportunity score สูงและอยู่ใน BUY ZONE แต่ควรเริ่มจากขนาดเล็กตาม Trade Plan'};
  return{action:'WATCH',confidence:'ปานกลาง',reason:'ยังไม่มี Position หรือจังหวะ Entry ยังไม่ดีพอ จึงเฝ้าดูแทนการไล่ราคา'};
}

function buildCommittee(a,e,p){
  const score=Number(a.radar_score||0);
  const ev=e||{};
  const deep=ev.deep||{};
  const bullEvidence=[a.what_changed,a.evidence_summary,a.catalyst,a.bull_case,a.earnings_revision_notes,ev.narrative,ev.bull_case].filter(Boolean);
  const bearEvidence=[a.primary_risk,a.bear_case,a.stop_or_thesis_exit,a.dilution_notes,a.market_expectation,ev.bear_case,...(ev.thesis_breakers||[])].filter(Boolean);

  const bull={
    growth:val(ev.summary||a.story||a.emerging_narrative),
    valuation:val(ev.valuation?.summary|| (a.risk_reward_ratio?`Risk/Reward ใน Radar ประมาณ ${Number(a.risk_reward_ratio).toFixed(1)}x ที่ราคา Alert ${money(a.price_at_alert)}`:a.expectation_summary)),
    quality:val(ev.deep?`DEEP: Demand ${deep.demand??'—'}/5 · Economics ${deep.economics??'—'}/5 · Execution ${deep.execution??'—'}/5 · Price ${deep.price??'—'}/5. ${a.evidence_summary||''}`:a.business_quality||a.evidence_summary),
    financials:val([a.revenue!=null?`Revenue ${money(a.revenue)}`:'',a.revenue_growth_pct!=null?`Growth ${pct(a.revenue_growth_pct)}`:'',a.gross_margin_pct!=null?`Gross Margin ${pct(a.gross_margin_pct)}`:'',a.free_cash_flow!=null?`FCF ${money(a.free_cash_flow)}`:''].filter(Boolean).join(' · ')),
    management:val(ev.decision?.reason||a.analysis_summary,'ยังไม่มีข้อมูล Management โดยตรงเพียงพอ'),
    catalyst:val(a.next_catalyst||a.catalyst||a.key_trigger),
  };

  const bear={
    growth:val(ev.bear_case||a.market_expectation||a.bear_case,'Growth อาจโตไม่ทันสิ่งที่ตลาด price-in'),
    valuation:val(ev.valuation?`Fair value ${money(ev.valuation.fair_value_low)} – ${money(ev.valuation.fair_value_high)} เทียบราคา Alert ${money(a.price_at_alert)}. ${ev.valuation.summary||''}`:a.entry_reason||a.expectation_gap),
    quality:val(a.primary_risk||a.stop_or_thesis_exit),
    financials:val([a.debt!=null?`Debt ${money(a.debt)}`:'',a.cash!=null?`Cash ${money(a.cash)}`:'',a.dilution_notes||''].filter(Boolean).join(' · '),'ต้องตรวจ Balance Sheet, FCF, CapEx และ funding need เพิ่ม'),
    management:val(a.execution_risk?`Execution Risk ${a.execution_risk}/5. ต้องวัดจาก Guidance, capital allocation และการส่งมอบ Catalyst จริง.`:'ต้องตรวจ track record ของ Guidance และ capital allocation'),
    catalyst:val((ev.thesis_breakers||[]).length?`Thesis อาจพังถ้า ${ev.thesis_breakers.join(' · ')}`:a.stop_or_thesis_exit||a.primary_risk),
  };

  let winner='สูสี';
  let reason='หลักฐาน Bull และ Bear ยังไม่ห่างกันพอ';
  if(score>=85&&a.thesis_direction==='STRONGER'){winner='Bull นำ';reason='Radar และ Fundamental evidence แข็ง แต่ยังต้องผ่านด่าน Valuation และ Execution'}
  else if(a.thesis_direction==='WEAKER'||['AVOID','EXTENDED','CROWDED'].includes(a.entry_status)){winner='Bear นำด้านจังหวะลงทุน';reason='Margin of safety ลดลงหรือ Thesis อ่อนลง'}
  else if(score>=80){winner='Bull นำเล็กน้อย';reason='Opportunity ยังน่าสนใจ แต่ยังมี uncertainty ที่ต้อง Verify'}
  else if(score<70){winner='Bear นำ';reason='หลักฐานบวกยังไม่พอชดเชย Risk/Reward'}

  const action=deriveAction(a,ev,p);
  const pl=p&&a.price_at_alert?((Number(a.price_at_alert)/Number(p.entryPrice)-1)*100):null;
  return{
    bull,bear,winner,reason,action,pl,
    verify:[a.key_trigger||'Key Trigger ถัดไป',a.earnings_revision_notes||'Consensus Revenue/EPS revision ล่าสุด',ev.valuation?.summary?'สมมติฐาน Valuation ใน EVSTOCK':'EVSTOCK Valuation ล่าสุด',a.free_cash_flow!=null?'FCF conversion และ CapEx trend':'FCF, CapEx และ funding need ล่าสุด',a.primary_risk||'ความเสี่ยงหลักที่ทำให้ Thesis พัง'].filter(Boolean),
    bullCount:bullEvidence.length,bearCount:bearEvidence.length,
  };
}

function Row({title,bull,bear}){return <div className="ic-row"><div className="ic-topic">{title}</div><div className="ic-cell bull">{bull}</div><div className="ic-cell bear">{bear}</div></div>}

export default function InvestmentCommittee({alert,position}){
  const[open,setOpen]=useState(false),[evstock,setEvstock]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let alive=true;if(!open||!alert?.ticker)return;setLoading(true);setError('');getLatestEvstockRun(alert.ticker).then(r=>{if(alive)setEvstock(r)}).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[open,alert?.ticker]);
  const report=evstock?.report||null;
  const c=useMemo(()=>buildCommittee(alert||{},report,position),[alert,report,position]);
  if(!alert)return null;
  return <div className="ic-shell">
    <button type="button" className="ic-launch" onClick={()=>setOpen(v=>!v)}>
      <span>⚖️ Investment Committee V2</span><small>{open?'ซ่อนการโต้วาที':'รวม Radar + EVSTOCK + Position จริง แล้วสรุป Hold / Add / Trim / Exit'}</small>
    </button>
    {open&&<div className="ic-panel">
      <div className="ic-head"><div><span>INVESTMENT COMMITTEE V2</span><h3>{alert.ticker}: Bull vs Bear</h3></div><div className="ic-score">Radar {Number(alert.radar_score||0).toFixed(0)}/100</div></div>
      <div className="ic-source-strip"><span>Radar ✓</span><span>{position?'Position ✓':'ยังไม่มี Position'}</span><span>{loading?'กำลังโหลด EVSTOCK…':report?'EVSTOCK ✓':'ยังไม่มี EVSTOCK'}</span></div>
      {error&&<div className="ic-error">โหลด EVSTOCK ไม่สำเร็จ: {error}</div>}
      <div className={`ic-action ${String(c.action.action).toLowerCase()}`}><div><span>COMMITTEE ACTION</span><strong>{actionTH(c.action.action)}</strong></div><p>{c.action.reason}</p><small>Confidence: {c.action.confidence}{position?` · Avg Cost ${money(position.entryPrice)}`:''}{c.pl!=null?` · เทียบราคา Alert ${c.pl>=0?'+':''}${c.pl.toFixed(1)}%`:''}</small></div>
      {report&&<div className="ic-evstock"><strong>EVSTOCK ล่าสุด</strong><span>{evstock?.asOf?new Date(evstock.asOf).toLocaleDateString('th-TH'):'—'}</span><p>{report.decision?.reason||report.summary||report.narrative||'มี EVSTOCK snapshot แล้ว'}</p></div>}
      <div className="ic-column-head"><strong>หัวข้อ</strong><strong>🟢 Bull Analyst</strong><strong>🔴 Bear Analyst</strong></div>
      <Row title="Growth" bull={c.bull.growth} bear={c.bear.growth}/>
      <Row title="Valuation" bull={c.bull.valuation} bear={c.bear.valuation}/>
      <Row title="Business Quality" bull={c.bull.quality} bear={c.bear.quality}/>
      <Row title="Financials" bull={c.bull.financials} bear={c.bear.financials}/>
      <Row title="Management" bull={c.bull.management} bear={c.bear.management}/>
      <Row title="Catalysts" bull={c.bull.catalyst} bear={c.bear.catalyst}/>
      <div className="ic-judge"><div className="ic-judge-title"><span>⚖️ Neutral Judge</span><strong>{c.winner}</strong></div><p>{c.reason}</p><div className="ic-evidence-count">หลักฐานที่ดึงมาใช้: Bull {c.bullCount} จุด · Bear {c.bearCount} จุด</div><h4>ข้อมูลที่ควร Verify ต่อ</h4><ol>{c.verify.map((x,i)=><li key={i}>{x}</li>)}</ol><small>คำแนะนำเป็น Decision Support จากข้อมูล Journal ไม่ได้ส่งคำสั่งซื้อขายอัตโนมัติ และราคาอ้างอิงคือ price_at_alert ไม่ใช่ราคาสด</small></div>
    </div>}
  </div>;
}
