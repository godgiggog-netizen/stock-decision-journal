const n=v=>v===null||v===undefined||v===''?null:Number(v);
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function rrScore(rr){
  if(rr==null)return 55;
  if(rr>=4)return 95;if(rr>=3.5)return 88;if(rr>=3)return 82;if(rr>=2.5)return 74;if(rr>=2)return 64;if(rr>=1.5)return 50;return 30;
}
function entryScore(status){
  return ({'BUY ZONE':95,'WAIT FOR PULLBACK':62,'WAIT FOR CONFIRMATION':58,'WATCH':52,'EXTENDED':30,'CROWDED':24,'AVOID':10})[status]??55;
}
function stageScore(stage){return ({EARLY:68,CONFIRMED:88,CROWDED:42})[stage]??60}
function thesisScore(direction){return ({STRONGER:92,UNCHANGED:70,WEAKER:30})[direction]??60}
function fieldScore(a,names,fallback){for(const k of names){const v=n(a[k]);if(v!=null)return clamp(v<=20?v*5:v)}return fallback}

export function buyReadiness(a){
  if(!a)return null;
  const rr=n(a.risk_reward_ratio);
  const valuation=rrScore(rr);
  const entry=entryScore(a.entry_status);
  const expectation=fieldScore(a,['expectation_gap_score','score_expectation_gap'],Math.round((Number(a.radar_score||60)+thesisScore(a.thesis_direction))/2));
  const catalyst=fieldScore(a,['catalyst_score','score_catalyst'],stageScore(a.stage));
  const momentum=fieldScore(a,['price_momentum_score','score_price_momentum'],a.stage==='CONFIRMED'?82:a.stage==='CROWDED'?58:62);
  const riskReward=rrScore(rr);
  let total=Math.round(valuation*.25+entry*.20+expectation*.20+catalyst*.15+momentum*.10+riskReward*.10);
  if(a.thesis_direction==='WEAKER')total=Math.min(total,54);
  if(a.stage==='CROWDED')total=Math.min(total,64);
  const label=total>=80?'พร้อมพิจารณาซื้อ':total>=70?'ใกล้พร้อม':total>=60?'รอจังหวะ':total>=45?'เฝ้าดู':'ยังไม่ควรเข้า';
  const action=total>=80?'BUY SMALL':total>=70?'WAIT / STARTER ONLY':total>=60?'WAIT FOR SETUP':'WATCH';
  return {score:total,label,action,parts:{valuation,entry,expectation,catalyst,momentum,riskReward},model:'Buy Readiness V1'};
}

export function portfolioSnapshot(positions=[],alerts=[]){
  const active=positions.filter(p=>p.decision!=='EXIT');
  const total=active.reduce((s,p)=>s+Number(p.amount||0),0);
  const latestByTicker={};
  [...alerts].sort((a,b)=>String(b.alert_time||'').localeCompare(String(a.alert_time||''))).forEach(a=>{if(!latestByTicker[a.ticker])latestByTicker[a.ticker]=a});
  const themes={};
  const names={};
  active.forEach(p=>{
    const amt=Number(p.amount||0),a=latestByTicker[p.ticker]||{};
    const theme=a.theme||a.sector||'Other';
    themes[theme]=(themes[theme]||0)+amt;
    names[p.ticker]=(names[p.ticker]||0)+amt;
  });
  const themeRows=Object.entries(themes).map(([theme,amount])=>({theme,amount,pct:total?amount/total*100:0})).sort((a,b)=>b.pct-a.pct);
  const nameRows=Object.entries(names).map(([ticker,amount])=>({ticker,amount,pct:total?amount/total*100:0})).sort((a,b)=>b.pct-a.pct);
  return {total,themeRows,nameRows,topTheme:themeRows[0]||null,topName:nameRows[0]||null};
}

export function suggestedSizing(alert,positions=[],alerts=[]){
  const br=buyReadiness(alert),snap=portfolioSnapshot(positions,alerts);
  if(!br)return null;
  let maxPct=br.score>=85?8:br.score>=80?6:br.score>=72?4:br.score>=65?3:2;
  let initialPct=Math.max(1,Math.round(maxPct*.4));
  if(alert.stage==='CROWDED'){maxPct=Math.min(maxPct,3);initialPct=1}
  if(alert.thesis_direction==='WEAKER'){maxPct=Math.min(maxPct,2);initialPct=1}
  const theme=alert.theme||alert.sector||'Other';
  const themePct=snap.themeRows.find(x=>x.theme===theme)?.pct||0;
  if(themePct>=40){maxPct=Math.min(maxPct,2);initialPct=1}
  else if(themePct>=30){maxPct=Math.min(maxPct,3);initialPct=Math.min(initialPct,1)}
  const currentPct=snap.nameRows.find(x=>x.ticker===alert.ticker)?.pct||0;
  const roomPct=Math.max(0,maxPct-currentPct);
  const warning=themePct>=40?'Theme นี้กระจุกตัวสูงมาก':themePct>=30?'Theme นี้เริ่มกระจุกตัว':currentPct>=maxPct?'Position ปัจจุบันถึงเพดานที่โมเดลแนะนำแล้ว':null;
  return {initialPct,maxPct,currentPct,roomPct,theme,themePct,warning,basis:'คำนวณจาก cost basis ของ Position ที่บันทึกไว้ ไม่ใช่มูลค่าตลาดสด'};
}
