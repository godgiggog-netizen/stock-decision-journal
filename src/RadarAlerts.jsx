import React, { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from './lib/supabase';
import { listRadarAlerts } from './lib/radarRepository';
import './radar.css';

const DEMO_ALERTS = [
  {
    id: 'demo-hive', ticker: 'HIVE', company: 'HIVE Digital Technologies', theme: 'AI Infrastructure + Bitcoin Mining',
    stage: 'CONFIRMED', verdict: 'HIGH PRIORITY', radar_score: 84, entry_status: 'WAIT FOR CONFIRMATION',
    thesis_direction: 'STRONGER', alert_time: '2026-08-16T00:00:00Z', price_at_alert: null,
    what_changed: 'GPU Cloud ARR reached about $110M live + contracted, with a $200M management target for Q4 2026.',
    story: 'The business is shifting from a Bitcoin miner with AI optionality toward a hybrid digital infrastructure platform.',
    key_trigger: 'Confirm deployment economics, HPC margin and funding needs after the Aug 17 earnings call.',
    primary_risk: 'Execution and dilution while funding rapid AI/HPC expansion.',
    radar_followups: [1,7,30,90].map((d) => ({ checkpoint_days: d, checkpoint_date: `2026-${d === 1 ? '08-17' : d === 7 ? '08-23' : d === 30 ? '09-15' : '11-14'}`, completed: false }))
  },
  {
    id: 'demo-iren', ticker: 'IREN', company: 'IREN', theme: 'AI Cloud + Data Centers',
    stage: 'CONFIRMED', verdict: 'HIGH PRIORITY', radar_score: 89, entry_status: 'WAIT FOR CONFIRMATION',
    thesis_direction: 'STRONGER', alert_time: '2026-08-16T01:00:00Z', price_at_alert: null,
    what_changed: 'Horizon 1 was delivered and accepted, reducing execution risk on the AI Cloud build-out.',
    story: 'The thesis is moving from contracted AI capacity toward demonstrated delivery and customer acceptance.',
    key_trigger: 'FY2026 results on Aug 27: AI Cloud revenue, margin, CapEx, funding and Horizon 2-4 schedule.',
    primary_risk: 'High CapEx and financing needs may compress equity returns even if AI revenue grows.',
    radar_followups: [1,7,30,90].map((d) => ({ checkpoint_days: d, checkpoint_date: `2026-${d === 1 ? '08-17' : d === 7 ? '08-23' : d === 30 ? '09-15' : '11-14'}`, completed: false }))
  },
  {
    id: 'demo-nbis', ticker: 'NBIS', company: 'Nebius Group', theme: 'AI Infrastructure',
    stage: 'CONFIRMED', verdict: 'HIGH PRIORITY', radar_score: 88, entry_status: 'WAIT FOR PULLBACK',
    thesis_direction: 'STRONGER', alert_time: '2026-08-12T14:00:00Z', price_at_alert: null,
    what_changed: 'Demand visibility improved sharply through large contracts and capacity expansion.',
    story: 'Nebius is moving from a capacity-build story toward contracted demand with increasing revenue visibility.',
    key_trigger: 'Additional contracted capacity, backlog conversion and funding discipline.',
    primary_risk: 'Entry risk after a large post-earnings price move.',
    radar_followups: [1,7,30,90].map((d) => ({ checkpoint_days: d, checkpoint_date: `2026-${d === 1 ? '08-13' : d === 7 ? '08-19' : d === 30 ? '09-11' : '11-10'}`, completed: d === 1 }))
  }
];

const fmtDate = (v) => v ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '—';
const scoreClass = (n) => n >= 85 ? 'score-hot' : n >= 80 ? 'score-priority' : 'score-watch';

function Badge({ children, tone = '' }) {
  return <span className={`radar-badge ${tone}`}>{children}</span>;
}

export default function RadarAlerts() {
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [selectedId, setSelectedId] = useState(DEMO_ALERTS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    setLoading(true);
    listRadarAlerts()
      .then((rows) => {
        if (!alive) return;
        if (rows.length) {
          setAlerts(rows);
          setSelectedId(rows[0].id);
        }
      })
      .catch((e) => {
        if (alive) setError(`Radar tables are not ready yet: ${e.message}`);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => filter === 'ALL' ? alerts : alerts.filter((a) => a.stage === filter), [alerts, filter]);
  const selected = alerts.find((a) => a.id === selectedId) || filtered[0] || alerts[0];
  const due = alerts.flatMap((a) => (a.radar_followups || []).map((f) => ({ ...f, ticker: a.ticker }))).filter((f) => !f.completed).sort((a,b) => a.checkpoint_date.localeCompare(b.checkpoint_date));
  const priorityCount = alerts.filter((a) => Number(a.radar_score) >= 80).length;
  const strongerCount = alerts.filter((a) => a.thesis_direction === 'STRONGER').length;

  return <div className="radar-page">
    <div className="page-head radar-head">
      <div><h1>Radar Alerts</h1><p>Separate opportunity quality from entry timing, then follow every alert to +90 days.</p></div>
      <div className="radar-live"><span></span>{loading ? 'Loading' : isSupabaseConfigured ? 'Supabase connected' : 'Demo mode'}</div>
    </div>

    {error && <div className="radar-warning">{error} Showing demo records so the screen remains usable.</div>}

    <div className="metrics radar-metrics">
      <div className="metric"><span>Total Alerts</span><strong>{alerts.length}</strong></div>
      <div className="metric"><span>Priority ≥ 80</span><strong>{priorityCount}</strong></div>
      <div className="metric"><span>Thesis Stronger</span><strong>{strongerCount}</strong></div>
      <div className="metric"><span>Next Follow-up</span><strong>{due[0] ? `${due[0].ticker} +${due[0].checkpoint_days}` : 'Clear'}</strong></div>
    </div>

    <div className="radar-toolbar">
      {['ALL','EARLY','CONFIRMED','CROWDED'].map((x) => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{x}</button>)}
    </div>

    <div className="radar-layout">
      <section className="panel radar-list-panel">
        <div className="radar-section-title"><h2>Opportunity Queue</h2><span>{filtered.length} records</span></div>
        <div className="radar-alert-list">
          {filtered.map((a) => <button key={a.id} className={`radar-alert-row ${selected?.id === a.id ? 'selected' : ''}`} onClick={() => setSelectedId(a.id)}>
            <div className="ticker-block"><strong>{a.ticker}</strong><small>{a.company || ''}</small></div>
            <div className="alert-mid"><div><Badge tone={a.stage?.toLowerCase()}>{a.stage}</Badge><Badge>{a.entry_status || 'UNSET'}</Badge></div><p>{a.what_changed}</p></div>
            <div className={`radar-score ${scoreClass(Number(a.radar_score))}`}><strong>{Number(a.radar_score).toFixed(0)}</strong><span>/100</span></div>
          </button>)}
        </div>
      </section>

      {selected && <section className="panel radar-detail">
        <div className="radar-detail-head">
          <div><span className="eyebrow">{selected.theme || selected.sector || 'US EQUITY'}</span><h2>{selected.ticker} <small>{selected.company}</small></h2></div>
          <div className={`radar-score large ${scoreClass(Number(selected.radar_score))}`}><strong>{Number(selected.radar_score).toFixed(0)}</strong><span>/100</span></div>
        </div>

        <div className="radar-badge-line">
          <Badge tone={selected.stage?.toLowerCase()}>{selected.stage}</Badge>
          <Badge tone="priority">{selected.verdict}</Badge>
          <Badge>{selected.entry_status || 'ENTRY UNSET'}</Badge>
          <Badge tone={selected.thesis_direction === 'STRONGER' ? 'stronger' : ''}>{selected.thesis_direction || 'UNCHANGED'}</Badge>
        </div>

        <div className="radar-detail-grid">
          <article><h3>What Changed</h3><p>{selected.what_changed || '—'}</p></article>
          <article><h3>Story</h3><p>{selected.story || selected.emerging_narrative || '—'}</p></article>
          <article><h3>Key Trigger</h3><p>{selected.key_trigger || '—'}</p></article>
          <article><h3>Primary Risk</h3><p>{selected.primary_risk || selected.bear_case || '—'}</p></article>
        </div>

        <div className="decision-strip">
          <div><span>Alert date</span><strong>{fmtDate(selected.alert_time)}</strong></div>
          <div><span>Price at alert</span><strong>{selected.price_at_alert ? `$${Number(selected.price_at_alert).toFixed(2)}` : 'Not recorded'}</strong></div>
          <div><span>Entry status</span><strong>{selected.entry_status || 'Not set'}</strong></div>
          <div><span>Action</span><strong>{selected.current_action || 'WATCH'}</strong></div>
        </div>

        <div className="followup-box">
          <h3>Follow-up checkpoints</h3>
          <div className="followup-track">{[1,7,30,90].map((days) => {
            const f = (selected.radar_followups || []).find((x) => Number(x.checkpoint_days) === days);
            return <div key={days} className={`followup-step ${f?.completed ? 'done' : ''}`}><span>+{days}</span><strong>{f ? fmtDate(f.checkpoint_date) : 'Pending'}</strong><small>{f?.completed ? 'Completed' : 'Scheduled'}</small></div>;
          })}</div>
        </div>
      </section>}
    </div>
  </div>;
}
