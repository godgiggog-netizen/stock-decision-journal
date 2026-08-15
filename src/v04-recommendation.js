import { supabase } from './lib/supabase';

const money = (n) => Number(n).toLocaleString(undefined,{maximumFractionDigits:2});

async function findVisiblePosition() {
  const ticker = document.querySelector('.head h1')?.textContent?.trim()?.toUpperCase();
  if (!ticker || ticker === 'DASHBOARD' || ticker.startsWith('REVIEW')) return null;
  const { data, error } = await supabase.from('positions').select('*').eq('ticker', ticker).order('created_at',{ascending:false});
  if (error) throw error;
  if (!data?.length) return null;
  const entryText = [...document.querySelectorAll('.facts span')].find(el=>el.textContent?.startsWith('Entry'))?.textContent || '';
  const m = entryText.match(/\$([0-9.,]+)/);
  if (!m) return data[0];
  const visibleEntry = Number(m[1].replace(/,/g,''));
  return data.find(p=>Math.abs(Number(p.entry_price)-visibleEntry)<0.01) || data[0];
}

async function latestReview(positionId) {
  const { data, error } = await supabase.from('reviews').select('downside_risk,would_buy_today').eq('position_id',positionId).order('created_at',{ascending:false}).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function latestSnapshot(positionId) {
  const { data, error } = await supabase.from('analysis_snapshots').select('*').eq('position_id',positionId).order('created_at',{ascending:false}).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

function recommendationClass(r){
  if(r==='BUY MORE') return 'rec-buy';
  if(r==='REDUCE'||r==='EXIT') return 'rec-risk';
  return 'rec-hold';
}

function renderSnapshot(panel, snap, userDecision){
  const disagreement = snap && snap.recommendation !== userDecision;
  if(!snap){
    panel.querySelector('.rec-result').innerHTML = '<p class="muted">No system analysis yet. Tap Analyze Now to create the first snapshot.</p>';
    return;
  }
  const evidence = Array.isArray(snap.key_evidence) ? snap.key_evidence : [];
  const risks = Array.isArray(snap.key_risks) ? snap.key_risks : [];
  panel.querySelector('.rec-result').innerHTML = `
    <div class="rec-headline">
      <div><span>System Recommendation</span><strong class="${recommendationClass(snap.recommendation)}">${snap.recommendation}</strong></div>
      <div><span>Confidence</span><strong>${Number(snap.confidence).toFixed(0)}%</strong></div>
      <div><span>Market price</span><strong>${snap.market_price == null ? '—' : '$'+money(snap.market_price)}</strong></div>
    </div>
    ${disagreement ? `<div class="disagreement">System says <b>${snap.recommendation}</b>, while My Decision is <b>${userDecision}</b>. This disagreement is saved for later review.</div>` : ''}
    <div class="scoregrid">
      <div><span>Thesis</span><b>${snap.thesis_score}</b></div>
      <div><span>Business</span><b>${snap.business_score}</b><small>Fundamental feed pending</small></div>
      <div><span>Valuation</span><b>${snap.valuation_score}</b></div>
      <div><span>Market</span><b>${snap.market_score}</b></div>
      <div><span>Risk</span><b>${snap.risk_score}</b></div>
    </div>
    <p class="rec-summary">${snap.summary || ''}</p>
    <div class="rec-lists">
      <div><h3>Why</h3>${evidence.length ? `<ul>${evidence.map(x=>`<li>${x}</li>`).join('')}</ul>` : '<p class="muted">No evidence recorded.</p>'}</div>
      <div><h3>Watch</h3>${risks.length ? `<ul>${risks.map(x=>`<li>${x}</li>`).join('')}</ul>` : '<p class="muted">No rule-based risk flags.</p>'}</div>
    </div>
    <small class="provider-note">As of ${snap.market_price_as_of ? new Date(snap.market_price_as_of).toLocaleString() : 'unknown'} · ${snap.provider || 'free market data'} · Rule-based, not investment advice.</small>`;
}

async function analyze(panel, position){
  const btn = panel.querySelector('.analyze-now');
  const status = panel.querySelector('.rec-status');
  try{
    btn.disabled=true; btn.textContent='Analyzing…'; status.textContent='Fetching free market data…';
    const review = await latestReview(position.id);
    const { data: result, error: fnError } = await supabase.functions.invoke('analyze-position-free',{body:{
      ticker: position.ticker,
      entryPrice: Number(position.entry_price),
      target: position.target_price == null ? null : Number(position.target_price),
      thesisStatus: position.current_thesis_status,
      latestRisk: review?.downside_risk || '',
      latestBuyAgain: review?.would_buy_today || '',
    }});
    if(fnError) throw fnError;
    if(result?.error) throw new Error(result.error);
    const { data: auth } = await supabase.auth.getUser();
    const row = {
      user_id: auth.user.id,
      position_id: position.id,
      recommendation: result.recommendation,
      confidence: result.confidence,
      thesis_score: result.thesisScore,
      business_score: result.businessScore,
      valuation_score: result.valuationScore,
      market_score: result.marketScore,
      risk_score: result.riskScore,
      summary: result.summary,
      key_evidence: result.keyEvidence || [],
      key_risks: result.keyRisks || [],
      next_catalyst: result.nextCatalyst,
      market_price: result.marketPrice,
      market_price_as_of: result.marketPriceAsOf,
      provider: result.provider,
      raw_context: result.rawContext || {},
      user_decision_at_analysis: position.current_decision,
      disagreement: result.recommendation !== position.current_decision,
    };
    const { data: saved, error } = await supabase.from('analysis_snapshots').insert(row).select().single();
    if(error) throw error;
    renderSnapshot(panel,saved,position.current_decision);
    status.textContent='Snapshot saved.';
  }catch(e){
    status.textContent=`Analysis failed: ${e?.message || e}`;
  }finally{
    btn.disabled=false; btn.textContent='Analyze Now';
  }
}

async function mount(){
  if(!document.querySelector('.decisionhero')) return;
  if(document.querySelector('#system-recommendation-panel')) return;
  const position = await findVisiblePosition();
  if(!position) return;
  const panel=document.createElement('section');
  panel.id='system-recommendation-panel'; panel.className='panel system-rec';
  panel.innerHTML=`<div class="system-rec-title"><div><h2>System Recommendation <span class="beta">FREE</span></h2><p>Rule-based view from current price, trend, your target, thesis status and latest structured review.</p></div><button class="primary analyze-now">Analyze Now</button></div><div class="rec-status"></div><div class="rec-result"></div>`;
  const hero=document.querySelector('.decisionhero');
  hero.insertAdjacentElement('afterend',panel);
  panel.querySelector('.analyze-now').addEventListener('click',()=>analyze(panel,position));
  try{ renderSnapshot(panel,await latestSnapshot(position.id),position.current_decision); }catch(e){ panel.querySelector('.rec-status').textContent=e.message; }
}

let timer;
const observer=new MutationObserver(()=>{ clearTimeout(timer); timer=setTimeout(()=>mount().catch(()=>{}),120); });
observer.observe(document.body,{childList:true,subtree:true});
mount().catch(()=>{});
