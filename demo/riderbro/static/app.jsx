/* global React, ReactDOM, Sidebar, OverviewPage, RidersPage, SpatialPage, SurveyPage, PipelinePage, LivePage, OrderDrawer, Stat, Histogram, VerdictChip, Scatter, fmtTime, Icon, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton, CONTEXT_META, CONTEXT_ORDER */

const { useState, useEffect, useMemo } = React;

// Catches page-level render errors so a broken page shows a banner instead of
// blanking the entire dashboard. Resets when the page changes (we key on page).
class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('page render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title">This page hit a render error.</div>
            <div className="card-subtitle">
              Details in the browser console. Switching tabs and back will retry.
            </div>
            <pre style={{
              marginTop: 12, fontSize: 11, color: 'var(--ink-3)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'JetBrains Mono, monospace',
            }}>{String(this.state.error && this.state.error.stack || this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PAGE_TITLES = {
  overview:  ['OPERATE', 'Overview',   'Top-of-funnel signals across all riders and orders.'],
  live:      ['OPERATE', 'Live feed',  'Real-time view of incoming orders and active riders.'],
  riders:    ['OPERATE', 'Riders',     'Per-rider drill-down — timeline, location, survey profile.'],
  spatial:   ['ANALYSE', 'Spatial',    'Pickups, dropoffs, area-level economics.'],
  hunting:   ['ANALYSE', 'Hunting',    'Where to position — pickup density + OSM venues.'],
  survey:    ['ANALYSE', 'Surveys',    'Post-delivery survey distributions and regret predictors.'],
  decisions: ['ANALYSE', 'Decisions',  'Calibration · overrides · predicted vs realised.'],
  pipeline:  ['SYSTEM',  'Pipeline',   'OCR / VLM / routing latency and error analytics.'],
};

function App() {
  const [page, setPage] = useState('overview');
  const [order, setOrder] = useState(null);  // open order drawer
  const [rider, setRider] = useState(null);  // open in riders page
  const [range, setRange] = useState('7d');
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  // open rider routes to /riders with that rider selected
  useEffect(() => {
    if (rider) setPage('riders');
  }, [rider]);

  const [crumb, title, desc] = PAGE_TITLES[page];
  const liveCount = useMemo(() => window.RI.riders.filter(r => r.live).length, []);

  return (
    <div className="app">
      <Sidebar
        current={page}
        onNav={(p) => { setPage(p); setRider(null); }}
        liveCount={liveCount}
        riderCount={window.RI.riders.length}
      />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumb">{crumb}</div>
            <div className="title">{title} <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{desc}</span></div>
          </div>
          <div className="right">
            {['overview', 'spatial', 'survey', 'decisions', 'pipeline'].includes(page) && (
              <div className="range-picker">
                {['24h', '7d', '30d'].map(r => (
                  <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>
                ))}
              </div>
            )}
            <button className="icon-btn" title="Reload data"><Icon name="reload" size={13} /></button>
            <button className="icon-btn" title="Export CSV"><Icon name="export" size={13} /></button>
            <button className="btn" style={{ marginLeft: 4 }}>
              <Icon name="search" size={12} /> Search <span className="kbd">⌘K</span>
            </button>
          </div>
        </header>

        <PageErrorBoundary key={page}>
          {page === 'overview'  && <OverviewPage openOrder={setOrder} openRider={setRider} range={range} />}
          {page === 'live'      && <LivePage openOrder={setOrder} />}
          {page === 'riders'    && <RidersPage openOrder={setOrder} initialRider={rider} />}
          {page === 'spatial'   && <SpatialPage openOrder={setOrder} />}
          {page === 'hunting'   && <HuntingPage />}
          {page === 'survey'    && <SurveyPage tweaks={t} />}
          {page === 'decisions' && <DecisionsPage openOrder={setOrder} range={range} />}
          {page === 'pipeline'  && <PipelinePage />}
        </PageErrorBoundary>

        {order && <OrderDrawer order={order} onClose={() => setOrder(null)} />}
      </main>

      <TweaksPanel title="RiderIntel · tweaks">
        <TweakSection label="Survey · view" />
        <TweakRadio
          label="Layout"
          value={t.viewMode}
          options={[{ value: 'grouped', label: 'Grouped' }, { value: 'flat', label: 'Flat' }]}
          onChange={(v) => setTweak('viewMode', v)}
        />
        <TweakSelect
          label="Show context"
          value={t.contextFilter}
          options={[
            { value: 'all', label: 'All contexts' },
            { value: 'pickup', label: '◐ Pickup only' },
            { value: 'dropoff', label: '◑ Dropoff only' },
            { value: 'overall', label: '● Overall only' },
          ]}
          onChange={(v) => setTweak('contextFilter', v)}
        />

        <TweakSection label={`Pickup questions · ${countCtx(t.questionCategories, 'pickup')}`} />
        {qsForCtx('pickup').map(k => (
          <TweakRadio
            key={k}
            label={k}
            value={t.questionCategories[k] || window.RI.SURVEY_Q[k]?.defaultContext}
            options={[{ value: 'pickup', label: 'P' }, { value: 'dropoff', label: 'D' }, { value: 'overall', label: 'O' }]}
            onChange={(v) => setTweak('questionCategories', { ...t.questionCategories, [k]: v })}
          />
        ))}

        <TweakSection label={`Dropoff questions · ${countCtx(t.questionCategories, 'dropoff')}`} />
        {qsForCtx('dropoff').map(k => (
          <TweakRadio
            key={k}
            label={k}
            value={t.questionCategories[k] || window.RI.SURVEY_Q[k]?.defaultContext}
            options={[{ value: 'pickup', label: 'P' }, { value: 'dropoff', label: 'D' }, { value: 'overall', label: 'O' }]}
            onChange={(v) => setTweak('questionCategories', { ...t.questionCategories, [k]: v })}
          />
        ))}

        <TweakSection label={`Overall questions · ${countCtx(t.questionCategories, 'overall')}`} />
        {qsForCtx('overall').map(k => (
          <TweakRadio
            key={k}
            label={k}
            value={t.questionCategories[k] || window.RI.SURVEY_Q[k]?.defaultContext}
            options={[{ value: 'pickup', label: 'P' }, { value: 'dropoff', label: 'D' }, { value: 'overall', label: 'O' }]}
            onChange={(v) => setTweak('questionCategories', { ...t.questionCategories, [k]: v })}
          />
        ))}

        <TweakSection label="Reset" />
        <TweakButton
          label="Restore default category mapping"
          secondary
          onClick={() => {
            const defaults = {};
            for (const k of window.RI.SURVEY_KEYS) {
              defaults[k] = window.RI.SURVEY_Q[k].defaultContext;
            }
            setTweak('questionCategories', defaults);
          }}
        />
      </TweaksPanel>
    </div>
  );
}

// helpers for the tweak panel
function qsForCtx(ctx) {
  // group questions by their CURRENT context (from tweaks defaults)
  // — keeps the panel sections stable on first render
  const defaults = window.TWEAK_DEFAULTS?.questionCategories || {};
  const keys = window.RI.SURVEY_KEYS || [];
  return keys.filter(k => (defaults[k] || window.RI.SURVEY_Q[k]?.defaultContext) === ctx);
}
function countCtx(cats, ctx) {
  let n = 0;
  for (const k of window.RI.SURVEY_KEYS) {
    if ((cats[k] || window.RI.SURVEY_Q[k]?.defaultContext) === ctx) n++;
  }
  return n;
}

// ---- Decisions page (my IA pushback — this is where the actual product
// learning happens: did riders override us? did predicted £/hr match? etc.)
function DecisionsPage({ openOrder, range }) {
  const { orders } = window.RI;
  const ms = range === '24h' ? 24 * 3600e3 : range === '7d' ? 7 * 24 * 3600e3 : 30 * 24 * 3600e3;
  const cutoff = Date.now() - ms;
  const fOrders = useMemo(() => orders.filter(o => o.received_at >= cutoff), [range]);

  // override metrics
  const overrides = useMemo(() => {
    let acceptedSkip = 0, rejectedAccept = 0, agreed = 0, total = 0;
    for (const o of fOrders) {
      if (o.verdict === 'manual_check') continue;
      total++;
      const recommended = o.verdict === 'accept';
      if (recommended && !o.accepted) rejectedAccept++;
      else if (!recommended && o.verdict === 'skip' && o.accepted) acceptedSkip++;
      else agreed++;
    }
    return { acceptedSkip, rejectedAccept, agreed, total };
  }, [fOrders]);

  // thumbs accuracy by verdict
  const accuracyByVerdict = useMemo(() => {
    const acc = {};
    for (const o of fOrders) {
      if (o.thumbs === 0) continue;
      if (!acc[o.verdict]) acc[o.verdict] = { up: 0, total: 0 };
      acc[o.verdict].total++;
      if (o.thumbs === 1) acc[o.verdict].up++;
    }
    return acc;
  }, [fOrders]);

  // pph vs distance scatter
  const scatterPts = useMemo(() => fOrders.slice(0, 200).map(o => [
    o.route_distance_m / 1000,
    o.pounds_per_hour,
    3,
    { accept: '#1F7A4D', borderline: '#B47A0F', skip: '#B53A2A', manual_check: '#5C4E8A' }[o.verdict],
  ]), [fOrders]);

  // accept rate by hour of day — does the rec drift away from human behavior at certain times?
  const hourlyAccept = useMemo(() => {
    const acc = Array(24).fill(0).map(() => ({ recAccept: 0, humAccept: 0, total: 0 }));
    for (const o of fOrders) {
      const h = new Date(o.received_at).getHours();
      acc[h].total++;
      if (o.verdict === 'accept') acc[h].recAccept++;
      if (o.accepted) acc[h].humAccept++;
    }
    return acc;
  }, [fOrders]);

  return (
    <div className="page">
      <div className="section-h">
        <div className="lbl">Override signals · the golden metric</div>
        <div className="hint">when the rider disagrees with us, we learn the most</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Stat label="agreed verdict" value={overrides.agreed} delta={overrides.total ? (overrides.agreed / overrides.total * 100).toFixed(0) + '%' : '—'} />
        <Stat label="we said accept, rider declined" value={overrides.rejectedAccept} deltaDir="down" sparkColor="var(--skip)" />
        <Stat label="we said skip, rider accepted" value={overrides.acceptedSkip} deltaDir="up" sparkColor="var(--signal)" />
        <Stat label="thumbs accuracy overall" value={fOrders.filter(o => o.thumbs === 1).length / Math.max(1, fOrders.filter(o => o.thumbs !== 0).length) * 100 | 0} unit="%" />
      </div>

      <div className="section-h"><div className="lbl">Thumbs accuracy by verdict</div></div>
      <div className="card">
        <div className="card-body">
          {Object.entries(accuracyByVerdict).map(([v, x]) => (
            <div key={v} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px', gap: 14, alignItems: 'center', padding: '7px 0', borderBottom: '1px dashed var(--hair)' }}>
              <div><VerdictChip v={v} /></div>
              <div style={{ height: 14, background: 'var(--surface-2)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (x.up / x.total * 100) + '%', background: 'var(--accept)' }}></div>
                <div style={{ position: 'absolute', left: (x.up / x.total * 100) + '%', top: 0, bottom: 0, right: 0, background: 'var(--skip-soft)' }}></div>
              </div>
              <div className="mono tiny" style={{ textAlign: 'right' }}>{(x.up / x.total * 100).toFixed(0)}% <span className="muted">n={x.total}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-h"><div className="lbl">£/hr vs route distance</div><div className="hint">colored by verdict · spot edge cases</div></div>
      <div className="card">
        <div className="card-body">
          <Scatter points={scatterPts} w={1100} h={260} xLabel="km" yLabel="£/hr" xDomain={[0, 14]} yDomain={[5, 28]} />
        </div>
      </div>

      <div className="section-h"><div className="lbl">Accept rate by hour · bot vs human</div><div className="hint">when do we diverge?</div></div>
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180 }}>
            {hourlyAccept.map((h, i) => {
              const rec = h.total ? h.recAccept / h.total : 0;
              const hum = h.total ? h.humAccept / h.total : 0;
              return (
                <div key={i} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                  <div title={'bot ' + (rec * 100).toFixed(0) + '%'} style={{ flex: 1, background: 'var(--ink)', height: (rec * 100) + '%', borderRadius: '2px 2px 0 0' }}></div>
                  <div title={'human ' + (hum * 100).toFixed(0) + '%'} style={{ flex: 1, background: 'var(--signal)', height: (hum * 100) + '%', borderRadius: '2px 2px 0 0' }}></div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 6 }}>
            {Array.from({ length: 24 }, (_, i) => <span key={i}>{(i + '').padStart(2, '0')}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, fontFamily: 'var(--mono)' }}>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: 'var(--ink)', marginRight: 5 }}></span>bot says accept</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: 'var(--signal)', marginRight: 5 }}></span>human accepted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wire up
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
