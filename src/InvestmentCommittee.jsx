import React,{useMemo,useState}from'react';
import'./investmentCommittee.css';

const val=(v,fallback='ยังไม่มีข้อมูลใน Journal')=>v!==null&&v!==undefined&&v!==''?v:fallback;
const money=v=>v!==null&&v!==undefined&&v!==''?`$${Number(v).toFixed(2)}`:'—';
const pct=v=>v!==null&&v!==undefined&&v!==''?`${Number(v).toFixed(1)}%`:'—';

function buildCommittee(a){
  const score=Number(a.radar_score||0);
  const bullEvidence=[
    a.what_changed,
    a.evidence_summary,
    a.catalyst,
    a.bull_case,
    a.earnings_revision_notes,
  ].filter(Boolean);
  const bearEvidence=[
    a.primary_risk,
    a.bear_case,
    a.stop_or_thesis_exit,
    a.dilution_notes,
    a.market_expectation,
  ].filter(Boolean);

  const bull={
    growth:val(a.revenue_growth_pct!==null&&a.revenue_growth_pct!==undefined?`Revenue growth ที่บันทึกไว้ ${pct(a.revenue_growth_pct)}. ${a.story||a.emerging_narrative||''}`:a.story||a.emerging_narrative),
    valuation:val(a.risk_reward_ratio?`Risk/Reward ที่บันทึกไว้ประมาณ ${Number(a.risk_reward_ratio).toFixed(1)}x และราคา Alert ${money(a.price_at_alert)}. ฝั่ง Bull มองว่า upside ยังสมเหตุผลถ้า Catalyst เปลี่ยนเป็น Earnings/FCF จริง.`:a.expectation_summary),
    quality:val(a.business_quality?`Business Quality: ${a.business_quality}. ${a.evidence_summary||''}`:a.evidence_summary||a.actual_development),
    financials:val([a.revenue!=null?`Revenue ${money(a.revenue)}`:'',a.gross_margin_pct!=null?`Gross Margin ${pct(a.gross_margin_pct)}`:'',a.free_cash_flow!=null?`FCF ${money(a.free_cash_flow)}`:''].filter(Boolean).join(' · ')),
    management:val(a.analysis_summary,'ยังไม่มีข้อมูล Management โดยตรงใน Radar จึงไม่ควรให้เครดิตเกินหลักฐาน'),
    catalyst:val(a.next_catalyst||a.catalyst||a.key_trigger),
  };

  const bear={
    growth:val(a.market_expectation||a.bear_case,'Growth อาจถูกตลาด price-in ไปแล้ว หรือโตไม่ทันระดับความคาดหวัง'),
    valuation:val(a.valuation_risk?`Valuation Risk ${a.valuation_risk}/5. Entry status: ${a.entry_status||'—'}. ${a.entry_reason||''}`:a.entry_reason||a.expectation_gap),
    quality:val(a.primary_risk||a.stop_or_thesis_exit),
    financials:val([a.debt!=null?`Debt ${money(a.debt)}`:'',a.cash!=null?`Cash ${money(a.cash)}`:'',a.dilution_notes||''].filter(Boolean).join(' · '),'ต้องตรวจ Balance Sheet, FCF และ funding need เพิ่มก่อนเพิ่ม Position'),
    management:val(a.execution_risk?`Execution Risk ${a.execution_risk}/5. ต้องวัด Management จากการทำ Guidance/Catalyst ให้เกิดจริง ไม่ใช่จาก Narrative.`:'ต้องตรวจ track record ของ Guidance, capital allocation และ dilution เพิ่ม'),
    catalyst:val(a.thesis_breakers?.length?`Catalyst อาจผิดทางถ้า ${a.thesis_breakers.join(', ')}`:a.stop_or_thesis_exit||a.primary_risk),
  };

  let winner='สูสี';
  let reason='หลักฐาน Bull และ Bear ยังไม่ห่างกันพอที่จะตัดสินเด็ดขาด';
  if(score>=85&&a.thesis_direction==='STRONGER'){winner='Bull นำ';reason='Fundamental/Evidence score สูงและ Thesis กำลังแข็งขึ้น แต่ยังต้องแยกคุณภาพธุรกิจออกจากจังหวะ Entry'}
  else if(a.thesis_direction==='WEAKER'||['AVOID','EXTENDED','CROWDED'].includes(a.entry_status)){winner='Bear นำด้านจังหวะลงทุน';reason='ความเสี่ยงหรือราคาที่ตลาดรับรู้ไปมากแล้วทำให้ margin of safety ลดลง'}
  else if(score>=80){winner='Bull นำเล็กน้อย';reason='Opportunity score สูงพอให้ติดตามจริง แต่ยังมี uncertainty ที่ต้องตรวจเพิ่มก่อนเพิ่มความเสี่ยง'}
  else if(score<70){winner='Bear นำ';reason='หลักฐานเชิงบวกยังไม่พอชดเชย Risk/Reward'}

  return{
    bull,bear,winner,reason,
    verify:[
      a.key_trigger||'Key Trigger และวันที่คาดว่าจะรู้ผล',
      a.earnings_revision_notes||'Consensus Revenue/EPS revision ล่าสุด',
      a.free_cash_flow!=null?'FCF conversion และ CapEx trend':'FCF, CapEx และ funding need ล่าสุด',
      a.gross_margin_pct!=null?'Gross Margin trend เทียบ Guidance':'Gross Margin และ unit economics',
      a.primary_risk||'ความเสี่ยงหลักที่อาจทำให้ Thesis พัง',
    ].filter(Boolean),
    bullCount:bullEvidence.length,
    bearCount:bearEvidence.length,
  };
}

function Row({title,bull,bear}){return <div className="ic-row"><div className="ic-topic">{title}</div><div className="ic-cell bull">{bull}</div><div className="ic-cell bear">{bear}</div></div>}

export default function InvestmentCommittee({alert}){
  const[open,setOpen]=useState(false);
  const c=useMemo(()=>buildCommittee(alert||{}),[alert]);
  if(!alert)return null;
  return <div className="ic-shell">
    <button type="button" className="ic-launch" onClick={()=>setOpen(v=>!v)}>
      <span>⚖️ Investment Committee</span><small>{open?'ซ่อนการโต้วาที':'ให้ Bull vs Bear โต้กันจากข้อมูลหุ้นนี้'}</small>
    </button>
    {open&&<div className="ic-panel">
      <div className="ic-head"><div><span>INVESTMENT COMMITTEE</span><h3>{alert.ticker}: Bull vs Bear</h3></div><div className="ic-score">Radar {Number(alert.radar_score||0).toFixed(0)}/100</div></div>
      <div className="ic-column-head"><strong>หัวข้อ</strong><strong>🟢 Bull Analyst</strong><strong>🔴 Bear Analyst</strong></div>
      <Row title="Growth" bull={c.bull.growth} bear={c.bear.growth}/>
      <Row title="Valuation" bull={c.bull.valuation} bear={c.bear.valuation}/>
      <Row title="Business Quality" bull={c.bull.quality} bear={c.bear.quality}/>
      <Row title="Financials" bull={c.bull.financials} bear={c.bear.financials}/>
      <Row title="Management" bull={c.bull.management} bear={c.bear.management}/>
      <Row title="Catalysts" bull={c.bull.catalyst} bear={c.bear.catalyst}/>
      <div className="ic-judge">
        <div className="ic-judge-title"><span>⚖️ Neutral Judge</span><strong>{c.winner}</strong></div>
        <p>{c.reason}</p>
        <div className="ic-evidence-count">หลักฐานใน Journal ที่ดึงมาใช้: Bull {c.bullCount} จุด · Bear {c.bearCount} จุด</div>
        <h4>ข้อมูลที่ควร Verify ต่อ</h4>
        <ol>{c.verify.map((x,i)=><li key={i}>{x}</li>)}</ol>
        <small>Committee V1 ใช้ข้อมูลที่มีอยู่ใน Radar Journal เท่านั้น จึงไม่แทนการตรวจงบล่าสุดหรือ Valuation แบบ EVSTOCK</small>
      </div>
    </div>}
  </div>;
}
