/* global React */
// Reusable UI primitives — Card, Stat, Sparkline, BarChart, Donut, etc.
// All rendered as inline SVG so they pop in any embed.

const { useState, useRef, useEffect, useMemo } = React;

function fmtNum(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(s) {
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60); const ss = Math.round(s - m * 60);
  return m + 'm ' + (ss < 10 ? '0' : '') + ss + 's';
}
function fmtPph(n) { return '£' + (n).toFixed(1) + '/hr'; }

function VerdictChip({ v }) {
  const map = {
    accept: ['chip-accept', 'Accept'],
    borderline: ['chip-borderline', 'Borderline'],
    skip: ['chip-skip', 'Skip'],
    manual_check: ['chip-manual', 'Manual'],
  };
  const [cls, lbl] = map[v] || ['chip-muted', v];
  return <span className={'chip ' + cls}>{lbl}</span>;
}

function Stat({ label, value, unit, delta, deltaDir, sparkData, sparkColor = 'var(--ink)' }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}{unit && <span className="unit">{unit}</span>}</div>
      {delta != null && (
        <div className="delta">
          <span className={deltaDir === 'up' ? 'up' : deltaDir === 'down' ? 'down' : ''}>
            {deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : ''} {delta}
          </span>
          <span style={{ color: 'var(--ink-3)' }}>vs prev</span>
        </div>
      )}
      {sparkData && <div className="spark"><Sparkline data={sparkData} color={sparkColor} /></div>}
    </div>
  );
}

function Sparkline({ data, color = 'var(--ink)', height = 28, fill = false }) {
  const ref = useRef(null);
  const [w, setW] = useState(120);
  useEffect(() => {
    if (!ref.current) return;
    const r = new ResizeObserver(e => setW(e[0].contentRect.width));
    r.observe(ref.current);
    return () => r.disconnect();
  }, []);
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
  const area = d + ` L${w},${height} L0,${height} Z`;
  return (
    <div ref={ref} style={{ width: '100%', height }} className="chart">
      <svg width={w} height={height}>
        {fill && <path d={area} fill={color} opacity="0.1" />}
        <path d={d} stroke={color} strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}

function HBarChart({ data, color = 'var(--ink)', max }) {
  const m = max || Math.max(...data.map(d => d.value));
  return (
    <div>
      {data.map((d, i) => (
        <div className="hbar-row" key={i}>
          <div className="lbl" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          <div className="bar"><span style={{ width: (d.value / m * 100) + '%', background: d.color || color }}></span></div>
          <div className="val">{d.display ?? d.value}</div>
        </div>
      ))}
    </div>
  );
}

function StackedBarTimeseries({ data, keys, colors, height = 160 }) {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const r = new ResizeObserver(e => setW(e[0].contentRect.width));
    r.observe(ref.current);
    return () => r.disconnect();
  }, []);
  const pad = { l: 28, r: 10, t: 10, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const totals = data.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0));
  const max = Math.max(...totals, 1);
  const bw = innerW / data.length;
  const ticks = [0, max / 2, max].map(Math.round);
  return (
    <div ref={ref} style={{ width: '100%', height }} className="chart">
      <svg width={w} height={height}>
        {ticks.map((t, i) => {
          const y = pad.t + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--hair)" strokeDasharray="2 3" />
              <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{t}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          let yAcc = pad.t + innerH;
          return keys.map((k, ki) => {
            const v = d[k] || 0;
            const h = (v / max) * innerH;
            yAcc -= h;
            return <rect key={k + i} x={pad.l + i * bw + 0.5} y={yAcc} width={bw - 1} height={h} fill={colors[ki]} />;
          });
        })}
        {/* x ticks every Nth */}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 8) !== 0) return null;
          const x = pad.l + i * bw + bw / 2;
          return <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{d.tickLabel ?? ''}</text>;
        })}
      </svg>
    </div>
  );
}

function Donut({ segments, size = 120, thickness = 18, centerLabel, centerValue }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {segments.map((s, i) => {
          const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += s.value;
          const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const x0 = c + Math.cos(a0) * r;
          const y0 = c + Math.sin(a0) * r;
          const x1 = c + Math.cos(a1) * r;
          const y1 = c + Math.sin(a1) * r;
          const d = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
          return <path key={i} d={d} stroke={s.color} strokeWidth={thickness} fill="none" strokeLinecap="butt" />;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"' }}>{centerValue}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>{centerLabel}</div>
        </div>
      </div>
    </div>
  );
}

function Histogram({ values, bins = 20, color = 'var(--ink)', height = 90, xLabel, target }) {
  const ref = useRef(null);
  const [w, setW] = useState(280);
  useEffect(() => {
    if (!ref.current) return;
    const r = new ResizeObserver(e => setW(e[0].contentRect.width));
    r.observe(ref.current);
    return () => r.disconnect();
  }, []);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let bi = Math.floor((v - min) / range * bins);
    if (bi === bins) bi = bins - 1;
    counts[bi]++;
  }
  const cmax = Math.max(...counts);
  const pad = { l: 6, r: 6, t: 6, b: 14 };
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const bw = innerW / bins;
  const tx = target != null ? pad.l + ((target - min) / range) * innerW : null;
  return (
    <div ref={ref} style={{ width: '100%', height }} className="chart">
      <svg width={w} height={height}>
        {counts.map((c, i) => {
          const h = (c / cmax) * innerH;
          return <rect key={i} x={pad.l + i * bw + 0.5} y={pad.t + innerH - h} width={Math.max(1, bw - 1)} height={h} fill={color} />;
        })}
        {tx != null && (
          <g>
            <line x1={tx} x2={tx} y1={pad.t} y2={pad.t + innerH} stroke="var(--signal)" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x={tx + 4} y={pad.t + 8} fontSize="9" fill="var(--signal-ink)" fontFamily="var(--mono)">target</text>
          </g>
        )}
        <text x={pad.l} y={height - 2} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{min.toFixed(0)}</text>
        <text x={w - pad.r} y={height - 2} textAnchor="end" fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{max.toFixed(0)}{xLabel}</text>
      </svg>
    </div>
  );
}

// stacked horizontal bar for survey answers
function StackedRow({ segments, total, height = 14 }) {
  return (
    <div style={{ display: 'flex', width: '100%', height, borderRadius: 3, overflow: 'hidden', background: 'var(--surface-2)' }}>
      {segments.map((s, i) => (
        <div key={i} title={s.label + ': ' + s.value} style={{ width: (s.value / total * 100) + '%', background: s.color }} />
      ))}
    </div>
  );
}

// scatter
function Scatter({ points, w = 300, h = 200, xLabel, yLabel, xDomain, yDomain, color = 'var(--ink)' }) {
  const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
  const x0 = xDomain ? xDomain[0] : Math.min(...xs);
  const x1 = xDomain ? xDomain[1] : Math.max(...xs);
  const y0 = yDomain ? yDomain[0] : Math.min(...ys);
  const y1 = yDomain ? yDomain[1] : Math.max(...ys);
  const pad = { l: 32, r: 8, t: 10, b: 24 };
  const innerW = w - pad.l - pad.r; const innerH = h - pad.t - pad.b;
  const sx = v => pad.l + ((v - x0) / (x1 - x0)) * innerW;
  const sy = v => pad.t + innerH - ((v - y0) / (y1 - y0)) * innerH;
  return (
    <svg width={w} height={h} className="chart">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line key={i} x1={pad.l} x2={w - pad.r} y1={pad.t + t * innerH} y2={pad.t + t * innerH} stroke="var(--hair)" strokeDasharray="2 3" />
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={p[2] || 3} fill={p[3] || color} opacity="0.75" />
      ))}
      <text x={pad.l} y={h - 6} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{x0.toFixed(0)}</text>
      <text x={w - pad.r} y={h - 6} textAnchor="end" fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{x1.toFixed(0)} {xLabel}</text>
      <text x={4} y={pad.t + 6} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{y1.toFixed(0)}</text>
      <text x={4} y={pad.t + innerH} fontSize="9" fontFamily="var(--mono)" fill="var(--ink-3)">{y0.toFixed(0)}</text>
    </svg>
  );
}

// Icon set — minimal stroke
function Icon({ name, size = 14 }) {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...common}><path d="M3 11l9-8 9 8" /><path d="M5 9v12h14V9" /></svg>;
    case 'users': return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M3 21c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M15 17c0-2 1.5-3 3-3s3 1 3 3" /></svg>;
    case 'map': return <svg {...common}><path d="M9 4l-6 3v13l6-3 6 3 6-3V4l-6 3-6-3z" /><line x1="9" y1="4" x2="9" y2="17" /><line x1="15" y1="7" x2="15" y2="20" /></svg>;
    case 'chart': return <svg {...common}><path d="M3 21h18" /><rect x="5" y="13" width="3" height="6" /><rect x="11" y="9" width="3" height="10" /><rect x="17" y="5" width="3" height="14" /></svg>;
    case 'survey': return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="1.5" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></svg>;
    case 'cpu': return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="1.5" /><rect x="10" y="10" width="4" height="4" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></svg>;
    case 'radio': return <svg {...common}><circle cx="12" cy="12" r="2" /><path d="M8 8a5.7 5.7 0 000 8" /><path d="M16 8a5.7 5.7 0 010 8" /><path d="M5 5a9.9 9.9 0 000 14" /><path d="M19 5a9.9 9.9 0 010 14" /></svg>;
    case 'order': return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="1.5" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="14" y2="13" /></svg>;
    case 'x': return <svg {...common}><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>;
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="6" /><line x1="20" y1="20" x2="16" y2="16" /></svg>;
    case 'filter': return <svg {...common}><path d="M3 5h18l-7 9v5l-4 1v-6L3 5z" /></svg>;
    case 'export': return <svg {...common}><path d="M12 4v12" /><path d="M7 9l5-5 5 5" /><path d="M4 20h16" /></svg>;
    case 'reload': return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" /></svg>;
    case 'arrow-up': return <svg {...common}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
    case 'arrow-down': return <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
    case 'thumbs-up': return <svg {...common}><path d="M7 22V11l5-7 1 1c.5.5.7 1.2.5 1.9L12 11h5.6a2 2 0 0 1 2 2.4l-1.5 6a2 2 0 0 1-2 1.6H7z" /></svg>;
    case 'check': return <svg {...common}><polyline points="4 12 10 18 20 6" /></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></svg>;
    case 'alert': return <svg {...common}><path d="M12 3l10 18H2L12 3z" /><line x1="12" y1="10" x2="12" y2="14" /><circle cx="12" cy="17.5" r="0.6" fill="currentColor" /></svg>;
    case 'kbd-cmd': return <svg {...common}><path d="M6 9a3 3 0 1 1 3-3v12a3 3 0 1 1-3-3h12a3 3 0 1 1-3 3V6a3 3 0 1 1 3 3H6z" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

// expose to window for other babel scripts
Object.assign(window, {
  fmtNum, fmtAgo, fmtTime, fmtDuration, fmtPph,
  VerdictChip, Stat, Sparkline, HBarChart, StackedBarTimeseries,
  Donut, Histogram, StackedRow, Scatter, Icon,
});
