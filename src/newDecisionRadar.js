import { supabase } from './lib/supabase';

let alerts=[];
async function loadAlerts(){
  const {data,error}=await supabase.from('radar_alerts').select('*').order('alert_time',{ascending:false});
  if(!error) alerts=data||[];
}
loadAlerts();

const textOf=el=>(el?.textContent||'').trim();
function fieldByLabel(form,needle){return [...form.querySelectorAll('label.field')].find(x=>textOf(x.querySelector('span')).toLowerCase().includes(needle.toLowerCase()))}
function setField(form,label,value){const f=fieldByLabel(form,label);const el=f?.querySelector('input,textarea,select');if(!el||value===null||value===undefined)return;const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')?.set;setter?.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
const money=v=>v==null?'—':`$${Number(v).toFixed(2)}`;
function snapshot(a){return [
  `Radar Snapshot ${new Date(a.alert_time).toLocaleDateString('th-TH')}`,
  `Radar ${a.radar_score||'—'}/100 · ${a.stage||'—'} · ${a.verdict||'—'}`,
  `Thesis: ${a.thesis_direction||'—'}`,
  `What Changed: ${a.what_changed||'—'}`,
  `Story: ${a.story||'—'}`,
  `Key Trigger: ${a.key_trigger||'—'}`,
  `Entry Zone: ${money(a.entry_zone_low)} – ${money(a.entry_zone_high)}`,
  `Breakout: ${money(a.breakout_entry_price)} · Base Target: ${money(a.base_target_price)}`,
  `TP1: ${money(a.take_profit_1_price)} · TP2: ${money(a.take_profit_2_price)}`,
  `Risk/Reward: ${a.risk_reward_ratio?Number(a.risk_reward_ratio).toFixed(1)+'x':'—'}`
].join('\n')}
function applyAlert(form,a){
  setField(form,'Ticker',a.ticker);setField(form,'Company',a.company||'');
  if(a.price_at_alert)setField(form,'Entry price',a.price_at_alert);
  if(a.base_target_price)setField(form,'Target price',a.base_target_price);
  const thesis=[a.story,a.what_changed,`Radar ${a.radar_score||'—'}/100 · ${a.stage||'—'}`,a.thesis_direction?`Thesis ${a.thesis_direction}`:''].filter(Boolean).join('\n\n');
  setField(form,'Why did I buy',thesis);
  setField(form,'Expected outcome',[a.bull_case,a.key_trigger?`Key Trigger: ${a.key_trigger}`:'',snapshot(a)].filter(Boolean).join('\n\n'));
  setField(form,'What would prove me wrong',a.stop_or_thesis_exit||a.primary_risk||a.bear_case||'ทบทวนใหม่เมื่อ Thesis หรือ Fundamental เปลี่ยนอย่างมีนัยสำคัญ');
  const old=document.getElementById('radar-buy-check');old?.remove();
  const price=Number(fieldByLabel(form,'Entry price')?.querySelector('input')?.value||0),lo=Number(a.entry_zone_low||0),hi=Number(a.entry_zone_high||0),bo=Number(a.breakout_entry_price||0);
  let msg='ข้อมูล Radar ถูก Snapshot ลงในเหตุผลการลงทุนแล้ว';
  if(price&&lo&&hi){if(price>=lo&&price<=hi)msg=`✓ ราคาอยู่ใน Entry Zone ${money(lo)}–${money(hi)}`;else if(price>hi&&bo&&price<bo)msg=`⚠ ราคาสูงกว่า Entry Zone และยังไม่ถึง Breakout ${money(bo)} ควรระบุเหตุผลก่อนซื้อ`;else if(price>=bo)msg=`⚠ ราคาอยู่เหนือ Breakout ${money(bo)} ตรวจ Volume/Catalyst ยืนยันก่อนซื้อ`;else msg=`ราคาอยู่ต่ำกว่า Entry Zone ตรวจว่า Thesis ยังไม่เสียก่อนซื้อ`;}
  const box=document.createElement('div');box.id='radar-buy-check';box.className='radar-prefill-check';box.textContent=msg;form.querySelector('.grid2')?.after(box);
}
function enhance(){
  const form=[...document.querySelectorAll('form.panel.form')].find(f=>textOf(f.querySelector('h1')).includes('New Decision'));
  if(!form||form.dataset.radarEnhanced)return;form.dataset.radarEnhanced='1';
  const head=form.querySelector('.head');if(head?.querySelector('h1'))head.querySelector('h1').textContent='บันทึกการลงทุน';if(head?.querySelector('p'))head.querySelector('p').textContent='เลือกจาก Radar เพื่อดึง Thesis และ Trade Plan มาให้อัตโนมัติ หรือกรอกหุ้นอื่นเอง';
  const wrap=document.createElement('div');wrap.className='radar-prefill';wrap.innerHTML=`<div class="radar-prefill-title"><strong>ซื้อจาก Radar</strong><span>ดึงข้อมูลล่าสุดมากรอกให้ และเก็บ Snapshot ณ วันตัดสินใจ</span></div><select id="radar-prefill-select"><option value="">เลือกหุ้นจาก Radar…</option>${alerts.map(a=>`<option value="${a.id}">${a.ticker} · ${a.radar_score||'—'}/100 · ${a.stage||''}</option>`).join('')}</select><div class="radar-prefill-meta">หรือกรอกหุ้นอื่นในแบบฟอร์มด้านล่างได้ตามปกติ</div>`;
  head?.after(wrap);wrap.querySelector('select')?.addEventListener('change',e=>{const a=alerts.find(x=>String(x.id)===e.target.value);if(a)applyAlert(form,a)});
}
new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});enhance();
