/* global React, RiMap, VerdictChip, HBarChart, Histogram, Sparkline, Icon, Stat, fmtAgo, fmtTime, StackedBarTimeseries */

const { useState: useStateR, useMemo: useMemoR } = React;

function RidersPage({ openOrder, openRider }) {
  const [selected, setSelected] = useStateR(null);
  const [sortKey, setSortKey] = useStateR('last_seen');
  const [search, setSearch] = useStateR('');
  const { riders, orders } = window.RI;

  const enriched = useMemoR(() => {
    const map = {};
    for (const o of orders) {
      const k = o.telegram_user_id;
      if (!map[k]) map[k] = { rider: window.RI.riders.find(r => r.id === k), orders: [], pph: 0, accept: 0, n: 0 };
      const e = map[k];
      e.orders.push(o);
      e.n++;
      e.pph += o.pounds_per_hour;
      if (o.verdict === 'accept') e.accept++;
    }
    return riders.map(r => {
      const e = map[r.id] || { orders: [], pph: 0, accept: 0, n: 0 };
      return {
        rider: r,
        n: e.n,
        avgPph: e.n ? e.pph / e.n : 0,
        acceptRate: e.n ? e.accept / e.n : 0,
        orders: e.orders,
        last: e.orders.length ? Math.max(...e.orders.map(o => o.received_at)) : 0,
      };
    });
  }, []);

  const filtered = enriched
    .filter(r => !search || r.rider.first.toLowerCase().includes(search.toLowerCase()) || r.rider.handle.includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'last_seen') return b.last - a.last;
      if (sortKey === 'orders') return b.n - a.n;
      if (sortKey === 'pph') return b.avgPph - a.avgPph;
      if (sortKey === 'accept') return b.acceptRate - a.acceptRate;
      return 0;
    });

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 14, height: 'calc(100vh - 110px)' }}>
        {/* LEFT — rider list */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--hair)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: 6, padding: '4px 8px' }}>
              <Icon name="search" size={13} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rider…" style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontFamily: 'var(--sans)', fontSize: 12 }} />
            </div>
            <select value={sortKey} onChange={e => setSortKey(e.target.value)}
              style={{ border: '1px solid var(--hair)', borderRadius: 6, padding: '4px 6px', fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface)' }}>
              <option value="last_seen">last seen</option>
              <option value="orders">orders</option>
              <option value="pph">£/hr</option>
              <option value="accept">accept rate</option>
            </select>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            {filtered.map(r => (
              <div key={r.rider.id}
                onClick={() => setSelected(r)}
                style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10,
                  padding: '10px 14px', borderBottom: '1px solid var(--hair)',
                  cursor: 'pointer', alignItems: 'center',
                  background: selected?.rider.id === r.rider.id ? 'var(--signal-soft)' : 'transparent',
                }}
              >
                <div className="avatar s" style={{ position: 'relative' }}>
                  {r.rider.first[0]}
                  {r.rider.online && <span style={{ position: 'absolute', width: 7, height: 7, background: '#22c55e', borderRadius: '50%', bottom: -1, right: -1, border: '1.5px solid var(--surface)' }}></span>}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.rider.first} <span className="muted mono" style={{ fontSize: 10 }}>@{r.rider.handle}</span></div>
                  <div className="muted mono tiny">{r.n} orders · £{r.avgPph.toFixed(1)}/hr · {(r.acceptRate * 100).toFixed(0)}% accept</div>
                </div>
                <div className="mono tiny muted">{r.last ? fmtAgo(r.last) : '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — selected rider detail (or empty state) */}
        <div style={{ overflow: 'auto' }}>
          {!selected && <RidersEmpty count={enriched.length} />}
          {selected && <RiderDetail row={selected} openOrder={openOrder} />}
        </div>
      </div>
    </div>
  );
}

function RidersEmpty({ count }) {
  return (
    <div className="card" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Select a rider</div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {count} riders in this database. Pick one on the left to see their order timeline, location history, and survey profile.
        </div>
      </div>
    </div>
  );
}

function RiderDetail({ row, openOrder }) {
  const { rider, orders, n, avgPph, acceptRate } = row;
  const recentOrders = useMemoR(() => [...orders].sort((a, b) => b.received_at - a.received_at).slice(0, 14), [orders]);

  // survey profile — aggregate this rider's survey answers
  const surveyProfile = useMemoR(() => {
    const profile = {};
    for (const o of orders) {
      if (!o.survey_responses) continue;
      for (const [k, v] of Object.entries(o.survey_responses)) {
        if (!profile[k]) profile[k] = {};
        profile[k][v] = (profile[k][v] || 0) + 1;
      }
    }
    return profile;
  }, [orders]);

  // hourly activity histogram (when does this rider work?)
  const hourly = useMemoR(() => {
    const h = new Array(24).fill(0);
    for (const o of orders) h[new Date(o.received_at).getHours()]++;
    return h;
  }, [orders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="profile-head">
        <div className="avatar">{rider.first[0]}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {rider.first}
            <span className="muted mono" style={{ fontSize: 12, marginLeft: 10 }}>@{rider.handle}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Telegram ID <span className="mono">{rider.id}</span> · Since {new Date(rider.firstSeenAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · Home base: {rider.homeArea.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Stat label="orders" value={n} />
          <Stat label="avg £/hr" value={'£' + avgPph.toFixed(1)} />
          <Stat label="accept" value={(acceptRate * 100).toFixed(0)} unit="%" />
          <Stat label="thumbs" value={(rider.thumbsRate * 100).toFixed(0)} unit="%" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-head"><span className="label">Location history</span><span className="muted mono tiny">last {recentOrders.length} order origins</span></div>
          <RiMap
            mode="rider"
            payload={{ rider, orders, center: [rider.homeArea.lat, rider.homeArea.lon], zoom: 12 }}
            height={300}
            fit
            showLegend={false}
          />
        </div>
        <div className="card">
          <div className="card-head"><span className="label">Activity by hour</span><span className="muted mono tiny">orders received</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
              {hourly.map((c, i) => (
                <div key={i} title={i + ':00 · ' + c + ' orders'} style={{ flex: 1, background: 'var(--ink)', opacity: c === 0 ? 0.1 : 0.3 + (c / Math.max(...hourly)) * 0.7, height: Math.max(2, (c / Math.max(...hourly, 1)) * 100) + '%', borderRadius: '2px 2px 0 0' }}></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 6 }}>
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="label">Recent orders</span></div>
        <table className="tbl">
          <thead><tr><th>time</th><th>verdict</th><th>£/hr</th><th>route</th><th>pickups</th><th>accepted?</th><th>thumbs</th></tr></thead>
          <tbody>
            {recentOrders.map(o => (
              <tr key={o.id} onClick={() => openOrder(o)}>
                <td className="mono">{fmtTime(o.received_at)} <span className="muted">{fmtAgo(o.received_at)}</span></td>
                <td><VerdictChip v={o.verdict} /></td>
                <td className="mono num">£{o.pounds_per_hour.toFixed(1)}</td>
                <td className="mono">{(o.route_distance_m / 1000).toFixed(1)}km</td>
                <td>{o.pickups.map(p => p.restaurant).join(', ')}</td>
                <td className="mono">{o.accepted ? 'yes' : 'no'}</td>
                <td className="mono">{o.thumbs === 1 ? '👍' : o.thumbs === -1 ? '👎' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><span className="label">Survey profile</span><span className="muted mono tiny">this rider's tendencies vs. cohort</span></div>
        <div className="card-body">
          {Object.keys(surveyProfile).length === 0 && <div className="muted tiny">No completed surveys yet.</div>}
          {Object.entries(surveyProfile).slice(0, 8).map(([key, counts]) => {
            const total = Object.values(counts).reduce((s, v) => s + v, 0);
            const opts = window.RI.SURVEY_Q[key]?.opts || Object.keys(counts);
            const palette = ['#0B0B0F', '#3B3B43', '#B47A0F', '#1F7A4D', '#B53A2A', '#5C4E8A'];
            const segments = opts.filter(o => counts[o]).map((o, i) => ({ label: o, value: counts[o], color: palette[i % palette.length] }));
            return (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px', gap: 12, padding: '6px 0', alignItems: 'center', borderBottom: '1px dashed var(--hair)' }}>
                <div style={{ fontSize: 12 }}>
                  <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-3)', marginRight: 6 }}>{key}</span>
                  {window.RI.SURVEY_Q[key]?.q || key}
                </div>
                <div style={{ display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden', background: 'var(--surface-2)' }}>
                  {segments.map((s, i) => (
                    <div key={i} title={s.label + ': ' + s.value} style={{ width: (s.value / total * 100) + '%', background: s.color }}></div>
                  ))}
                </div>
                <div className="mono tiny" style={{ textAlign: 'right', color: 'var(--ink-2)' }}>n={total}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RidersPage });
