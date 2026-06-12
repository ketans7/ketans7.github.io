/* global React, RiMap, Stat, Sparkline, VerdictChip, HBarChart, StackedBarTimeseries, Donut, Histogram, Icon, fmtTime, fmtAgo, fmtPph */

const { useState: useStateOv, useMemo: useMemoOv } = React;

function OverviewPage({ openOrder, openRider, range }) {
  const [variant, setVariant] = useStateOv('dense');

  const { orders, riders, hourly, recentErrors } = window.RI;

  // filter by range
  const ms = range === '24h' ? 24 * 3600e3 : range === '7d' ? 7 * 24 * 3600e3 : 30 * 24 * 3600e3;
  const cutoff = Date.now() - ms;
  const fOrders = useMemoOv(() => orders.filter(o => o.received_at >= cutoff), [range]);

  const totals = useMemoOv(() => {
    const c = { accept: 0, borderline: 0, skip: 0, manual_check: 0 };
    let sumPph = 0, sumPph2 = 0;
    let thumbsUp = 0, thumbsTotal = 0;
    let vlmCount = 0;
    let totalLatency = 0, latencyN = 0;
    let errs = 0;
    for (const o of fOrders) {
      c[o.verdict]++;
      sumPph += o.pounds_per_hour;
      if (o.verdict === 'accept') sumPph2 += o.pounds_per_hour;
      if (o.thumbs === 1) thumbsUp++;
      if (o.thumbs !== 0) thumbsTotal++;
      if (o.parser_used === 'vlm') vlmCount++;
      totalLatency += o.total_ms; latencyN++;
      if (o.error) errs++;
    }
    return {
      n: fOrders.length, ...c,
      avgPph: fOrders.length ? sumPph / fOrders.length : 0,
      thumbsRate: thumbsTotal ? thumbsUp / thumbsTotal : 0,
      thumbsN: thumbsTotal,
      vlmRate: fOrders.length ? vlmCount / fOrders.length : 0,
      avgLatency: latencyN ? totalLatency / latencyN : 0,
      errs,
    };
  }, [fOrders]);

  // sparkline data: order count per period (bucket of 1h or 1d)
  const sparkData = useMemoOv(() => {
    const buckets = range === '24h' ? 24 : range === '7d' ? 7 : 30;
    const bucketMs = ms / buckets;
    const arr = new Array(buckets).fill(0);
    for (const o of fOrders) {
      const b = Math.floor((o.received_at - cutoff) / bucketMs);
      if (b >= 0 && b < buckets) arr[b]++;
    }
    return arr;
  }, [fOrders]);

  // verdict timeseries for hourly chart
  const tsData = useMemoOv(() => {
    return window.RI.hourly.slice(-72).map(h => ({
      ...h,
      tickLabel: new Date(h.ts).getHours() + ''.padStart(2, '0') + 'h',
    }));
  }, []);

  const topRiders = useMemoOv(() => {
    const byRider = {};
    for (const o of fOrders) {
      const k = o.telegram_user_id;
      if (!byRider[k]) byRider[k] = { rider: o.rider, n: 0, pph: 0 };
      byRider[k].n++;
      byRider[k].pph += o.pounds_per_hour;
    }
    return Object.values(byRider)
      .map(x => ({ ...x, pph: x.pph / x.n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [fOrders]);

  const topAreas = useMemoOv(() => {
    const m = {};
    for (const o of fOrders) {
      for (const p of o.pickups) {
        if (!m[p.area]) m[p.area] = 0;
        m[p.area]++;
      }
    }
    return Object.entries(m).map(([k, v]) => ({ label: k, value: v }))
      .sort((a,b) => b.value - a.value).slice(0, 8);
  }, [fOrders]);

  const recent = useMemoOv(() => [...fOrders].sort((a, b) => b.received_at - a.received_at).slice(0, 10), [fOrders]);

  const verdictSegments = [
    { value: totals.accept, color: 'var(--accept)', label: 'accept' },
    { value: totals.borderline, color: 'var(--borderline)', label: 'borderline' },
    { value: totals.skip, color: 'var(--skip)', label: 'skip' },
    { value: totals.manual_check, color: 'var(--manual)', label: 'manual' },
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <div className="muted mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overview</div>
          <span className="muted" style={{ fontSize: 12 }}>{totals.n} orders · {window.RI.riders.length} riders</span>
        </div>
        <div className="variant-switch">
          {[['dense','Dense'],['spacious','Spacious'],['mapfirst','Map-first']].map(([k, l]) => (
            <button key={k} className={variant === k ? 'active' : ''} onClick={() => setVariant(k)}>{l}</button>
          ))}
        </div>
      </div>

      {variant === 'dense'    && <DenseOverview totals={totals} sparkData={sparkData} tsData={tsData} recent={recent} recentErrors={recentErrors} topRiders={topRiders} topAreas={topAreas} verdictSegments={verdictSegments} fOrders={fOrders} openOrder={openOrder} openRider={openRider} />}
      {variant === 'spacious' && <SpaciousOverview totals={totals} sparkData={sparkData} tsData={tsData} recent={recent} verdictSegments={verdictSegments} topRiders={topRiders} fOrders={fOrders} openOrder={openOrder} />}
      {variant === 'mapfirst' && <MapFirstOverview totals={totals} sparkData={sparkData} recent={recent} verdictSegments={verdictSegments} fOrders={fOrders} openOrder={openOrder} />}
    </div>
  );
}

// ---- DENSE: 12-col, lots of info, compact stats ----
function DenseOverview({ totals, sparkData, tsData, recent, recentErrors, topRiders, topAreas, verdictSegments, fOrders, openOrder, openRider }) {
  return (
    <div className="ovw-dense">
      <div className="span-2"><Stat label="orders" value={totals.n} sparkData={sparkData} /></div>
      <div className="span-2"><Stat label="avg £/hr" value={'£' + totals.avgPph.toFixed(1)} sparkData={sparkData.map(v => v * 0.6 + 10)} /></div>
      <div className="span-2"><Stat label="thumbs-up" value={(totals.thumbsRate * 100).toFixed(0)} unit="%" delta={'n=' + totals.thumbsN} /></div>
      <div className="span-2"><Stat label="vlm fallback" value={(totals.vlmRate * 100).toFixed(0)} unit="%" sparkColor="var(--signal)" sparkData={sparkData.map(v => v * 0.3 + 5)} /></div>
      <div className="span-2"><Stat label="avg latency" value={Math.round(totals.avgLatency)} unit="ms" /></div>
      <div className="span-2"><Stat label="errors / 24h" value={totals.errs} delta={totals.errs ? 'see feed' : '—'} deltaDir={totals.errs > 5 ? 'down' : ''} /></div>

      <div className="card span-7">
        <div className="card-head">
          <span className="label">Order volume · verdict mix · last 72h</span>
          <span className="chip chip-muted mono">hourly</span>
        </div>
        <div className="card-body">
          <StackedBarTimeseries
            data={tsData}
            keys={['accept', 'borderline', 'skip']}
            colors={['#1F7A4D', '#B47A0F', '#B53A2A']}
            height={170}
          />
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-2)' }}>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#1F7A4D', marginRight: 5 }}></span>accept</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#B47A0F', marginRight: 5 }}></span>borderline</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, background: '#B53A2A', marginRight: 5 }}></span>skip</span>
          </div>
        </div>
      </div>

      <div className="card span-5">
        <div className="card-head">
          <span className="label">Verdict distribution</span>
          <span className="muted mono tiny">n={totals.n}</span>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Donut segments={verdictSegments} size={130} thickness={20} centerLabel="total" centerValue={totals.n} />
          <div style={{ flex: 1 }}>
            {verdictSegments.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--hair)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2 }}></span>
                  <span style={{ fontSize: 12 }}>{s.label}</span>
                </div>
                <div className="mono" style={{ fontSize: 12 }}>
                  {s.value} <span className="muted">· {totals.n ? (s.value / totals.n * 100).toFixed(0) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card span-8" style={{ overflow: 'hidden' }}>
        <div className="card-head">
          <span className="label">Activity map · recent orders</span>
          <span className="muted mono tiny">colored by verdict</span>
        </div>
        <RiMap
          mode="overview"
          payload={{ orders: fOrders, center: [51.5180, -0.0925], zoom: 12 }}
          height={300}
          legendItems={[
            { color: '#1F7A4D', label: 'accept' },
            { color: '#B47A0F', label: 'borderline' },
            { color: '#B53A2A', label: 'skip' },
            { color: '#5C4E8A', label: 'manual' },
          ]}
          overlayItems={[
            { label: 'orders mapped', value: fOrders.length },
            { label: 'areas', value: window.RI.AREAS.length },
          ]}
        />
      </div>

      <div className="card span-4">
        <div className="card-head"><span className="label">Top pickup areas</span></div>
        <div className="card-body">
          <HBarChart data={topAreas} color="var(--ink)" />
        </div>
      </div>

      <div className="card span-6">
        <div className="card-head"><span className="label">Most active riders</span><span className="muted mono tiny">click row</span></div>
        <table className="tbl">
          <thead>
            <tr><th>rider</th><th>orders</th><th>avg £/hr</th><th>accept</th><th>thumbs</th></tr>
          </thead>
          <tbody>
            {topRiders.map(r => (
              <tr key={r.rider.id} onClick={() => openRider(r.rider)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar s">{r.rider.first[0]}</div>
                    <div>
                      <div>{r.rider.first}</div>
                      <div className="muted mono tiny">@{r.rider.handle}</div>
                    </div>
                  </div>
                </td>
                <td className="mono">{r.n}</td>
                <td className="mono">£{r.pph.toFixed(1)}</td>
                <td className="mono">{(r.rider.acceptRate * 100).toFixed(0)}%</td>
                <td className="mono">{(r.rider.thumbsRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card span-6">
        <div className="card-head"><span className="label">Recent errors · 24h</span><span className="muted mono tiny">{recentErrors.length}</span></div>
        <div className="card-body" style={{ paddingTop: 4 }}>
          {recentErrors.length === 0 && <div className="muted tiny" style={{ padding: 16, textAlign: 'center' }}>No errors in the last 24h.</div>}
          {recentErrors.map(e => (
            <div className="error-row" key={e.id} onClick={() => openOrder(e)} style={{ cursor: 'pointer' }}>
              <span className="ts">{fmtTime(e.received_at)}</span>
              <span className="kind">{e.error}</span>
              <span className="msg">@{e.rider.handle} · order #{e.id}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card span-12">
        <div className="card-head"><span className="label">Recent orders</span><span className="muted mono tiny">click any row</span></div>
        <table className="tbl">
          <thead>
            <tr>
              <th>time</th><th>rider</th><th>verdict</th><th>£/hr</th><th>route</th><th>pickups</th><th>parser</th><th>conf</th><th>thumbs</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(o => (
              <tr key={o.id} onClick={() => openOrder(o)}>
                <td className="mono">{fmtTime(o.received_at)}</td>
                <td>@{o.rider.handle}</td>
                <td><VerdictChip v={o.verdict} /></td>
                <td className="mono num">£{o.pounds_per_hour.toFixed(1)}</td>
                <td className="mono">{(o.route_distance_m / 1000).toFixed(1)}km · {Math.round(o.route_duration_s / 60)}m</td>
                <td>{o.pickups.map(p => p.restaurant).join(', ')}</td>
                <td className="mono">{o.parser_used.toUpperCase()}</td>
                <td className="mono">{(o.parse_confidence * 100).toFixed(0)}%</td>
                <td className="mono">{o.thumbs === 1 ? '👍' : o.thumbs === -1 ? '👎' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- SPACIOUS: fewer, bigger metrics, breathing room ----
function SpaciousOverview({ totals, sparkData, tsData, recent, verdictSegments, topRiders, fOrders, openOrder }) {
  return (
    <div className="ovw-spacious">
      <div className="span-3"><Stat label="orders" value={totals.n} sparkData={sparkData} /></div>
      <div className="span-3"><Stat label="avg predicted £/hr" value={'£' + totals.avgPph.toFixed(1)} sparkData={sparkData.map(v => v * 0.5 + 12)} /></div>
      <div className="span-3"><Stat label="rider thumbs-up rate" value={(totals.thumbsRate * 100).toFixed(0)} unit="%" delta={'n=' + totals.thumbsN + ' rated'} /></div>
      <div className="span-3"><Stat label="vlm fallback rate" value={(totals.vlmRate * 100).toFixed(0)} unit="%" sparkColor="var(--signal)" sparkData={sparkData.map(v => v * 0.2 + 8)} /></div>

      <div className="card span-12" style={{ overflow: 'hidden' }}>
        <div className="card-head">
          <span className="label">Live activity · London</span>
          <span className="muted mono tiny">recent {fOrders.length} orders</span>
        </div>
        <RiMap
          mode="overview"
          payload={{ orders: fOrders.slice(0, 200), center: [51.5180, -0.0925], zoom: 12 }}
          height={380}
          overlayItems={[
            { label: 'pickups', value: fOrders.reduce((s, o) => s + o.pickups.length, 0) },
            { label: 'dropoffs', value: fOrders.reduce((s, o) => s + o.dropoffs.length, 0) },
            { label: 'top hotspot', value: 'Shoreditch' },
          ]}
          legendItems={[
            { color: '#1F7A4D', label: 'accept' },
            { color: '#B47A0F', label: 'borderline' },
            { color: '#B53A2A', label: 'skip' },
          ]}
        />
      </div>

      <div className="card span-8">
        <div className="card-head"><span className="label">Verdict mix · last 72h</span></div>
        <div className="card-body">
          <StackedBarTimeseries
            data={tsData}
            keys={['accept', 'borderline', 'skip']}
            colors={['#1F7A4D', '#B47A0F', '#B53A2A']}
            height={200}
          />
        </div>
      </div>

      <div className="card span-4">
        <div className="card-head"><span className="label">Verdict distribution</span></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Donut segments={verdictSegments} size={160} thickness={24} centerLabel="total" centerValue={totals.n} />
          <div style={{ width: '100%' }}>
            {verdictSegments.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--hair)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2 }}></span>
                  <span style={{ fontSize: 12 }}>{s.label}</span>
                </div>
                <div className="mono" style={{ fontSize: 12 }}>{s.value} · {totals.n ? (s.value / totals.n * 100).toFixed(0) : 0}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card span-12">
        <div className="card-head"><span className="label">Recent orders</span></div>
        <table className="tbl">
          <thead>
            <tr><th>time</th><th>rider</th><th>verdict</th><th>£/hr</th><th>route</th><th>pickups</th><th>thumbs</th></tr>
          </thead>
          <tbody>
            {recent.slice(0, 8).map(o => (
              <tr key={o.id} onClick={() => openOrder(o)}>
                <td className="mono">{fmtTime(o.received_at)}</td>
                <td>@{o.rider.handle}</td>
                <td><VerdictChip v={o.verdict} /></td>
                <td className="mono num">£{o.pounds_per_hour.toFixed(1)}</td>
                <td className="mono">{(o.route_distance_m / 1000).toFixed(1)}km</td>
                <td>{o.pickups.map(p => p.restaurant).join(', ')}</td>
                <td className="mono">{o.thumbs === 1 ? '👍' : o.thumbs === -1 ? '👎' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- MAP-FIRST: hero map dominates, stats orbit ----
function MapFirstOverview({ totals, sparkData, recent, verdictSegments, fOrders, openOrder }) {
  const [mapMode, setMapMode] = useStateOv('activity');

  return (
    <div className="ovw-mapfirst">
      <div className="hero-map card" style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
        <RiMap
          mode={mapMode === 'heat' ? 'heat' : 'overview'}
          payload={{ orders: fOrders, center: [51.5180, -0.0925], zoom: 12 }}
          height={520}
          overlayItems={[
            { label: 'orders', value: fOrders.length },
            { label: 'riders active', value: window.RI.riders.filter(r => r.online).length },
            { label: 'avg £/hr', value: '£' + totals.avgPph.toFixed(1) },
            { label: 'thumbs-up', value: (totals.thumbsRate * 100).toFixed(0) + '%' },
          ]}
          toolbar={[
            { label: 'activity', active: mapMode === 'activity', onClick: () => setMapMode('activity') },
            { label: 'heatmap', active: mapMode === 'heat', onClick: () => setMapMode('heat') },
          ]}
          legendItems={mapMode === 'heat'
            ? [{ color: '#00B8D4', label: 'order density' }]
            : [
              { color: '#1F7A4D', label: 'accept' },
              { color: '#B47A0F', label: 'borderline' },
              { color: '#B53A2A', label: 'skip' },
            ]
          }
        />
      </div>

      <div className="stat-row">
        <Stat label="orders" value={totals.n} sparkData={sparkData} />
        <Stat label="avg £/hr" value={'£' + totals.avgPph.toFixed(1)} />
        <Stat label="thumbs-up" value={(totals.thumbsRate * 100).toFixed(0)} unit="%" />
        <Stat label="vlm" value={(totals.vlmRate * 100).toFixed(0)} unit="%" sparkColor="var(--signal)" />
        <Stat label="latency" value={Math.round(totals.avgLatency)} unit="ms" />
        <Stat label="errors" value={totals.errs} deltaDir={totals.errs > 5 ? 'down' : ''} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="card-head"><span className="label">Recent orders</span></div>
          <table className="tbl">
            <thead><tr><th>time</th><th>rider</th><th>verdict</th><th>£/hr</th><th>pickups</th></tr></thead>
            <tbody>
              {recent.slice(0, 7).map(o => (
                <tr key={o.id} onClick={() => openOrder(o)}>
                  <td className="mono">{fmtTime(o.received_at)}</td>
                  <td>@{o.rider.handle}</td>
                  <td><VerdictChip v={o.verdict} /></td>
                  <td className="mono num">£{o.pounds_per_hour.toFixed(1)}</td>
                  <td>{o.pickups.map(p => p.restaurant).slice(0, 2).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-head"><span className="label">Verdict mix</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Donut segments={verdictSegments} size={130} thickness={20} centerLabel="total" centerValue={totals.n} />
            <div style={{ width: '100%', marginTop: 10 }}>
              {verdictSegments.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2 }}></span>
                    <span style={{ fontSize: 12 }}>{s.label}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 12 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OverviewPage });
