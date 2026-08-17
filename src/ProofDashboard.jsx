import React,{useEffect,useMemo,useState}from'react';
import{isSupabaseConfigured}from'./lib/supabase';
import{loadProofData}from'./lib/proofRepository';
import'./proof.css';

const avg=xs=>xs.length?xs.reduce((s,x)=>s+Number(x||0),0)/xs.length:null;
const pct=v=>v==null?'—':`${v>=0?'+':''}${Number(v).toFixed(1)}%`;
const money=v=>v==null?'—':`$${Number(v).toFixed(2)}`;
const fmt=v=>v?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(v)):'—';

function latestCompleted(a,days){return (a.radar_followups||[]).find(f=>Number(f.checkpoint_days)===days&&f.completed&&f.return_since_alert_pct!=null)}
function scoreBucket(s){const n=Number(s||0);if(n>=90)return'90+';if(n>=85)return'85–89';if(n>=80)return'80–84';return'<80'}

export default function ProofDashboard(){
 const[data,setData]=useState({alerts:[],reviews:[]}),[loading,setLoading]=useState(false),[error,setError]=useState(''),[horizon,setHorizon]=useState(30);
 useEffect(()=>{if(!isSupabaseConfigured)return;let alive=true;setLoading(true);loadProofData().then(x=>alive&&setData(x)).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[]);
 const m=useMemo(()=>{
  const alerts=data.alerts, rows=alerts.map(a=>({a,f:latestCompleted(a,horizon)})).filter(x=>x.f);
  const returns=rows.map(x=>Number(x.f.return_since_alert_pct));
  const wins=returns.filter(x=>x>0).length, losses=returns.filter(x=>x<0).length;
  const dd=rows.map(x=>x.f.max_drawdown_pct).filter(x=>x!=null).map(Number);
  const gain=rows.map(x=>x.f.max_gain_pct).filter(x=>x!=null).map(Number);
  const priceCoverage=alerts.length?alerts.filter(a=>a.price_at_alert!=null).length/alerts.length*100:0;
  const buckets=['90+','85–89','80–84','<80'].map(bucket=>{const xs=rows.filter(x=>scoreBucket(x.a.radar_score)===bucket);const rs=xs.map(x=>Number(x.f.return_since_alert_pct));return{bucket,n:xs.length,avg:avg(rs),hit:xs.length?rs.filter(r=>r>0).length/xs.length*100:null}});
  const best=[...rows].sort((x,y)=>Number(y.f.return_since_alert_pct)-Number(x.f.return_since_alert_pct))[0];
  const worst=[...rows].sort((x,y)=>Number(x.f.return_since_alert_pct)-Number(y.f.return_since_alert_pct))[0];
  const falsePos=data.reviews.filter(r=>r.signal_quality==='FALSE POSITIVE').length;
  return{rows,returns,wins,losses,hit:rows.length?wins/rows.length*100:null,avgReturn:avg(returns),avgDD:avg(dd),avgGain:avg(gain),priceCoverage,buckets,best,worst,falsePos};
 },[data,horizon]);
 const maturity=m.rows.length>=20?'เริ่มมีข้อมูลพอให้เปรียบเทียบ':'ยังเป็นตัวอย่างน้อย ห้ามสรุปว่าเป็น Edge';
 return <div className="proof-page">
  <div className="page-head"><div><h1>PROOF Dashboard</h1><p>พิสูจน์ว่า Radar และ Trade Plan แม่นจริงหรือแค่ดูดีตอนย้อนหลัง</p></div><div className="proof-status">{loading?'กำลังคำนวณ':maturity}</div></div>
  {error&&<div className="radar-warning">{error}</div>}
  <div className="proof-tabs">{[1,7,30,90].map(d=><button key={d} className={horizon===d?'active':''} onClick={()=>setHorizon(d)}>+{d} วัน</button>)}</div>
  <div className="proof-metrics">
   <Metric label="ตัวอย่างที่วัดผลแล้ว" value={m.rows.length}/><Metric label="Hit Rate" value={m.hit==null?'—':`${m.hit.toFixed(0)}%`}/><Metric label="ผลตอบแทนเฉลี่ย" value={pct(m.avgReturn)}/><Metric label="Avg Max Drawdown" value={pct(m.avgDD)}/><Metric label="Avg Max Gain" value={pct(m.avgGain)}/><Metric label="ราคา Alert ครบ" value={`${m.priceCoverage.toFixed(0)}%`}/>
  </div>
  <div className="proof-grid">
   <section className="panel"><div className="proof-head"><div><span>RADAR VALIDATION</span><h2>คะแนนสูงให้ผลดีกว่าจริงไหม</h2></div></div><div className="proof-buckets">{m.buckets.map(b=><div key={b.bucket}><strong>{b.bucket}</strong><span>{b.n} Alert</span><b>{b.avg==null?'—':pct(b.avg)}</b><small>Hit {b.hit==null?'—':`${b.hit.toFixed(0)}%`}</small></div>)}</div><p className="proof-note">ถ้า 90+ ไม่ดีกว่า 80–84 เมื่อจำนวนตัวอย่างมากพอ แปลว่า scoring framework ต้องถูกตรวจใหม่</p></section>
   <section className="panel"><div className="proof-head"><div><span>EXTREMES</span><h2>ตัวที่ระบบจับได้ดีที่สุดและแย่ที่สุด</h2></div></div><div className="proof-extremes"><article className="good"><span>ดีที่สุด</span><strong>{m.best?.a.ticker||'—'}</strong><b>{m.best?pct(m.best.f.return_since_alert_pct):'—'}</b><small>Radar {m.best?Number(m.best.a.radar_score).toFixed(0):'—'}</small></article><article className="bad"><span>แย่ที่สุด</span><strong>{m.worst?.a.ticker||'—'}</strong><b>{m.worst?pct(m.worst.f.return_since_alert_pct):'—'}</b><small>Radar {m.worst?Number(m.worst.a.radar_score).toFixed(0):'—'}</small></article></div></section>
  </div>
  <section className="panel"><div className="proof-head"><div><span>TRACK RECORD</span><h2>ผลแต่ละ Alert ที่วัดได้ที่ +{horizon} วัน</h2></div><span>{m.rows.length} รายการ</span></div>{m.rows.length===0?<div className="proof-empty">ยังไม่มี Checkpoint +{horizon} วันที่ครบและมีราคาจริง ระบบจะเติมให้อัตโนมัติเมื่อถึงกำหนด</div>:<div className="proof-table"><table><thead><tr><th>หุ้น</th><th>Radar</th><th>Stage</th><th>ราคา Alert</th><th>ผล +{horizon}</th><th>Max Gain</th><th>Max DD</th><th>Thesis</th></tr></thead><tbody>{m.rows.sort((x,y)=>Number(y.f.return_since_alert_pct)-Number(x.f.return_since_alert_pct)).map(({a,f})=><tr key={`${a.id}-${horizon}`}><td><strong>{a.ticker}</strong><small>{fmt(a.alert_time)}</small></td><td>{Number(a.radar_score).toFixed(0)}</td><td>{a.stage}</td><td>{money(a.price_at_alert)}</td><td className={Number(f.return_since_alert_pct)>=0?'pos':'neg'}>{pct(f.return_since_alert_pct)}</td><td>{pct(f.max_gain_pct)}</td><td>{pct(f.max_drawdown_pct)}</td><td>{f.thesis_direction||'—'}</td></tr>)}</tbody></table></div>}</section>
  <section className="proof-integrity"><h3>สิ่งที่ Dashboard ยังไม่ควรสรุป</h3><p>Buy Readiness V1 ยังไม่ได้ถูก Snapshot แยก ณ เวลา Alert ทุกตัว จึงยังไม่แสดง Accuracy ของ Buy Readiness เพื่อป้องกันการใช้คะแนนปัจจุบันไปอธิบายอดีต หลังจากนี้ควรเก็บคะแนน ณ เวลาตัดสินใจทุกครั้ง แล้วค่อยเปิดสถิติส่วนนั้น</p><div><span>False Positive ที่ Review ยืนยันแล้ว</span><strong>{m.falsePos}</strong></div></section>
 </div>
}
function Metric({label,value}){return <div className="proof-metric"><span>{label}</span><strong>{value}</strong></div>}
