/* global React, StackedRow */

const { useMemo: useMemoSv } = React;

const PALETTE_SCALE = ['#1F7A4D', '#4D9D6F', '#B47A0F', '#D49B36', '#B53A2A'];
const PALETTE_BINARY = ['#1F7A4D', '#B53A2A'];

const CONTEXT_META = {
  pickup:   { label: 'Pickup',   sub: 'At the restaurant / collection point', icon: '◐', color: '#0B0B0F' },
  dropoff:  { label: 'Dropoff',  sub: 'At the customer / delivery building',  icon: '◑', color: '#5C4E8A' },
  overall:  { label: 'Overall',  sub: 'Whole-trip judgement',                 icon: '●', color: '#00B8D4' },
};
const CONTEXT_ORDER = ['pickup', 'dropoff', 'overall'];

function SurveyPage({ tweaks }) {
  const { orders, SURVEY_Q, SURVEY_KEYS } = window.RI;
  const categories = (tweaks && tweaks.questionCategories) || {};
  const viewMode = (tweaks && tweaks.viewMode) || 'grouped';
  const contextFilter = (tweaks && tweaks.contextFilter) || 'all';

  // current category for each key (tweak override > default)
  const getCtx = (k) => categories[k] || SURVEY_Q[k]?.defaultContext || 'overall';

  const dist = useMemoSv(() => {
    const out = {};
    for (const k of SURVEY_KEYS) out[k] = {};
    for (const o of orders) {
      if (!o.survey_responses) continue;
      for (const [k, v] of Object.entries(o.survey_responses)) {
        out[k][v] = (out[k][v] || 0) + 1;
      }
    }
    return out;
  }, []);

  // group keys by context
  const grouped = useMemoSv(() => {
    const g = { pickup: [], dropoff: [], overall: [] };
    for (const k of SURVEY_KEYS) {
      const c = getCtx(k);
      if (!g[c]) g[c] = [];
      g[c].push(k);
    }
    return g;
  }, [categories]);

  const ct1 = useMemoSv(() => crosstab(orders, 'hidden', 'stackd'), []);
  const ct2 = useMemoSv(() => crosstab(orders, 'stress', 'floors'), []);

  const regret = useMemoSv(() => {
    const factors = ['stress', 'rwait', 'hidden', 'stackd', 'nav', 'bconf', 'btype', 'cresp', 'lift', 'floors'];
    return factors.map(f => {
      let regret = 0, regretN = 0, fine = 0, fineN = 0;
      for (const o of orders) {
        if (!o.survey_responses) continue;
        const isRegret = o.survey_responses.worth === 'no' || o.survey_responses.again === 'no';
        const isFine = o.survey_responses.worth === 'yes' && o.survey_responses.again === 'yes';
        const v = o.survey_responses[f];
        if (!v) continue;
        const score = scoreSurveyAnswer(f, v);
        if (score == null) continue;
        if (isRegret) { regret += score; regretN++; }
        if (isFine) { fine += score; fineN++; }
      }
      const lift = regretN && fineN ? (regret / regretN) - (fine / fineN) : 0;
      return { factor: f, lift, regretN, fineN, ctx: getCtx(f) };
    }).sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
  }, [categories]);

  const visibleContexts = contextFilter === 'all' ? CONTEXT_ORDER : [contextFilter];

  // per-context distribution stats
  const ctxStats = useMemoSv(() => {
    const stats = {};
    for (const ctx of CONTEXT_ORDER) {
      const keys = grouped[ctx] || [];
      let total = 0;
      for (const k of keys) total += Object.values(dist[k] || {}).reduce((s, v) => s + v, 0);
      stats[ctx] = { questionCount: keys.length, responseCount: total };
    }
    return stats;
  }, [grouped]);

  return (
    <div className="page">
      {/* per-context summary strip */}
      <div className="section-h">
        <div className="lbl">Survey responses · 23 questions across pickup, dropoff and overall context</div>
        <div className="hint">use Tweaks to reassign a question's context</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
        {CONTEXT_ORDER.map(ctx => {
          const m = CONTEXT_META[ctx]; const s = ctxStats[ctx];
          const active = visibleContexts.includes(ctx);
          return (
            <div key={ctx} className="card" style={{ opacity: active ? 1 : 0.45, transition: 'opacity .2s', borderLeft: `3px solid ${m.color}` }}>
              <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-2)' }}>{m.label} context</div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 4 }}>{s.questionCount} <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 400, marginLeft: 4 }}>questions · {s.responseCount} responses</span></div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{m.sub}</div>
                </div>
                <span style={{ color: m.color, fontSize: 22, lineHeight: 1 }}>{m.icon}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* questions */}
      {viewMode === 'grouped' ? (
        visibleContexts.map(ctx => {
          const keys = grouped[ctx] || [];
          if (keys.length === 0) return null;
          const m = CONTEXT_META[ctx];
          return (
            <div key={ctx} style={{ marginTop: 10 }}>
              <div className="section-h">
                <div className="lbl" style={{ color: m.color }}>
                  <span style={{ marginRight: 6 }}>{m.icon}</span>
                  {m.label} questions · {keys.length}
                </div>
                <div className="hint">{m.sub}</div>
              </div>
              <div className="survey-grid">
                {keys.map(k => <QuestionCard key={k} qkey={k} q={SURVEY_Q[k]} counts={dist[k]} contextColor={m.color} />)}
              </div>
            </div>
          );
        })
      ) : (
        <div className="survey-grid">
          {SURVEY_KEYS.filter(k => contextFilter === 'all' || getCtx(k) === contextFilter).map(k => {
            const ctx = getCtx(k);
            return <QuestionCard key={k} qkey={k} q={SURVEY_Q[k]} counts={dist[k]} contextColor={CONTEXT_META[ctx].color} contextLabel={CONTEXT_META[ctx].label} />;
          })}
        </div>
      )}

      <div className="section-h"><div className="lbl">Cross-tabs · friction signals across context</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <CrosstabCard title="hidden minutes × stacked delay" subtitle={`${CONTEXT_META[getCtx('hidden')].label} × ${CONTEXT_META[getCtx('stackd')].label}`} matrix={ct1} xKey="stackd" yKey="hidden" />
        <CrosstabCard title="stress × floors" subtitle={`${CONTEXT_META[getCtx('stress')].label} × ${CONTEXT_META[getCtx('floors')].label}`} matrix={ct2} xKey="floors" yKey="stress" />
      </div>

      <div className="section-h">
        <div className="lbl">Regret predictors</div>
        <div className="hint">lift = avg severity (regretted) − avg severity (satisfied) · colored by context</div>
      </div>
      <div className="card">
        <div className="card-body">
          {regret.map(r => {
            const ctxColor = CONTEXT_META[r.ctx].color;
            return (
              <div key={r.factor} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 90px', gap: 12, padding: '6px 0', alignItems: 'center', borderBottom: '1px dashed var(--hair)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, background: ctxColor, borderRadius: '50%' }}></span>
                  <span className="mono" style={{ textTransform: 'uppercase', fontSize: 11 }}>{r.factor}</span>
                  <span className="mono tiny muted">{CONTEXT_META[r.ctx].label.toLowerCase()}</span>
                </div>
                <div style={{ position: 'relative', height: 14, background: 'var(--surface-2)', borderRadius: 3 }}>
                  {r.lift > 0 ? (
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: Math.min(50, Math.abs(r.lift) * 40) + '%', background: 'var(--skip)' }}></div>
                  ) : (
                    <div style={{ position: 'absolute', right: '50%', top: 0, bottom: 0, width: Math.min(50, Math.abs(r.lift) * 40) + '%', background: 'var(--accept)' }}></div>
                  )}
                  <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--ink)' }}></div>
                </div>
                <div className="mono tiny" style={{ textAlign: 'right' }}>
                  {r.lift > 0 ? '+' : ''}{r.lift.toFixed(2)} <span className="muted">n={r.regretN + r.fineN}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ qkey, q, counts, contextColor, contextLabel }) {
  if (!q) return null;
  const opts = q.opts.filter(o => o !== 'skip');
  const c = counts || {};
  const total = Object.values(c).reduce((s, v) => s + v, 0);
  const palette = opts.length === 2 ? PALETTE_BINARY
    : opts.length === 3 ? ['#1F7A4D', '#B47A0F', '#B53A2A']
    : PALETTE_SCALE.slice(0, opts.length);
  const segs = opts.map((o, i) => ({ label: o, value: c[o] || 0, color: palette[i] || '#0B0B0F' }));
  return (
    <div className="survey-cell" style={{ borderTop: `2px solid ${contextColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="q">{qkey}</div>
        {contextLabel && (
          <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: contextColor, background: contextColor + '14', padding: '1px 5px', borderRadius: 3 }}>{contextLabel}</div>
        )}
      </div>
      <div className="question">{q.q}</div>
      <StackedRow segments={segs} total={Math.max(1, total)} height={14} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {opts.map((o, i) => total > 0 && c[o] > 0 && (
          <div key={o} style={{ fontSize: 10, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, background: palette[i], borderRadius: 1 }}></span>
            {o} <span className="muted">{(c[o] / total * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <div className="muted mono tiny" style={{ marginTop: 6 }}>n={total}</div>
    </div>
  );
}

function CrosstabCard({ title, subtitle, matrix, xKey, yKey }) {
  const ys = Object.keys(matrix);
  const xs = Array.from(new Set(ys.flatMap(y => Object.keys(matrix[y]))));
  const max = Math.max(...ys.flatMap(y => Object.values(matrix[y])), 1);
  return (
    <div className="card">
      <div className="card-head">
        <span className="label">{title}</span>
        {subtitle && <span className="muted mono tiny">{subtitle}</span>}
      </div>
      <div className="card-body">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--mono)' }}>
          <thead>
            <tr>
              <th style={{ padding: 4, textAlign: 'left', color: 'var(--ink-3)' }}>{yKey} ↓ / {xKey} →</th>
              {xs.map(x => <th key={x} style={{ padding: 4, color: 'var(--ink-3)' }}>{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {ys.map(y => (
              <tr key={y}>
                <td style={{ padding: 4, color: 'var(--ink-2)' }}>{y}</td>
                {xs.map(x => {
                  const v = matrix[y][x] || 0;
                  const intensity = v / max;
                  return (
                    <td key={x} className="corr-cell" style={{
                      background: `rgba(0, 184, 212, ${intensity * 0.6 + 0.04})`,
                      color: intensity > 0.5 ? '#003843' : 'var(--ink-2)',
                    }}>{v || ''}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function crosstab(orders, k1, k2) {
  const m = {};
  for (const o of orders) {
    const a = o.survey_responses?.[k1]; const b = o.survey_responses?.[k2];
    if (!a || !b) continue;
    if (!m[a]) m[a] = {};
    m[a][b] = (m[a][b] || 0) + 1;
  }
  return m;
}

function scoreSurveyAnswer(key, value) {
  const ord = {
    stress:  { low: 1, medium: 2, high: 3 },
    rwait:   { lt2: 1, '2-5': 2, '5-10': 3, '10-20': 4, gt20: 5 },
    hidden:  { '0': 0, '1-3': 1, '3-8': 2, gt8: 3 },
    stackd:  { none: 0, '1-3m': 1, '3-8m': 2, gt8m: 3 },
    nav:     { easy: 1, ok: 2, hard: 3 },
    bconf:   { no: 1, a_bit: 2, very: 3 },
    btype:   { house: 1, flat_low: 2, flat_mid: 3, tower: 4, office: 2 },
    cresp:   { fast: 1, medium: 2, slow: 3, no_response: 4 },
    lift:    { yes: 1, no: 3, broken: 4 },
    floors:  { ground: 0, '1-3': 1, '4-6': 2, '7+': 3 },
  };
  return ord[key]?.[value];
}

Object.assign(window, { SurveyPage, CONTEXT_META, CONTEXT_ORDER });
