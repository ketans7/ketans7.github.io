/* global React, RiMap, VerdictChip, fmtTime, fmtAgo, fmtPph */

const { useEffect: useEffectL, useState: useStateL, useMemo: useMemoL, useRef: useRefL } = React;

const LIVE_POLL_MS = 10_000;     // refresh from /api/data every 10s
const LIVE_FEED_LIMIT = 30;       // cap the visible feed
const LIVE_RECENT_WINDOW_MS = 60 * 60 * 1000; // "live activity" = last 60 min

function LivePage({ openOrder }) {
  const [paused, setPaused] = useStateL(false);
  const [bumpKey, setBumpKey] = useStateL(0);          // forces re-derivation when data refreshes
  const lastSeenIdRef = useRefL(0);

  const allOrders = window.RI.orders || [];
  const allRiders = window.RI.riders || [];

  // Poll the API for fresh data. Live feed is real Telegram traffic only.
  useEffectL(() => {
    if (paused) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const resp = await fetch('/api/data');
        if (!resp.ok) return;
        const next = await resp.json();
        if (cancelled) return;
        window.RI = next;
        setBumpKey(k => k + 1);
      } catch { /* swallow */ }
    };
    const id = setInterval(tick, LIVE_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [paused]);

  // Derive feed: real orders sorted newest-first, capped.
  const feed = useMemoL(() => {
    const sorted = [...allOrders].sort((a, b) => b.received_at - a.received_at);
    const out = sorted.slice(0, LIVE_FEED_LIMIT);
    // Flag any order id we haven't seen before as new (flashes once).
    const prevId = lastSeenIdRef.current;
    const maxId = out.reduce((m, o) => Math.max(m, o.id || 0), 0);
    if (maxId > prevId) lastSeenIdRef.current = maxId;
    return out.map(o => ({ ...o, __isNew: o.id > prevId }));
  }, [bumpKey, allOrders.length]);

  // Map points: actual rider GPS positions on recent orders + live-location riders.
  const recentOrders = useMemoL(
    () => allOrders.filter(o => o.rider_lat && o.rider_lon
      && (Date.now() - o.received_at) < LIVE_RECENT_WINDOW_MS),
    [bumpKey, allOrders.length],
  );

  const liveRiders = useMemoL(
    () => allRiders.filter(r => r.live),
    [bumpKey, allRiders.length],
  );

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 14, height: 'calc(100vh - 110px)' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-head">
            <span className="label">
              Live activity · {recentOrders.length} orders in last hour
              {liveRiders.length ? ` · ${liveRiders.length} sharing live` : ''}
            </span>
            <span className="muted mono tiny">refresh every {LIVE_POLL_MS / 1000}s</span>
          </div>
          <RiMap
            mode="live"
            payload={{
              orders: recentOrders,
              riders: liveRiders,
              center: [51.5180, -0.0925],
              zoom: 12,
            }}
            height="calc(100% - 44px)"
            overlayItems={[
              { label: 'orders (1h)', value: recentOrders.length },
              { label: 'live', value: liveRiders.length },
              { label: 'online (no live)', value: allRiders.filter(r => r.online && !r.live).length },
            ]}
            legendItems={[
              { color: 'var(--signal)', label: 'sharing live location' },
              { color: 'var(--ink-2)',  label: 'recent order' },
            ]}
          />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-head" style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
            <span className="label">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: paused ? 'var(--ink-3)' : '#22c55e', borderRadius: '50%', animation: paused ? 'none' : 'pulse 1.6s infinite' }}></span>
                {paused ? 'paused' : 'live feed'}
              </span>
            </span>
            <button className="btn" onClick={() => setPaused(!paused)}>{paused ? '▶ resume' : '⏸ pause'}</button>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            {feed.length === 0 && (
              <div className="muted" style={{ padding: 24, fontSize: 13, textAlign: 'center' }}>
                No orders yet. They'll show up here as riders send screenshots.
              </div>
            )}
            {feed.map((o) => (
              <div key={o.id} className={'feed-row' + (o.__isNew ? ' new' : '')} onClick={() => openOrder(o)} style={{ cursor: 'pointer' }}>
                <div className="ts">{fmtAgo(o.received_at)}</div>
                <VerdictChip v={o.verdict} />
                <div>
                  <div className="who">@{o.rider.handle} · <span className="muted">{(o.pickups || []).map(p => p.restaurant).filter(Boolean).join(', ') || '—'}</span></div>
                  <div className="summary mono tiny">£{(o.pounds_per_hour || 0).toFixed(1)}/hr · {((o.route_distance_m || 0) / 1000).toFixed(1)}km · {o.pickups.length}P/{o.dropoffs.length}D · {(o.parser_used || 'OCR').toUpperCase()}</div>
                </div>
                <div className="mono tiny" style={{ color: 'var(--ink-3)' }}>#{o.id}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LivePage });
