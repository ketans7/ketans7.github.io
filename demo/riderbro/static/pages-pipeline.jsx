/* global React, Stat, Histogram, fmtTime */

const { useMemo: useMemoP } = React;

function PipelinePage() {
  const { orders, recentErrors } = window.RI;

  const stats = useMemoP(() => {
    let ocr = 0, vlm = 0, vlmN = 0, routing = 0, total = 0;
    let pcHit = 0, pcReq = 0;
    let confLow = 0;
    for (const o of orders) {
      ocr += o.ocr_ms;
      if (o.vlm_ms) { vlm += o.vlm_ms; vlmN++; }
      routing += o.routing_ms;
      total += o.total_ms;
      // postcode cache hits — assume jsonified cache hits 80% of time
      for (const p of o.pickups) { pcReq++; if (Math.random() < 0.82) pcHit++; }
      if (o.parse_confidence < 0.75) confLow++;
    }
    return {
      ocr: ocr / orders.length,
      vlm: vlmN ? vlm / vlmN : 0,
      vlmN,
      routing: routing / orders.length,
      total: total / orders.length,
      pcHit: pcHit / Math.max(1, pcReq),
      confLow,
    };
  }, []);

  const errorTypes = useMemoP(() => {
    const m = {};
    for (const o of orders) if (o.error) m[o.error] = (m[o.error] || 0) + 1;
    return Object.entries(m).sort((a,b) => b[1] - a[1]);
  }, []);

  const confValues = orders.map(o => o.parse_confidence * 100);
  const ocrValues = orders.map(o => o.ocr_ms);
  const vlmValues = orders.filter(o => o.vlm_ms).map(o => o.vlm_ms);
  const routingValues = orders.map(o => o.routing_ms);

  return (
    <div className="page">
      <div className="section-h"><div className="lbl">Pipeline · stage latency</div><div className="hint">last 30d, n={orders.length}</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Stat label="ocr · p50" value={Math.round(stats.ocr)} unit="ms" />
        <Stat label="vlm · p50" value={Math.round(stats.vlm)} unit="ms" sparkColor="var(--signal)" />
        <Stat label="routing · p50" value={Math.round(stats.routing)} unit="ms" />
        <Stat label="end-to-end · p50" value={Math.round(stats.total)} unit="ms" />
      </div>

      <div className="section-h"><div className="lbl">Latency distributions</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div className="card">
          <div className="card-head"><span className="label">OCR latency</span><span className="muted mono tiny">target &lt;300ms</span></div>
          <div className="card-body"><Histogram values={ocrValues} bins={26} color="var(--ink)" height={110} target={300} xLabel="ms" /></div>
        </div>
        <div className="card">
          <div className="card-head"><span className="label">VLM latency</span><span className="muted mono tiny">fallback only · n={vlmValues.length}</span></div>
          <div className="card-body"><Histogram values={vlmValues} bins={20} color="var(--signal)" height={110} target={2000} xLabel="ms" /></div>
        </div>
        <div className="card">
          <div className="card-head"><span className="label">Routing latency</span><span className="muted mono tiny">target &lt;500ms</span></div>
          <div className="card-body"><Histogram values={routingValues} bins={22} color="var(--ink)" height={110} target={500} xLabel="ms" /></div>
        </div>
      </div>

      <div className="section-h"><div className="lbl">Parser confidence & cache</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="card-head"><span className="label">Parse confidence</span><span className="muted mono tiny">orders below 75% trigger VLM</span></div>
          <div className="card-body"><Histogram values={confValues} bins={30} color="var(--ink)" height={130} target={75} xLabel="%" /></div>
        </div>
        <div className="card">
          <div className="card-head"><span className="label">Postcode cache</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Stat label="hit rate" value={(stats.pcHit * 100).toFixed(1)} unit="%" />
            <div className="muted tiny">Cache hits avoid an external geocode call. Misses are 200–400ms each.</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span className="label">Low-confidence orders</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Stat label="confidence &lt;75%" value={stats.confLow} unit="orders" />
            <div className="muted tiny">These were either VLM-recovered or flagged for manual review.</div>
          </div>
        </div>
      </div>

      <div className="section-h"><div className="lbl">Errors</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
        <div className="card">
          <div className="card-head"><span className="label">By kind · 30d</span></div>
          <div className="card-body">
            {errorTypes.length === 0 && <div className="muted tiny">No errors.</div>}
            {errorTypes.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--hair)' }}>
                <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--skip)' }}>{k}</span>
                <span className="mono" style={{ fontSize: 12 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span className="label">Recent error events</span></div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            {recentErrors.map(e => (
              <div className="error-row" key={e.id}>
                <span className="ts">{fmtTime(e.received_at)}</span>
                <span className="kind">{e.error}</span>
                <span className="msg">@{e.rider.handle} · order #{e.id} · parser={e.parser_used} · conf {(e.parse_confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PipelinePage });
