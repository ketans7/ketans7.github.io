/* global React, L */
// Hunting page — historical pickup density + OSM food/shop overlay.
// Pure read; fetches /api/hunting once on mount.

const { useEffect: useEffHunt, useState: useStateHunt, useRef: useRefHunt, useMemo: useMemoHunt } = React;

const CATEGORY_COLOR = {
  restaurant:  '#1F7A4D',
  fast_food:   '#B53A2A',
  cafe:        '#B47A0F',
  bar:         '#5C4E8A',
  pub:         '#5C4E8A',
  food_court:  '#0B0B0F',
  supermarket: '#00B8D4',
  convenience: '#00B8D4',
  bakery:      '#B47A0F',
  deli:        '#B47A0F',
  alcohol:     '#5C4E8A',
  greengrocer: '#1F7A4D',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_COLOR);

function HuntingPage() {
  const [data, setData] = useStateHunt(null);
  const [loading, setLoading] = useStateHunt(true);
  const [showVenues, setShowVenues] = useStateHunt(true);
  const [showClusters, setShowClusters] = useStateHunt(true);
  const [selectedCats, setSelectedCats] = useStateHunt(new Set(ALL_CATEGORIES));
  const mapRef = useRefHunt(null);
  const elRef = useRefHunt(null);
  const layersRef = useRefHunt([]);

  // initial fetch
  useEffHunt(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/hunting');
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setData(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // init leaflet
  useEffHunt(() => {
    if (!elRef.current || mapRef.current) return;
    const m = L.map(elRef.current, { preferCanvas: true })
      .setView([51.5180, -0.0925], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OSM, &copy; CARTO' }).addTo(m);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19, pane: 'shadowPane' }).addTo(m);
    mapRef.current = m;
    setTimeout(() => m.invalidateSize(), 60);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // redraw on data / toggle changes
  useEffHunt(() => {
    const m = mapRef.current;
    if (!m || !data) return;
    for (const l of layersRef.current) m.removeLayer(l);
    layersRef.current = [];

    if (showVenues) {
      for (const v of data.osm_venues) {
        if (!selectedCats.has(v.category)) continue;
        const color = CATEGORY_COLOR[v.category] || '#0B0B0F';
        const dot = L.circleMarker([v.lat, v.lon], {
          radius: 2.5, color: '#fff', weight: 0.4,
          fillColor: color, fillOpacity: 0.85,
        }).bindTooltip(
          `${v.name || '(unnamed)'} · ${v.category}`,
          { direction: 'top', sticky: true },
        );
        dot.addTo(m);
        layersRef.current.push(dot);
      }
    }

    if (showClusters) {
      for (const c of data.pickup_clusters) {
        const radius = 8 + Math.sqrt(c.orders) * 4;
        const pphColor = c.avg_pph >= 18 ? '#1F7A4D'
          : c.avg_pph >= 13 ? '#B47A0F'
          : '#B53A2A';
        const ring = L.circleMarker([c.lat, c.lon], {
          radius,
          color: pphColor, weight: 2,
          fillColor: pphColor, fillOpacity: 0.25,
        }).bindTooltip(
          `<b>${c.postcode}</b><br/>${c.orders} orders · £${c.avg_pph.toFixed(1)}/hr avg`,
          { direction: 'top', sticky: true },
        );
        ring.addTo(m);
        layersRef.current.push(ring);
      }
    }
  }, [data, showVenues, showClusters, selectedCats]);

  const venueCounts = useMemoHunt(() => {
    const counts = {};
    if (!data) return counts;
    for (const v of data.osm_venues) {
      counts[v.category] = (counts[v.category] || 0) + 1;
    }
    return counts;
  }, [data]);

  function toggleCat(c) {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, height: 'calc(100vh - 110px)' }}>
        <div className="card" style={{ overflow: 'hidden', position: 'relative' }}>
          <div className="card-head">
            <span className="label">Hunting · density map</span>
            <span className="muted mono tiny">
              {data
                ? `${data.osm_venues.length} venues · ${data.pickup_clusters.length} pickup clusters`
                : 'loading…'}
            </span>
          </div>
          <div style={{ height: 'calc(100% - 44px)', width: '100%' }} ref={elRef} />
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.7)', fontSize: 13,
            }}>
              loading hunting data…
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <div className="card">
            <div className="card-head"><span className="label">Layers</span></div>
            <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={showClusters} onChange={e => setShowClusters(e.target.checked)} />
                Pickup history (sized by orders, coloured by £/hr)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={showVenues} onChange={e => setShowVenues(e.target.checked)} />
                OSM venues
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="label">Venue categories</span>
              <span className="muted mono tiny">{Object.keys(venueCounts).length} types</span>
            </div>
            <div className="card-body" style={{ fontSize: 12, lineHeight: 1.7 }}>
              {ALL_CATEGORIES.filter(c => venueCounts[c]).map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={selectedCats.has(c)}
                    onChange={() => toggleCat(c)}
                  />
                  <span style={{
                    display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                    background: CATEGORY_COLOR[c],
                  }}></span>
                  <span style={{ flex: 1 }}>{c}</span>
                  <span className="mono tiny muted">{venueCounts[c]}</span>
                </label>
              ))}
              {Object.keys(venueCounts).length === 0 && !loading && (
                <div className="muted" style={{ padding: 8, fontSize: 12 }}>
                  No OSM data yet. Run <code>uv run python scripts/ingest_osm.py</code>
                  to seed central London (~5 min download).
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="label">How this works</span></div>
            <div className="card-body" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-2)' }}>
              <p>Pickup clusters come from real orders the bot has processed. Ring colour reflects average £/hr; size reflects volume.</p>
              <p>OSM venues come from OpenStreetMap — restaurants, supermarkets, cafés. Density is a proxy for "where delivery demand happens".</p>
              <p>For per-rider suggestions, riders send <code>/suggest</code> in Telegram.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HuntingPage });
