/* global React, L */
// Map primitives — wraps Leaflet with a clean light style (CartoDB Positron)
// plus several overlay modes: route (single order), heat (postcode density),
// live (active riders), pickups, dropoffs.

const { useEffect, useRef } = React;

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
const TILE_LABELS = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap, &copy; CARTO';

function makeMap(el, opts = {}) {
  const m = L.map(el, {
    zoomControl: opts.zoomControl !== false,
    attributionControl: true,
    preferCanvas: true,
    scrollWheelZoom: opts.scrollWheelZoom !== false,
    dragging: opts.dragging !== false,
    doubleClickZoom: opts.doubleClickZoom !== false,
    keyboard: false,
  }).setView(opts.center || [51.5180, -0.0925], opts.zoom || 13);
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, subdomains: 'abcd' }).addTo(m);
  L.tileLayer(TILE_LABELS, { maxZoom: 19, subdomains: 'abcd', pane: 'shadowPane' }).addTo(m);
  return m;
}

// generic divIcon
function pinIcon(html, w = 18, h = 18) {
  return L.divIcon({
    className: 'ri-pin',
    html: '<div style="position:relative">' + html + '</div>',
    iconSize: [w, h], iconAnchor: [w / 2, h / 2],
  });
}

// the main map component — driven by `mode` and `payload`
function RiMap({
  mode = 'overview', // 'overview' | 'route' | 'heat' | 'live' | 'riders' | 'rider'
  height = 380,
  payload = {},
  fit,
  zoomControl = true,
  showLegend = true,
  legendItems,
  overlayItems,
  toolbar,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);

  // init once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    mapRef.current = makeMap(elRef.current, {
      center: payload.center,
      zoom: payload.zoom,
      zoomControl,
    });
    // invalidate after a tick to handle initial paint
    setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 60);
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line
  }, []);

  // redraw overlays on payload/mode change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // wipe existing overlays
    for (const l of layersRef.current) map.removeLayer(l);
    layersRef.current = [];

    if (mode === 'route' && payload.order) {
      drawRoute(map, payload.order, layersRef);
    } else if (mode === 'heat') {
      drawHeat(map, payload.areas || window.RI.AREAS, payload.field, layersRef);
    } else if (mode === 'live') {
      drawLive(map, payload, layersRef);
    } else if (mode === 'rider') {
      drawRiderTrail(map, payload.rider, payload.orders || [], layersRef);
    } else if (mode === 'overview') {
      drawOverviewActivity(map, payload.orders || [], layersRef);
    } else if (mode === 'pickups') {
      drawPickupDensity(map, payload.orders || [], layersRef);
    }

    // fit
    if (fit && layersRef.current.length) {
      const group = L.featureGroup(layersRef.current);
      try { map.fitBounds(group.getBounds().pad(0.18)); } catch (e) {}
    }
    setTimeout(() => map.invalidateSize(), 30);
  }, [mode, payload, fit]);

  return (
    <div className="map-wrap" style={{ height, width: '100%' }}>
      <div ref={elRef} style={{ height: '100%', width: '100%' }} />
      {overlayItems && (
        <div className="map-overlay">
          {overlayItems.map((it, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="div"></div>}
              <div>{it.label} <span className="v">{it.value}</span></div>
            </React.Fragment>
          ))}
        </div>
      )}
      {toolbar && (
        <div className="map-toolbar">
          {toolbar.map((t, i) => (
            <button key={i} className={t.active ? 'active' : ''} onClick={t.onClick}>{t.label}</button>
          ))}
        </div>
      )}
      {showLegend && legendItems && (
        <div className="map-legend">
          {legendItems.map((it, i) => (
            <div className="row" key={i}>
              <span className="sw" style={{ background: it.color, ...(it.style || {}) }}></span>
              <span>{it.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function _validLatLon(o) {
  return o && typeof o.lat === 'number' && typeof o.lon === 'number'
    && !Number.isNaN(o.lat) && !Number.isNaN(o.lon)
    && o.lat !== 0 && o.lon !== 0;
}

function drawRoute(map, order, layersRef) {
  // Prefer the actual cycling polyline from Mapbox (GeoJSON: [[lon,lat], ...]).
  // Fall back to straight segments only if geometry is missing.
  let path;
  if (Array.isArray(order.route_geometry) && order.route_geometry.length >= 2) {
    path = order.route_geometry.map(([lon, lat]) => [lat, lon]);
  } else {
    const stops = [
      { lat: order.rider_lat, lon: order.rider_lon, kind: 'rider' },
      ...(order.pickups || []).map((p, i) => ({ ...p, kind: 'pickup', idx: i + 1 })),
      ...(order.dropoffs || []).map((d, i) => ({ ...d, kind: 'dropoff', idx: i + 1 })),
    ].filter(_validLatLon);
    path = stops.map(s => [s.lat, s.lon]);
  }

  if (path.length >= 2) {
    const shadow = L.polyline(path, { color: '#000', weight: 7, opacity: 0.07, lineCap: 'round' }).addTo(map);
    const line = L.polyline(path, { color: '#0B0B0F', weight: 3, opacity: 1, lineCap: 'round' }).addTo(map);
    layersRef.current.push(shadow, line);
  }

  if (_validLatLon({ lat: order.rider_lat, lon: order.rider_lon })) {
    const rider = L.marker([order.rider_lat, order.rider_lon], {
      icon: pinIcon('<div class="rider-pin pulse"></div>', 14, 14),
    }).addTo(map);
    layersRef.current.push(rider);
  }

  (order.pickups || []).forEach((p, i) => {
    if (!_validLatLon(p)) return;
    const m = L.marker([p.lat, p.lon], {
      icon: pinIcon('<div class="pickup-pin">' + (i + 1) + '</div>', 18, 18),
    }).bindTooltip(`<b>${p.restaurant || 'Pickup ' + (i + 1)}</b><br/>${p.postcode || '?'} · ${p.items || 1} items`, { direction: 'top' }).addTo(map);
    layersRef.current.push(m);
  });

  (order.dropoffs || []).forEach((d, i) => {
    if (!_validLatLon(d)) return;
    const m = L.marker([d.lat, d.lon], {
      icon: pinIcon('<div class="dropoff-pin">' + (i + 1) + '</div>', 18, 18),
    }).bindTooltip(`Dropoff ${i + 1}<br/>${d.postcode || '?'}`, { direction: 'top' }).addTo(map);
    layersRef.current.push(m);
  });
}

function drawHeat(map, areas, field, layersRef) {
  // each area as a soft circle, radius weighted by area.weight
  for (const a of areas) {
    const weight = a.weight || 5;
    const r = 200 + weight * 90;
    // outer glow
    const c1 = L.circle([a.lat, a.lon], {
      radius: r * 1.4,
      color: '#00B8D4', weight: 0,
      fillColor: '#00B8D4', fillOpacity: 0.04 + weight * 0.012,
    }).addTo(map);
    const c2 = L.circle([a.lat, a.lon], {
      radius: r,
      color: '#00B8D4', weight: 0,
      fillColor: '#00B8D4', fillOpacity: 0.08 + weight * 0.018,
    }).addTo(map);
    const c3 = L.circle([a.lat, a.lon], {
      radius: r * 0.5,
      color: '#0B0B0F', weight: 0,
      fillColor: '#0B0B0F', fillOpacity: 0.15 + weight * 0.02,
    }).bindTooltip(`<b>${a.name}</b><br/>${a.pc} · weight ${a.weight}`, { direction: 'top' }).addTo(map);
    layersRef.current.push(c1, c2, c3);
  }
}

function drawPickupDensity(map, orders, layersRef) {
  for (const o of orders || []) {
    for (const p of (o.pickups || [])) {
      if (!_validLatLon(p)) continue;
      const dot = L.circleMarker([p.lat, p.lon], {
        radius: 3, color: '#0B0B0F', weight: 0,
        fillColor: '#0B0B0F', fillOpacity: 0.35,
      }).addTo(map);
      layersRef.current.push(dot);
    }
  }
}

function drawLive(map, payload, layersRef) {
  // Two layers: recent order positions (rider GPS at submission, dot coloured
  // by verdict) and live-sharing riders (cyan pulse).
  const verdictColor = { accept: '#1F7A4D', borderline: '#B47A0F', skip: '#B53A2A', manual_check: '#5C4E8A' };
  for (const o of (payload.orders || [])) {
    if (!_validLatLon({ lat: o.rider_lat, lon: o.rider_lon })) continue;
    const dot = L.circleMarker([o.rider_lat, o.rider_lon], {
      radius: 4, color: '#fff', weight: 1,
      fillColor: verdictColor[o.verdict] || '#0B0B0F', fillOpacity: 0.9,
    }).bindTooltip(`Order #${o.id} · @${(o.rider || {}).handle || '?'} · £${(o.pounds_per_hour || 0).toFixed(1)}/hr`, { direction: 'top' }).addTo(map);
    layersRef.current.push(dot);
  }
  for (const r of (payload.riders || [])) {
    if (!r.live) continue;
    const lat = r.lastLat ?? (r.homeArea && r.homeArea.lat);
    const lon = r.lastLon ?? (r.homeArea && r.homeArea.lon);
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const m = L.marker([lat, lon], {
      icon: pinIcon('<div class="rider-pin pulse"></div>', 14, 14),
    }).bindTooltip(`<b>@${r.handle}</b><br/>${r.first}`, { direction: 'top' }).addTo(map);
    layersRef.current.push(m);
  }
}

function drawRiderTrail(map, rider, orders, layersRef) {
  // line through orders received_at sorted asc
  const valid = (orders || []).filter(o => _validLatLon({ lat: o.rider_lat, lon: o.rider_lon }));
  const sorted = [...valid].sort((a, b) => a.received_at - b.received_at);
  const path = sorted.map(o => [o.rider_lat, o.rider_lon]);
  if (path.length > 1) {
    const line = L.polyline(path, { color: '#0B0B0F', weight: 2, opacity: 0.4, dashArray: '4 4' }).addTo(map);
    layersRef.current.push(line);
  }
  // markers for each order (small dots)
  sorted.forEach((o, i) => {
    const verdictColor = { accept: '#1F7A4D', borderline: '#B47A0F', skip: '#B53A2A', manual_check: '#5C4E8A' }[o.verdict];
    const m = L.circleMarker([o.rider_lat, o.rider_lon], {
      radius: 4.5, color: '#fff', weight: 1.5,
      fillColor: verdictColor, fillOpacity: 1,
    }).bindTooltip(`Order #${o.id} · £${o.pounds_per_hour.toFixed(1)}/hr`, { direction: 'top' }).addTo(map);
    layersRef.current.push(m);
  });
  // current location (last)
  if (sorted.length) {
    const last = sorted[sorted.length - 1];
    const cur = L.marker([last.rider_lat, last.rider_lon], {
      icon: pinIcon('<div class="rider-pin pulse"></div>', 14, 14),
    }).addTo(map);
    layersRef.current.push(cur);
  }
}

function drawOverviewActivity(map, orders, layersRef) {
  const palette = { accept: '#1F7A4D', borderline: '#B47A0F', skip: '#B53A2A', manual_check: '#5C4E8A' };
  for (const o of (orders || [])) {
    if (!_validLatLon({ lat: o.rider_lat, lon: o.rider_lon })) continue;
    const dot = L.circleMarker([o.rider_lat, o.rider_lon], {
      radius: 3.5, color: '#fff', weight: 1,
      fillColor: palette[o.verdict] || '#0B0B0F', fillOpacity: 0.9,
    }).addTo(map);
    layersRef.current.push(dot);
  }
}

Object.assign(window, { RiMap });
