import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { isSupabaseConfigured } from './lib/supabase';
import {
  createPosition,
  createReview,
  getSession,
  importLocalPositions,
  listPositions,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from './lib/repository';

const DEMO = [
  {
    id: crypto.randomUUID(), ticker: 'NBIS', company: 'Nebius Group', buyDate: '2026-08-15', entryPrice: 32.10,
    amount: 10000, horizon: '24 months', reviewPlan: 30,
    thesis: 'AI infrastructure demand and capacity expansion can support durable growth.',
    expected: 'Revenue growth remains strong while capacity ramps.',
    target: 60, breakCondition: 'Growth slows materially for two consecutive quarters or capital efficiency deteriorates.',
    thesisStatus: 'VALID', decision: 'HOLD', lastReview: null, nextReview: '2026-09-14', reviews: []
  }
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + Number(days)); return d.toISOString().slice(0, 10); };

function App() {
  const [view, setView] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [positions, setPositions] = useState(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem('sdj_positions');
    return saved ? JSON.parse(saved) : DEMO;
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSession().then((s) => { setSession(s); setAuthReady(true); }).catch((e) => { setError(e.message); setAuthReady(true); });
    const { data: listener } = onAuthStateChange((s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem('sdj_positions', JSON.stringify(positions));
      return;
    }
    if (!session?.user) { setPositions([]); return; }
    refreshPositions();
  }, [session?.user?.id]);

  async function refreshPositions() {
    try {
      setLoading(true); setError('');
      setPositions(await listPositions());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const selected = positions.find((p) => p.id === selectedId) || positions[0];
  const counts = useMemo(() => ({
    active: positions.filter((p) => p.decision !== 'EXIT').length,
    valid: positions.filter((p) => p.thesisStatus === 'VALID' || p.thesisStatus === 'STRENGTHENING').length,
    risk: positions.filter((p) => p.thesisStatus === 'WEAKENING').length,
    due: positions.filter((p) => p.nextReview && p.nextReview <= todayISO()).length,
  }), [positions]);

  const nav = (v) => { setView(v); if (v === 'dashboard') setSelectedId(null); };

  async function addPosition(data) {
    try {
      setLoading(true); setError('');
      if (isSupabaseConfigured) {
        const id = await createPosition(session.user.id, data);
        await refreshPositions(); setSelectedId(id);
      } else {
        const id = crypto.randomUUID();
        const p = { ...data, id, thesisStatus: 'VALID', decision: 'HOLD', lastReview: null, nextReview: addDays(data.buyDate, data.reviewPlan), reviews: [] };
        setPositions((old) => [p, ...old]); setSelectedId(id);
      }
      setView('detail');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function saveReview(review) {
    try {
      setLoading(true); setError('');
      if (isSupabaseConfigured) {
        await createReview(session.user.id, selected, review);
        await refreshPositions();
      } else {
        setPositions((ps) => ps.map((p) => p.id === selected.id ? {
          ...p, thesisStatus: review.thesisStatus, decision: review.decision, lastReview: todayISO(),
          nextReview: addDays(todayISO(), p.reviewPlan), reviews: [{ ...review, date: todayISO() }, ...p.reviews]
        } : p));
      }
      setView('detail');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function migrateLocalData() {
    const raw = localStorage.getItem('sdj_positions');
    if (!raw || !session?.user) return;
    try {
      setLoading(true); setError('');
      const parsed = JSON.parse(raw);
      if (parsed.length) await importLocalPositions(session.user.id, parsed);
      localStorage.removeItem('sdj_positions');
      await refreshPositions();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (!authReady) return <div className="center-screen">Loading…</div>;
  if (isSupabaseConfigured && !session) return <AuthScreen onError={setError} error={error} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">📘 <span>Stock Decision<br />Journal</span></div>
      <button className={view === 'dashboard' ? 'active' : ''} onClick={() => nav('dashboard')}>Dashboard</button>
      <button className={view === 'new' ? 'active' : ''} onClick={() => nav('new')}>+ New Decision</button>
      <button className={view === 'review' ? 'active' : ''} disabled={!selected} onClick={() => setView('review')}>Review</button>
      <div className="sidebar-note">Focus on your decision, not just the price.</div>
      {isSupabaseConfigured && <button className="signout" onClick={() => signOut().catch((e) => setError(e.message))}>Sign out</button>}
    </aside>
    <main className="main">
      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-banner">Saving…</div>}
      {isSupabaseConfigured && localStorage.getItem('sdj_positions') && <div className="migration-banner">Local journal data found. <button onClick={migrateLocalData}>Import to account</button></div>}
      {view === 'dashboard' && <Dashboard positions={positions} counts={counts} onNew={() => setView('new')} onOpen={(id) => { setSelectedId(id); setView('detail'); }} />}
      {view === 'new' && <NewDecision onSave={addPosition} onCancel={() => setView('dashboard')} />}
      {view === 'detail' && selected && <DecisionCard p={selected} onBack={() => setView('dashboard')} onReview={() => setView('review')} />}
      {view === 'review' && selected && <Review p={selected} onSave={saveReview} onCancel={() => setView('detail')} />}
    </main>
  </div>;
}

function AuthScreen({ onError, error }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); onError(''); setMessage('');
    try {
      if (mode === 'signin') await signIn(email, password);
      else {
        const data = await signUp(email, password);
        if (!data.session) setMessage('Account created. Check your email to confirm your address, then sign in.');
      }
    } catch (err) { onError(err.message); }
    finally { setBusy(false); }
  };
  return <div className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="auth-brand">📘 Stock Decision Journal</div>
    <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
    <p>Keep the original reason behind every investment decision.</p>
    {error && <div className="error-banner">{error}</div>}
    {message && <div className="success-banner">{message}</div>}
    <Field label="Email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
    <Field label="Password"><input type="password" minLength="6" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
    <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
    <button type="button" className="link auth-switch" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button>
  </form></div>;
}

function Dashboard({ positions, counts, onNew, onOpen }) {
  return <><div className="page-head"><div><h1>Dashboard</h1><p>Every position should have a reason to own it and a reason to sell it.</p></div><button className="primary" onClick={onNew}>+ New Decision</button></div>
    <div className="metrics"><Metric label="Active Positions" value={counts.active} /><Metric label="Thesis Valid" value={counts.valid} /><Metric label="At Risk" value={counts.risk} /><Metric label="Review Due" value={counts.due} /></div>
    <section className="panel"><h2>My Positions</h2>{positions.length === 0 ? <div className="empty-state"><p>No investment decisions yet.</p><button className="primary" onClick={onNew}>Record your first decision</button></div> : <div className="table-wrap"><table><thead><tr><th>Ticker</th><th>Status</th><th>Entry</th><th>Amount</th><th>Next Review</th><th></th></tr></thead><tbody>{positions.map((p) => <tr key={p.id}><td><strong>{p.ticker}</strong><small>{p.company}</small></td><td><Status s={p.thesisStatus} /></td><td>${Number(p.entryPrice).toFixed(2)}</td><td>${Number(p.amount).toLocaleString()}</td><td>{p.nextReview || '—'}</td><td><button className="ghost" onClick={() => onOpen(p.id)}>View</button></td></tr>)}</tbody></table></div>}</section>
  </>;
}

const Metric = ({ label, value }) => <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
const Status = ({ s }) => <span className={'status ' + s.toLowerCase().replace(' ', '-')}>{s}</span>;
const Field = ({ label, children }) => <label className="field"><span>{label}</span>{children}</label>;

function NewDecision({ onSave, onCancel }) {
  const [f, setF] = useState({ ticker: '', company: '', buyDate: todayISO(), entryPrice: '', amount: '', horizon: '12 months', reviewPlan: 30, thesis: '', expected: '', target: '', breakCondition: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e) => { e.preventDefault(); if (!f.ticker || !f.entryPrice || !f.amount || !f.thesis || !f.breakCondition) return; onSave({ ...f, ticker: f.ticker.toUpperCase(), entryPrice: Number(f.entryPrice), amount: Number(f.amount), target: f.target ? Number(f.target) : null, reviewPlan: Number(f.reviewPlan) }); };
  return <form className="panel form" onSubmit={submit}><div className="page-head"><div><h1>New Decision</h1><p>Record the reason before the market rewrites the story for you.</p></div></div><div className="grid2">
    <Field label="Ticker *"><input value={f.ticker} onChange={(e) => set('ticker', e.target.value)} placeholder="NBIS" /></Field><Field label="Company"><input value={f.company} onChange={(e) => set('company', e.target.value)} placeholder="Nebius Group" /></Field><Field label="Buy date *"><input type="date" value={f.buyDate} onChange={(e) => set('buyDate', e.target.value)} /></Field><Field label="Entry price *"><input type="number" step="0.01" value={f.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} /></Field><Field label="Amount invested *"><input type="number" step="0.01" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field><Field label="Time horizon"><input value={f.horizon} onChange={(e) => set('horizon', e.target.value)} /></Field><Field label="Review every"><select value={f.reviewPlan} onChange={(e) => set('reviewPlan', e.target.value)}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></Field><Field label="Target price"><input type="number" step="0.01" value={f.target} onChange={(e) => set('target', e.target.value)} placeholder="Optional" /></Field>
  </div><Field label="Why did I buy this? *"><textarea value={f.thesis} onChange={(e) => set('thesis', e.target.value)} /></Field><Field label="Expected outcome"><textarea value={f.expected} onChange={(e) => set('expected', e.target.value)} /></Field><Field label="What would prove me wrong? *"><textarea className="danger-input" value={f.breakCondition} onChange={(e) => set('breakCondition', e.target.value)} /></Field><div className="actions"><button type="button" className="ghost" onClick={onCancel}>Cancel</button><button className="primary">Save Decision</button></div></form>;
}

function DecisionCard({ p, onBack, onReview }) {
  return <><div className="page-head"><div><button className="link" onClick={onBack}>← Back to portfolio</button><h1>{p.ticker}</h1><p>{p.company || 'Company name not set'}</p></div><button className="primary" onClick={onReview}>Add Review</button></div><div className="metrics"><Metric label="Entry Price" value={`$${Number(p.entryPrice).toFixed(2)}`} /><Metric label="Amount" value={`$${Number(p.amount).toLocaleString()}`} /><Metric label="Decision" value={p.decision} /><Metric label="Thesis" value={p.thesisStatus} /></div><div className="grid2"><section className="panel"><h2>Why I bought</h2><p>{p.thesis}</p><h3>Expected outcome</h3><p>{p.expected || 'Not recorded'}</p></section><section className="panel"><h2>Thesis break condition</h2><div className="risk-box">{p.breakCondition}</div><h3>Target / Horizon</h3><p>{p.target ? `$${p.target}` : 'No target'} · {p.horizon}</p></section></div><section className="panel"><h2>Decision History</h2>{p.reviews.length === 0 ? <p className="muted">No reviews yet.</p> : <div className="history">{p.reviews.map((r, i) => <div className="history-row" key={r.id || i}><strong>{r.date}</strong><Status s={r.thesisStatus} /><span>{r.decision}</span><span>{r.changed}</span></div>)}</div>}</section></>;
}

function Review({ p, onSave, onCancel }) {
  const [f, setF] = useState({ changed: '', thesisStatus: p.thesisStatus, risk: 'About the same', buyAgain: 'Maybe', decision: p.decision, notes: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return <form className="panel form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}><div className="page-head"><div><h1>Review: {p.ticker}</h1><p>Judge the thesis before judging the share price.</p></div></div><Field label="1. What changed since the last review?"><textarea required value={f.changed} onChange={(e) => set('changed', e.target.value)} /></Field><Field label="2. Is the original thesis still valid?"><select value={f.thesisStatus} onChange={(e) => set('thesisStatus', e.target.value)}><option>STRENGTHENING</option><option>VALID</option><option>WEAKENING</option><option>BROKEN</option></select></Field><Field label="3. Has downside risk changed?"><select value={f.risk} onChange={(e) => set('risk', e.target.value)}><option>Lower risk now</option><option>About the same</option><option>Higher risk now</option></select></Field><Field label="4. Would I buy this stock today?"><select value={f.buyAgain} onChange={(e) => set('buyAgain', e.target.value)}><option>Yes</option><option>Maybe</option><option>No</option></select></Field><Field label="5. My decision"><div className="decision-buttons">{['BUY MORE', 'HOLD', 'REDUCE', 'EXIT'].map((x) => <button type="button" key={x} className={f.decision === x ? 'selected' : ''} onClick={() => set('decision', x)}>{x}</button>)}</div></Field><Field label="Notes"><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field><div className="actions"><button type="button" className="ghost" onClick={onCancel}>Cancel</button><button className="primary">Save Review</button></div></form>;
}

createRoot(document.getElementById('root')).render(<App />);
