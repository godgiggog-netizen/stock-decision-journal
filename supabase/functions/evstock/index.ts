import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const schema = {
  type: 'object', additionalProperties: false,
  required: ['ticker','company','currency','sector','theme','as_of','status','model','summary','analysis_summary','expectation_summary','evidence_summary','narrative','what_changed','market','valuation','deep','radar','decision','bull_case','bear_case','thesis_breakers','sources'],
  properties: {
    ticker:{type:'string'}, company:{type:'string'}, currency:{type:'string'}, sector:{type:['string','null']}, theme:{type:['string','null']},
    as_of:{type:'string'}, status:{type:'string',enum:['COMPLETED','PARTIAL']}, model:{type:'string'},
    summary:{type:'string'}, analysis_summary:{type:'string'}, expectation_summary:{type:'string'}, evidence_summary:{type:'string'}, narrative:{type:'string'}, what_changed:{type:'string'},
    market:{type:'object',additionalProperties:false,required:['price','price_as_of','technical_summary'],properties:{price:{type:['number','null']},price_as_of:{type:['string','null']},technical_summary:{type:'string'}}},
    valuation:{type:'object',additionalProperties:false,required:['fair_value_low','fair_value_high','bear_value','base_value','bull_value','summary'],properties:{fair_value_low:{type:['number','null']},fair_value_high:{type:['number','null']},bear_value:{type:['number','null']},base_value:{type:['number','null']},bull_value:{type:['number','null']},summary:{type:'string'}}},
    deep:{type:'object',additionalProperties:false,required:['demand','economics','execution','price'],properties:{demand:{type:['integer','null'],minimum:1,maximum:5},economics:{type:['integer','null'],minimum:1,maximum:5},execution:{type:['integer','null'],minimum:1,maximum:5},price:{type:['integer','null'],minimum:1,maximum:5}}},
    radar:{type:'object',additionalProperties:false,required:['stage','verdict','score','business_quality','thesis_direction'],properties:{stage:{type:'string',enum:['EARLY','CONFIRMED','CROWDED']},verdict:{type:'string',enum:['EARLY RADAR','WATCH','HIGH PRIORITY','MATERIAL CHANGE']},score:{type:'number',minimum:0,maximum:100},business_quality:{type:['string','null'],enum:['WEAK','IMPROVING','STRONG',null]},thesis_direction:{type:'string',enum:['STRONGER','UNCHANGED','WEAKER']}}},
    decision:{type:'object',additionalProperties:false,required:['action','entry_status','reason','preferred_entry_price','entry_zone_low','entry_zone_high','target_price','initial_position_pct','max_position_pct','add_on_trigger','stop_or_thesis_exit','max_acceptable_loss_pct','confidence'],properties:{action:{type:'string',enum:['WATCH','BUY','ADD','HOLD','REDUCE','SELL','IGNORE']},entry_status:{type:'string',enum:['BUY ZONE','WAIT FOR PULLBACK','WAIT FOR CONFIRMATION','EXTENDED','CROWDED','AVOID']},reason:{type:'string'},preferred_entry_price:{type:['number','null']},entry_zone_low:{type:['number','null']},entry_zone_high:{type:['number','null']},target_price:{type:['number','null']},initial_position_pct:{type:['number','null']},max_position_pct:{type:['number','null']},add_on_trigger:{type:'string'},stop_or_thesis_exit:{type:'string'},max_acceptable_loss_pct:{type:['number','null']},confidence:{type:'string',enum:['LOW','MEDIUM','HIGH']}}},
    bull_case:{type:'string'}, bear_case:{type:'string'}, thesis_breakers:{type:'array',items:{type:'string'}},
    sources:{type:'array',items:{type:'object',additionalProperties:false,required:['title','url','as_of','kind'],properties:{title:{type:'string'},url:{type:'string'},as_of:{type:['string','null']},kind:{type:'string',enum:['SEC','IR','NEWS','MARKET','OTHER']}}}}
  }
}

function extractText(r:any){
  if (typeof r?.output_text === 'string') return r.output_text
  for (const item of r?.output || []) for (const c of item?.content || []) if (c?.type === 'output_text' && c?.text) return c.text
  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY secret')
    const { ticker, currency = 'USD' } = await req.json()
    if (!/^[A-Za-z.\-]{1,12}$/.test(String(ticker || ''))) throw new Error('Invalid ticker')
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-terra'
    const today = new Date().toISOString()
    const prompt = `Run EVSTOCK for ${String(ticker).toUpperCase()} in ${String(currency).toUpperCase()} as of ${today}.
You are an evidence-first public-equity research agent. Research before concluding. Prioritize SEC filings and company Investor Relations for financial facts, then reputable market/news sources for current price and developments. Never invent a number. If a value cannot be verified, return null and lower confidence.

Required workflow: (1) identify company/exchange and latest reporting period, (2) audit current fundamentals and narrative, (3) assess five value drivers and valuation with explicit bear/base/bull assumptions, (4) assess current technical/entry context only from verifiable current market data, (5) score DEEP from 1-5 for Demand, Economics, Execution, Price, (6) produce a decision card with entry zone, target, position sizing guidance and thesis-based exit, (7) classify for the Stock Radar Journal. Distinguish company quality from entry quality. A great company may still be EXTENDED or WAIT FOR PULLBACK. Return at least 3 sources when possible and include direct URLs.`

    const res = await fetch('https://api.openai.com/v1/responses', {
      method:'POST', headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model,
        tools:[{type:'web_search'}],
        reasoning:{effort:'high'},
        input:prompt,
        text:{format:{type:'json_schema',name:'evstock_report',strict:true,schema}}
      })
    })
    const raw = await res.json()
    if (!res.ok) throw new Error(raw?.error?.message || `OpenAI error ${res.status}`)
    const text = extractText(raw)
    if (!text) throw new Error('No structured report returned')
    const report = JSON.parse(text)
    report.model = report.model || model
    return new Response(JSON.stringify({ report }), { headers:{...cors,'Content-Type':'application/json'} })
  } catch (e) {
    return new Response(JSON.stringify({ error:e.message || String(e) }), { status:400, headers:{...cors,'Content-Type':'application/json'} })
  }
})
