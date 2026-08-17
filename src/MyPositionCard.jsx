import React,{useEffect,useMemo,useState}from'react';
import{isSupabaseConfigured}from'./lib/supabase';
import{getSession}from'./lib/repository-v03';
import{createRadarPosition,listRadarPositions}from'./lib/radarPositionRepository';
import'./myPosition.css';

const today=()=>new Date().toISOString().slice(0,10);
const money=v=>v!==null&&v!==undefined&&v!==''?`$${Number(v).toFixed(2)}`:'—';

export default function MyPositionCard({alert,onSaved}){
  const[positions,setPositions]=useState([]),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const[form,setForm]=useState({buyDate:today(),entryPrice:'',amount:'',pendingBuyPrice:'',pendingBuyAmount:''});
  const current=useMemo(()=>positions.find(p=>p.ticker===alert?.ticker&&!p.closedAt),[positions,alert?.ticker]);

  async function refresh(){
    if(!isSupabaseConfigured||!alert)return;
    try{setError('');setPositions(await listRadarPositions())}catch(e){setError(e.message)}
  }

  useEffect(()=>{refresh()},[alert?.ticker]);
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));

  const submit=async e=>{
    e.preventDefault();
    if(!form.entryPrice||!form.amount)return;
    try{
      setSaving(true);setError('');
      const session=await getSession();
      if(!session?.user)throw new Error('กรุณา Sign in ก่อนบันทึก Position');
      await createRadarPosition(session.user.id,alert,{
        buyDate:form.buyDate,
        entryPrice:Number(form.entryPrice),
        amount:Number(form.amount),
        pendingBuyPrice:form.pendingBuyPrice?Number(form.pendingBuyPrice):null,
        pendingBuyAmount:form.pendingBuyAmount?Number(form.pendingBuyAmount):null,
      });
      const rows=await listRadarPositions();
      setPositions(rows);onSaved?.(rows);
    }catch(e){setError(e.message)}finally{setSaving(false)}
  };

  if(!alert)return null;
  if(!isSupabaseConfigured)return <div className="my-position"><div className="mp-head"><div><span>MY POSITION</span><h3>Position จริงของฉัน</h3></div></div><p className="mp-muted">ต้องเชื่อมต่อ Supabase ก่อนจึงจะบันทึก Position จริงได้</p></div>;

  return <div className="my-position">
    <div className="mp-head"><div><span>MY POSITION</span><h3>Position จริงของฉัน</h3></div>{current&&<span className="mp-open">OPEN</span>}</div>
    {error&&<div className="mp-error">{error}</div>}
    {current?<>
      <div className="mp-grid">
        <article><span>Avg Cost</span><strong>{money(current.entryPrice)}</strong><small>วันที่ซื้อ {current.buyDate}</small></article>
        <article><span>Shares</span><strong>{Number(current.shares).toFixed(4)}</strong><small>คำนวณจากเงินลงทุน ÷ Avg Cost</small></article>
        <article><span>Invested</span><strong>{money(current.amount)}</strong><small>เงินที่ลงจริง</small></article>
        <article><span>Decision</span><strong>{current.decision||'HOLD'}</strong><small>{current.thesisStatus||'VALID'}</small></article>
      </div>
      <div className="mp-ladder">
        <div><span>Pending Buy</span><strong>{current.pendingBuyPrice?`${money(current.pendingBuyAmount)} @ ${money(current.pendingBuyPrice)}`:'ไม่มี'}</strong></div>
        <div><span>TP1</span><strong>{money(alert.take_profit_1_price)}</strong></div>
        <div><span>TP2</span><strong>{money(alert.take_profit_2_price)}</strong></div>
      </div>
    </>:<form className="mp-form" onSubmit={submit}>
      <div className="mp-form-grid">
        <label><span>วันที่ซื้อ</span><input type="date" value={form.buyDate} onChange={e=>set('buyDate',e.target.value)}/></label>
        <label><span>ราคาเฉลี่ย *</span><input inputMode="decimal" type="number" step="0.0001" value={form.entryPrice} onChange={e=>set('entryPrice',e.target.value)} placeholder="2.90"/></label>
        <label><span>เงินลงทุน *</span><input inputMode="decimal" type="number" step="0.01" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="200"/></label>
        <label><span>Pending Buy ราคา</span><input inputMode="decimal" type="number" step="0.0001" value={form.pendingBuyPrice} onChange={e=>set('pendingBuyPrice',e.target.value)} placeholder="2.80"/></label>
        <label><span>Pending Buy เงิน</span><input inputMode="decimal" type="number" step="0.01" value={form.pendingBuyAmount} onChange={e=>set('pendingBuyAmount',e.target.value)} placeholder="200"/></label>
      </div>
      <div className="mp-preview"><span>จำนวนหุ้นโดยประมาณ</span><strong>{form.entryPrice&&form.amount?(Number(form.amount)/Number(form.entryPrice)).toFixed(4):'—'}</strong></div>
      <div className="mp-actions"><button className="mp-primary" disabled={saving}>{saving?'กำลังบันทึก…':'บันทึก Position จริง'}</button></div>
    </form>}
  </div>;
}
