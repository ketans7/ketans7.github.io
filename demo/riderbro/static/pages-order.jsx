/* global React, RiMap, VerdictChip, Icon, fmtTime, fmtDuration */

const { useState: useStateO } = React;

function OrderDrawer({ order, onClose }) {
  const [tab, setTab] = useStateO('overview'); // overview | parsing | route | survey

  if (!order) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)' }}>
          <div>
            <div className="muted mono tiny" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order #{order.id} · {fmtTime(order.received_at)}</div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2 }}>
              <VerdictChip v={order.verdict} /> <span style={{ marginLeft: 8 }}>£{order.pounds_per_hour.toFixed(1)}/hr · £{order.payout_gbp.toFixed(2)} payout</span>
            </div>
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="muted mono tiny">@{order.rider.handle}</div>
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--hair)', background: 'var(--surface)' }}>
          {['overview', 'parsing', 'route', 'survey'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 18px', background: tab === t ? 'var(--bg)' : 'transparent',
              border: 0, borderBottom: tab === t ? '2px solid var(--ink)' : '2px solid transparent',
              fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: tab === t ? 'var(--ink)' : 'var(--ink-2)', cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 22, background: 'var(--bg)' }}>
          {tab === 'overview' && <OrderOverview order={order} />}
          {tab === 'parsing' && <OrderParsing order={order} />}
          {tab === 'route' && <OrderRoute order={order} />}
          {tab === 'survey' && <OrderSurvey order={order} />}
        </div>
      </div>
    </>
  );
}

function OrderOverview({ order }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14 }}>
      <div className="screenshot-mock">
        <div className="head">
          <span>screenshot · parsed</span>
          <span>{order.parser_used.toUpperCase()} · {(order.parse_confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="payout">£{order.payout_gbp.toFixed(2)}</div>
        {order.pickups.map((p, i) => (
          <div className="stop" key={'p' + i}>
            <div className="bullet">{i + 1}</div>
            <div className="body">
              <div className="top">{p.restaurant}</div>
              <div className="bottom">{p.postcode} · {p.area} · {p.items} items</div>
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed var(--hair)', margin: '6px 0' }}></div>
        {order.dropoffs.map((d, i) => (
          <div className="stop" key={'d' + i}>
            <div className="bullet d">{i + 1}</div>
            <div className="body">
              <div className="top">Dropoff {i + 1}</div>
              <div className="bottom">{d.postcode} · {d.area}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div className="card-head"><span className="label">Scoring</span></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <div><div className="muted mono tiny" style={{ textTransform: 'uppercase' }}>verdict</div><div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}><VerdictChip v={order.verdict} /></div></div>
            <div><div className="muted mono tiny" style={{ textTransform: 'uppercase' }}>predicted £/hr</div><div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>£{order.pounds_per_hour.toFixed(2)}</div></div>
            <div><div className="muted mono tiny" style={{ textTransform: 'uppercase' }}>route</div><div className="mono" style={{ fontSize: 14, marginTop: 4 }}>{(order.route_distance_m / 1000).toFixed(2)}km · {Math.round(order.route_duration_s / 60)}min</div></div>
            <div><div className="muted mono tiny" style={{ textTransform: 'uppercase' }}>stops</div><div className="mono" style={{ fontSize: 14, marginTop: 4 }}>{order.pickups.length}P / {order.dropoffs.length}D</div></div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="label">Reasoning</span></div>
          <div className="card-body" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }}>{order.reasoning}</div>
        </div>

        <div className="card">
          <div className="card-head"><span className="label">Outcome</span></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div>
              <div className="muted mono tiny" style={{ textTransform: 'uppercase' }}>rider accepted?</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4 }}>{order.accepted ? 'yes' : 'no'}</div>
              {((order.verdict === 'skip' && order.accepted) || (order.verdict === 'accept' && !order.accepted)) && (
                <div className="chip chip-signal" style={{ marginTop: 6 }}>OVERRIDE</div>
              )}
            </div>
            <div>
              <div className="muted mono tiny" style={{ textTransform: 'uppercase' }}>delivered?</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4 }}>{order.completed ? 'yes' : (order.accepted ? 'in progress' : '—')}</div>
            </div>
            <div>
              <div className="muted mono tiny" style={{ textTransform: 'uppercase' }}>thumbs feedback</div>
              <div style={{ fontSize: 15, marginTop: 4 }}>{order.thumbs === 1 ? '👍 accurate' : order.thumbs === -1 ? '👎 inaccurate' : 'no feedback'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="label">Pipeline telemetry</span></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, fontFamily: 'var(--mono)', fontSize: 12 }}>
            <div><div className="muted tiny" style={{ textTransform: 'uppercase' }}>ocr</div>{order.ocr_ms}ms</div>
            <div><div className="muted tiny" style={{ textTransform: 'uppercase' }}>vlm</div>{order.vlm_ms ? order.vlm_ms + 'ms' : '—'}</div>
            <div><div className="muted tiny" style={{ textTransform: 'uppercase' }}>routing</div>{order.routing_ms}ms</div>
            <div><div className="muted tiny" style={{ textTransform: 'uppercase' }}>total</div>{order.total_ms}ms</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderParsing({ order }) {
  // synthesize "raw OCR" to compare against parsed — for prototype, we just lightly mangle the parsed
  const rawPayout = '£' + (order.payout_gbp + (Math.random() - 0.5) * 0.05).toFixed(2);
  return (
    <div className="card">
      <div className="card-head"><span className="label">Parsed fields vs raw OCR text</span><span className="muted mono tiny">amber = disagreement</span></div>
      <div className="card-body">
        <div className="field-row" style={{ background: 'var(--surface-2)' }}>
          <div className="k">field</div>
          <div className="k">parsed</div>
          <div className="k">raw</div>
        </div>
        <div className="field-row">
          <div className="k">payout</div>
          <div className="v parsed">£{order.payout_gbp.toFixed(2)}</div>
          <div className="v raw">{rawPayout}</div>
        </div>
        {order.pickups.map((p, i) => (
          <React.Fragment key={'p' + i}>
            <div className="field-row">
              <div className="k">pickup{i + 1} · name</div>
              <div className="v parsed">{p.restaurant}</div>
              <div className="v raw">{p.restaurant.toUpperCase()}</div>
            </div>
            <div className="field-row">
              <div className="k">pickup{i + 1} · postcode</div>
              <div className="v parsed">{p.postcode}</div>
              <div className="v raw">{p.postcode}</div>
            </div>
            <div className="field-row">
              <div className="k">pickup{i + 1} · items</div>
              <div className="v parsed">{p.items}</div>
              <div className="v raw">{p.items} items</div>
            </div>
          </React.Fragment>
        ))}
        {order.dropoffs.map((d, i) => (
          <div className="field-row" key={'d' + i}>
            <div className="k">dropoff{i + 1} · postcode</div>
            <div className="v parsed">{d.postcode}</div>
            <div className="v raw">{d.postcode}</div>
          </div>
        ))}
        <div className="field-row">
          <div className="k">overall confidence</div>
          <div className="v parsed mono">{(order.parse_confidence * 100).toFixed(1)}%</div>
          <div className="v raw">parser_used = {order.parser_used}</div>
        </div>
        {order.error && (
          <div className="field-row" style={{ background: 'var(--skip-soft)' }}>
            <div className="k">error</div>
            <div className="v parsed" style={{ color: 'var(--skip)' }}>{order.error}</div>
            <div className="v raw">surfaced during processing</div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRoute({ order }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ overflow: 'hidden' }}>
        <RiMap mode="route" payload={{ order, center: [order.rider_lat, order.rider_lon], zoom: 13 }} height={400} fit
          overlayItems={[
            { label: 'distance', value: (order.route_distance_m / 1000).toFixed(2) + 'km' },
            { label: 'duration', value: Math.round(order.route_duration_s / 60) + 'min' },
          ]}
          legendItems={[
            { color: 'var(--signal)', label: 'rider start' },
            { color: 'var(--ink)', label: 'pickup' },
            { color: '#fff', label: 'dropoff', style: { border: '1.5px solid var(--ink)' } },
          ]}
        />
      </div>
      <div className="card">
        <div className="card-head"><span className="label">Route legs</span></div>
        <table className="tbl">
          <thead><tr><th>leg</th><th>from</th><th>to</th><th>distance</th><th>duration</th></tr></thead>
          <tbody>
            {(() => {
              const stops = [
                { label: 'rider', desc: 'GPS at submission' },
                ...(order.pickups || []).map((p, i) => ({ label: 'pickup ' + (i + 1), desc: (p.restaurant || 'Pickup') + ' · ' + (p.postcode || '?') })),
                ...(order.dropoffs || []).map((d, i) => ({ label: 'dropoff ' + (i + 1), desc: (d.postcode || '?') + ' · ' + (d.area || '?') })),
              ];
              const legs = Array.isArray(order.route_legs) ? order.route_legs : [];
              const fallbackDist = order.route_distance_m / Math.max(1, stops.length - 1);
              const fallbackDur = order.route_duration_s / Math.max(1, stops.length - 1);
              const rows = [];
              for (let i = 0; i < stops.length - 1; i++) {
                const leg = legs[i];
                const dist = leg && (leg.distance_m ?? leg.distance) || fallbackDist;
                const dur = leg && (leg.duration_s ?? leg.duration) || fallbackDur;
                rows.push(
                  <tr key={i}>
                    <td className="mono">{i + 1}</td>
                    <td>{stops[i].desc}</td>
                    <td>{stops[i + 1].desc}</td>
                    <td className="mono num">{(dist / 1000).toFixed(2)}km</td>
                    <td className="mono num">{fmtDuration(dur)}</td>
                  </tr>
                );
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderSurvey({ order }) {
  const responses = order.survey_responses || {};
  const keys = Object.keys(responses);
  if (keys.length === 0) {
    return <div className="card"><div className="card-body muted tiny" style={{ textAlign: 'center', padding: 30 }}>No survey responses collected for this order.</div></div>;
  }
  return (
    <div className="card">
      <div className="card-head"><span className="label">Post-delivery survey · {keys.length} answered</span></div>
      <div className="card-body">
        {keys.map(k => (
          <div className="field-row" key={k}>
            <div className="k">{k}</div>
            <div className="v parsed">{window.RI.SURVEY_Q[k]?.q}</div>
            <div className="v parsed mono" style={{ fontWeight: 600 }}>{responses[k]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { OrderDrawer });
