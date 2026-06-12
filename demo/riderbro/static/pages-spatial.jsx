/* global React, RiMap, HBarChart, Icon */

const { useState: useStateS, useMemo: useMemoS } = React;

function SpatialPage({ openOrder }) {
  const [mode, setMode] = useStateS('pickups'); // pickups | dropoffs | pph | stress
  const { orders, AREAS, RESTAURANTS } = window.RI;

  // restaurant analytics: aggregate
  const restAgg = useMemoS(() => {
    const r = {};
    for (const o of orders) {
      for (const p of o.pickups) {
        const n = p.restaurant;
        if (!r[n]) r[n] = { name: n, orders: 0, ready: 0, readyT: 0, waitSum: 0, waitN: 0, stress: 0, stressN: 0 };
        r[n].orders++;
        if (o.survey_responses?.ready === 'yes') r[n].ready++;
        if (o.survey_responses?.ready) r[n].readyT++;
        const w = { 'lt2': 1, '2-5': 4, '5-10': 7, '10-20': 15, 'gt20': 25 }[o.survey_responses?.rwait];
        if (w) { r[n].waitSum += w; r[n].waitN++; }
        const s = { 'low': 1, 'medium': 2, 'high': 3 }[o.survey_responses?.stress];
        if (s) { r[n].stress += s; r[n].stressN++; }
      }
    }
    return Object.values(r).filter(x => x.orders >= 3);
  }, []);

  // area aggregates
  const areaAgg = useMemoS(() => {
    const a = {};
    for (const o of orders) {
      for (const p of o.pickups) {
        const k = p.area;
        if (!a[k]) a[k] = { name: k, pc: p.postcode, orders: 0, pphSum: 0, hidden: 0, hiddenN: 0, stress: 0, stressN: 0 };
        a[k].orders++;
        a[k].pphSum += o.pounds_per_hour;
        a[k].hidden += o.hidden_minutes;
        a[k].hiddenN++;
        const s = { 'low': 1, 'medium': 2, 'high': 3 }[o.survey_responses?.stress];
        if (s) { a[k].stress += s; a[k].stressN++; }
      }
    }
    return Object.values(a).map(x => ({
      ...x,
      pph: x.orders ? x.pphSum / x.orders : 0,
      hiddenAvg: x.hiddenN ? x.hidden / x.hiddenN : 0,
      stressAvg: x.stressN ? x.stress / x.stressN : 0,
    }));
  }, []);

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14, height: 'calc(100vh - 110px)' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-head">
            <span className="label">Spatial · {mode}</span>
            <div className="variant-switch">
              {[['pickups','pickups'],['dropoffs','dropoffs'],['pph','£/hr heatmap'],['stress','stress']].map(([k, l]) => (
                <button key={k} className={mode === k ? 'active' : ''} onClick={() => setMode(k)}>{l}</button>
              ))}
            </div>
          </div>
          <RiMap
            mode={mode === 'pickups' ? 'pickups' : 'heat'}
            payload={{ orders, areas: AREAS, center: [51.5180, -0.0925], zoom: 12 }}
            height="calc(100% - 44px)"
            overlayItems={[
              { label: 'pickups mapped', value: orders.reduce((s, o) => s + o.pickups.length, 0) },
              { label: 'areas', value: AREAS.length },
            ]}
            legendItems={mode === 'pph'
              ? [{ color: 'var(--accept)', label: 'high £/hr' }, { color: 'var(--skip)', label: 'low £/hr' }]
              : mode === 'stress'
              ? [{ color: 'var(--skip)', label: 'high stress' }, { color: 'var(--accept)', label: 'low stress' }]
              : [{ color: '#00B8D4', label: 'density' }, { color: 'var(--ink)', label: 'core' }]
            }
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <div className="card">
            <div className="card-head"><span className="label">Top restaurants</span><span className="muted mono tiny">by orders</span></div>
            <div className="card-body" style={{ maxHeight: 260, overflow: 'auto' }}>
              <HBarChart
                data={restAgg.sort((a, b) => b.orders - a.orders).slice(0, 12).map(r => ({ label: r.name, value: r.orders }))}
                color="var(--ink)"
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="label">Order-ready hit rate</span><span className="muted mono tiny">ready=yes /  surveyed</span></div>
            <div className="card-body" style={{ maxHeight: 240, overflow: 'auto' }}>
              <HBarChart
                data={restAgg.filter(r => r.readyT >= 2).map(r => ({
                  label: r.name,
                  value: r.ready / Math.max(1, r.readyT),
                  display: (r.ready / Math.max(1, r.readyT) * 100).toFixed(0) + '%',
                  color: r.ready / r.readyT > 0.6 ? 'var(--accept)' : r.ready / r.readyT < 0.35 ? 'var(--skip)' : 'var(--borderline)',
                })).sort((a, b) => b.value - a.value).slice(0, 10)}
                max={1}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="label">Borough · avg £/hr</span></div>
            <div className="card-body" style={{ maxHeight: 240, overflow: 'auto' }}>
              <HBarChart
                data={areaAgg.sort((a, b) => b.pph - a.pph).slice(0, 10).map(a => ({
                  label: a.name,
                  value: a.pph,
                  display: '£' + a.pph.toFixed(1),
                  color: a.pph > 16 ? 'var(--accept)' : a.pph < 13 ? 'var(--skip)' : 'var(--ink)',
                }))}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="label">Borough · avg hidden min</span><span className="muted mono tiny">friction tax</span></div>
            <div className="card-body" style={{ maxHeight: 240, overflow: 'auto' }}>
              <HBarChart
                data={areaAgg.sort((a, b) => b.hiddenAvg - a.hiddenAvg).slice(0, 10).map(a => ({
                  label: a.name,
                  value: a.hiddenAvg,
                  display: a.hiddenAvg.toFixed(1) + 'm',
                  color: a.hiddenAvg > 7 ? 'var(--skip)' : 'var(--ink)',
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SpatialPage });
