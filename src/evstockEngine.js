export function parseEvstockCommand(raw = '') {
  const text = String(raw).trim();
  const match = text.match(/^evstock\s+([A-Za-z.\-]{1,12})(?:\s+([A-Za-z]{3}))?$/i);
  if (!match) return null;
  return { ticker: match[1].toUpperCase(), currency: (match[2] || 'USD').toUpperCase() };
}

export function reportToRadarAlert(report) {
  if (!report?.ticker) throw new Error('EVSTOCK report is missing ticker');
  const d = report.decision || {};
  const r = report.radar || {};
  const price = report.market?.price ?? null;
  const sourceUrls = Array.isArray(report.sources) ? report.sources.map((s) => s.url).filter(Boolean) : [];

  return {
    alert_key: `evstock:${report.ticker}:${report.as_of || new Date().toISOString()}`,
    ticker: report.ticker,
    company: report.company || null,
    sector: report.sector || null,
    theme: report.theme || null,
    stage: r.stage || 'CONFIRMED',
    verdict: r.verdict || 'WATCH',
    radar_score: Math.max(0, Math.min(100, Number(r.score ?? 60))),
    what_changed: report.what_changed || report.narrative || 'EVSTOCK workflow run',
    story: report.narrative || null,
    fact_summary: report.summary || null,
    analysis_summary: report.analysis_summary || null,
    expectation_summary: report.expectation_summary || null,
    evidence_summary: report.evidence_summary || null,
    evidence_urls: sourceUrls,
    price_at_alert: price,
    bull_case: report.bull_case || null,
    bear_case: report.bear_case || null,
    thesis_breakers: report.thesis_breakers || [],
    business_quality: r.business_quality || null,
    thesis_direction: r.thesis_direction || 'UNCHANGED',
    entry_status: d.entry_status || 'WAIT FOR CONFIRMATION',
    entry_reason: d.reason || null,
    preferred_entry_price: d.preferred_entry_price ?? null,
    entry_zone_low: d.entry_zone_low ?? null,
    entry_zone_high: d.entry_zone_high ?? null,
    initial_position_pct: d.initial_position_pct ?? null,
    max_position_pct: d.max_position_pct ?? null,
    add_on_trigger: d.add_on_trigger || null,
    stop_or_thesis_exit: d.stop_or_thesis_exit || null,
    max_acceptable_loss_pct: d.max_acceptable_loss_pct ?? null,
    current_action: d.action || 'WATCH',
    decision_reason: d.reason || null,
  };
}

export function decisionLabel(report) {
  const d = report?.decision || {};
  return {
    action: d.action || 'WATCH',
    entry: d.entry_zone_low != null && d.entry_zone_high != null
      ? `$${Number(d.entry_zone_low).toFixed(2)} – $${Number(d.entry_zone_high).toFixed(2)}`
      : 'ยังไม่มีช่วงราคาที่น่าเชื่อถือ',
    target: d.target_price != null ? `$${Number(d.target_price).toFixed(2)}` : 'ยังไม่กำหนด',
    confidence: d.confidence || 'LOW',
  };
}
