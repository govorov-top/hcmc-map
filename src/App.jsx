import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import isochrones from './isochrones.json'
import apartments from './apartments.json'
import './App.css'

const SCHOOL = { lat: 10.7902254, lng: 106.6883564, name: 'School (Muse Inc)' }

const ZONES = {
  25: { color: '#16a34a', label: '≤ 25 min walk' },
  35: { color: '#eab308', label: '25–35 min walk' },
  45: { color: '#dc2626', label: '35–45 min walk' },
}

const schoolIcon = L.divIcon({
  className: '',
  html: '<div class="school-pin">🏫</div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

function aptIcon(zone, active, approx) {
  const color = zone ? ZONES[zone].color : '#64748b'
  const inner = approx
    ? '<div class="apt-pin-mark">?</div><div class="apt-pin-warn">!</div>'
    : '<div class="apt-pin-dot"></div>'
  return L.divIcon({
    className: '',
    html: `<div class="apt-pin ${active ? 'active' : ''}" style="--pin:${color}">${inner}</div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  })
}

// ray casting: is [lng,lat] point inside a GeoJSON polygon ring set
function inRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function inFeature(pt, feature) {
  const g = feature.geometry
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
  return polys.some((poly) => inRing(pt, poly[0]) && !poly.slice(1).some((hole) => inRing(pt, hole)))
}

function zoneOf(apt) {
  const pt = [apt.lng, apt.lat]
  for (const contour of [25, 35, 45]) {
    const f = isochrones.features.find((f) => f.properties.contour === contour)
    if (f && inFeature(pt, f)) return contour
  }
  return null
}

// Valhalla encoded polyline, precision 1e6
function decodePolyline(str) {
  let i = 0, lat = 0, lng = 0
  const coords = []
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, byte
      do {
        byte = str.charCodeAt(i++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (which === 0) lat += delta
      else lng += delta
    }
    coords.push([lat / 1e6, lng / 1e6])
  }
  return coords
}

const routeCache = {}

async function fetchRoute(apt, costing) {
  const key = `${apt.id}:${costing}`
  if (routeCache[key]) return routeCache[key]
  const res = await fetch('https://valhalla1.openstreetmap.de/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: [
        { lat: SCHOOL.lat, lon: SCHOOL.lng },
        { lat: apt.lat, lon: apt.lng },
      ],
      costing,
      directions_options: { units: 'kilometers' },
    }),
  })
  if (!res.ok) throw new Error(`route ${res.status}`)
  const data = await res.json()
  const leg = data.trip.legs[0]
  const route = {
    coords: decodePolyline(leg.shape),
    minutes: Math.round(data.trip.summary.time / 60),
    km: Math.round(data.trip.summary.length * 10) / 10,
  }
  routeCache[key] = route
  return route
}

const ROUTE_STYLE = {
  walk: { color: '#2563eb', dashArray: '8 8', label: '🚶 walk' },
  bike: { color: '#9333ea', dashArray: null, label: '🛵 bike' },
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [target, map])
  return null
}

const isVideo = (src) => /\.(mp4|webm|mov)$/i.test(src)

function Gallery({ photos, title }) {
  const [i, setI] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  if (!photos?.length) return null
  const current = photos[i]
  const video = isVideo(current)
  return (
    <>
      <div className="gallery">
        {video ? (
          <video src={current} controls playsInline preload="metadata" />
        ) : (
          <img src={current} alt={title} onClick={() => setZoomed(true)} />
        )}
        {photos.length > 1 && (
          <>
            <button className="nav prev" onClick={() => setI((i - 1 + photos.length) % photos.length)}>‹</button>
            <button className="nav next" onClick={() => setI((i + 1) % photos.length)}>›</button>
            <div className="dots">
              {photos.map((p, k) => (
                <span
                  key={k}
                  className={`${k === i ? 'on' : ''} ${isVideo(p) ? 'vid' : ''}`}
                  onClick={() => setI(k)}
                />
              ))}
            </div>
          </>
        )}
        {photos.some(isVideo) && !video && <span className="video-hint">▶ video inside</span>}
      </div>
      {zoomed && !video && (
        <div className="lightbox" onClick={() => setZoomed(false)}>
          <img src={current} alt={title} />
        </div>
      )}
    </>
  )
}

const FEATURE_LABELS = {
  balcony: 'Balcony',
  terrace: 'Terrace / rooftop',
  washer: 'Washer',
  dryer: 'Dryer',
  bathtub: 'Bathtub',
  kitchen: 'Kitchen',
  elevator: 'Elevator',
  parking: 'Parking',
  cleaning: 'Cleaning service',
  laundry: 'Laundry service',
  wifi: 'WiFi included',
  tv: 'TV',
  aircon: 'Air conditioner',
  fridge: 'Fridge',
  security: 'Security / CCTV',
  furnished: 'Fully furnished',
}

const ROOM_LABELS = { studio: 'Studio', '1br': '1 bedroom', '2br': '2 bedrooms' }

const SORTS = {
  distance: { label: 'Closest to school', fn: (a, b) => a.km - b.km },
  priceAsc: { label: 'Price: low to high', fn: (a, b) => a.price_vnd - b.price_vnd },
  priceDesc: { label: 'Price: high to low', fn: (a, b) => b.price_vnd - a.price_vnd },
  areaDesc: { label: 'Size: large to small', fn: (a, b) => (b.area || 0) - (a.area || 0) },
}

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const fmtM = (v) => (v % 1000000 === 0 ? `${v / 1000000}M` : `${(v / 1000000).toFixed(1)}M`)

function FitRoutes({ routes }) {
  const map = useMap()
  useEffect(() => {
    const all = Object.values(routes).flatMap((r) => r?.coords ?? [])
    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [60, 60] })
  }, [routes, map])
  return null
}

export default function App() {
  const [selected, setSelected] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [routes, setRoutes] = useState({})
  const [routesLoading, setRoutesLoading] = useState(false)

  const apts = useMemo(
    () =>
      apartments.map((a) => ({
        ...a,
        zone: zoneOf(a),
        km: Math.round(haversineKm(SCHOOL, a) * 10) / 10,
      })),
    []
  )

  const bounds = useMemo(() => {
    const prices = apts.map((a) => a.price_vnd)
    const areas = apts.map((a) => a.area).filter(Boolean)
    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      minArea: Math.min(...areas),
      maxArea: Math.max(...areas),
      districts: [...new Set(apts.map((a) => a.district).filter(Boolean))].sort(),
      agents: [...new Set(apts.map((a) => a.agent.name))].sort(),
      features: [...new Set(apts.flatMap((a) => a.features))].sort(
        (x, y) => Object.keys(FEATURE_LABELS).indexOf(x) - Object.keys(FEATURE_LABELS).indexOf(y)
      ),
    }
  }, [apts])

  const emptyFilters = useMemo(
    () => ({
      maxPrice: bounds.maxPrice,
      minArea: 0,
      unknownArea: true,
      rooms: [],
      zones: [],
      districts: [],
      agents: [],
      features: [],
      exactOnly: false,
      videoOnly: false,
    }),
    [bounds]
  )

  const [filters, setFilters] = useState(emptyFilters)
  const [sort, setSort] = useState('distance')
  const [panelOpen, setPanelOpen] = useState(true)

  const toggle = (key, value) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }))

  const visible = useMemo(() => {
    const out = apts.filter((a) => {
      if (a.price_vnd > filters.maxPrice) return false
      if (filters.minArea > 0) {
        if (!a.area) return filters.unknownArea
        if (a.area < filters.minArea) return false
      }
      if (filters.rooms.length && !filters.rooms.includes(a.rooms || 'unknown')) return false
      if (filters.zones.length && !filters.zones.includes(String(a.zone || 'far'))) return false
      if (filters.districts.length && !filters.districts.includes(a.district)) return false
      if (filters.agents.length && !filters.agents.includes(a.agent.name)) return false
      if (filters.features.some((f) => !a.features.includes(f))) return false
      if (filters.exactOnly && a.approx) return false
      if (filters.videoOnly && !a.has_video) return false
      return true
    })
    return out.sort(SORTS[sort].fn)
  }, [apts, filters, sort])

  const activeCount =
    (filters.maxPrice < bounds.maxPrice ? 1 : 0) +
    (filters.minArea > 0 ? 1 : 0) +
    filters.rooms.length +
    filters.zones.length +
    filters.districts.length +
    filters.agents.length +
    filters.features.length +
    (filters.exactOnly ? 1 : 0) +
    (filters.videoOnly ? 1 : 0)

  const selectedApt = apts.find((a) => a.id === selected)

  useEffect(() => {
    if (!selectedApt) {
      setRoutes({})
      return
    }
    let cancelled = false
    setRoutesLoading(true)
    Promise.allSettled([
      fetchRoute(selectedApt, 'pedestrian'),
      fetchRoute(selectedApt, 'motor_scooter'),
    ]).then(([walk, bike]) => {
      if (cancelled) return
      setRoutes({
        walk: walk.status === 'fulfilled' ? walk.value : null,
        bike: bike.status === 'fulfilled' ? bike.value : null,
      })
      setRoutesLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedApt])

  const layers = useMemo(
    () =>
      [45, 35, 25].map((contour) => {
        const f = isochrones.features.find((f) => f.properties.contour === contour)
        return (
          <GeoJSON
            key={contour}
            data={f}
            style={{
              color: ZONES[contour].color,
              weight: 2,
              opacity: 0.8,
              fillColor: ZONES[contour].color,
              fillOpacity: 0.13,
            }}
          />
        )
      }),
    []
  )

  return (
    <div className="app">
      <MapContainer
        center={[SCHOOL.lat, SCHOOL.lng]}
        zoom={14}
        className="map"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {layers}
        <Marker position={[SCHOOL.lat, SCHOOL.lng]} icon={schoolIcon} zIndexOffset={500}>
          <Tooltip direction="top" offset={[0, -18]}>{SCHOOL.name}</Tooltip>
        </Marker>
        {visible.map((a) => (
          <Marker
            key={a.id}
            position={[a.lat, a.lng]}
            icon={aptIcon(a.zone, a.id === selected, a.approx)}
            zIndexOffset={a.id === selected ? 1000 : 0}
            eventHandlers={{
              click: () => {
                setSelected(a.id)
                setFlyTarget({ lat: a.lat, lng: a.lng, t: Date.now() })
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -36]}>
              {a.title}
              {a.approx && ' — approximate location'}
            </Tooltip>
          </Marker>
        ))}
        {Object.entries(routes).map(
          ([k, r]) =>
            r && (
              <Polyline
                key={`${k}-${selected}`}
                positions={r.coords}
                pathOptions={{
                  color: ROUTE_STYLE[k].color,
                  weight: 5,
                  opacity: 0.85,
                  dashArray: ROUTE_STYLE[k].dashArray,
                }}
              >
                <Tooltip sticky>{`${ROUTE_STYLE[k].label} — ${r.minutes} min, ${r.km} km`}</Tooltip>
              </Polyline>
            )
        )}
        <FitRoutes routes={routes} />
        <FlyTo target={flyTarget} />
      </MapContainer>

      <button
        className={`panel-toggle ${panelOpen ? 'open' : ''}`}
        onClick={() => setPanelOpen((v) => !v)}
      >
        {panelOpen ? '‹' : '☰'}
        {!panelOpen && activeCount > 0 && <span className="toggle-badge">{activeCount}</span>}
      </button>

      <aside className={`sidebar ${panelOpen ? '' : 'closed'}`}>
        <div className="sb-head">
          <div>
            <div className="sb-title">Filters</div>
            <div className="sb-count">
              {visible.length} of {apts.length} apartments
            </div>
          </div>
          <button
            className="sb-reset"
            disabled={activeCount === 0}
            onClick={() => setFilters(emptyFilters)}
          >
            Reset{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        </div>

        <div className="sb-body">
          <section>
            <label className="sb-label">
              Max price <b>{fmtM(filters.maxPrice)} ₫/mo</b>
            </label>
            <input
              type="range"
              min={bounds.minPrice}
              max={bounds.maxPrice}
              step={500000}
              value={filters.maxPrice}
              onChange={(e) => setFilters((f) => ({ ...f, maxPrice: +e.target.value }))}
            />
            <div className="sb-scale">
              <span>{fmtM(bounds.minPrice)}</span>
              <span>{fmtM(bounds.maxPrice)}</span>
            </div>
          </section>

          <section>
            <label className="sb-label">
              Min size <b>{filters.minArea ? `${filters.minArea} m²` : 'any'}</b>
            </label>
            <input
              type="range"
              min={0}
              max={bounds.maxArea}
              step={5}
              value={filters.minArea}
              onChange={(e) => setFilters((f) => ({ ...f, minArea: +e.target.value }))}
            />
            <div className="sb-scale">
              <span>any</span>
              <span>{bounds.maxArea} m²</span>
            </div>
            {filters.minArea > 0 && (
              <label className="sb-check">
                <input
                  type="checkbox"
                  checked={filters.unknownArea}
                  onChange={(e) => setFilters((f) => ({ ...f, unknownArea: e.target.checked }))}
                />
                keep listings with no size stated
              </label>
            )}
          </section>

          <section>
            <div className="sb-label">Walk time to school</div>
            <div className="chips">
              {[25, 35, 45].map((c) => (
                <button
                  key={c}
                  className={`chip ${filters.zones.includes(String(c)) ? 'on' : ''}`}
                  onClick={() => toggle('zones', String(c))}
                >
                  <span className="swatch" style={{ background: ZONES[c].color }} />
                  {ZONES[c].label}
                </button>
              ))}
              <button
                className={`chip ${filters.zones.includes('far') ? 'on' : ''}`}
                onClick={() => toggle('zones', 'far')}
              >
                <span className="swatch" style={{ background: '#64748b' }} />
                45+ min walk
              </button>
            </div>
          </section>

          <section>
            <div className="sb-label">Layout</div>
            <div className="chips">
              {['studio', '1br', '2br', 'unknown'].map((r) => {
                const n = apts.filter((a) => (a.rooms || 'unknown') === r).length
                if (!n) return null
                return (
                  <button
                    key={r}
                    className={`chip ${filters.rooms.includes(r) ? 'on' : ''}`}
                    onClick={() => toggle('rooms', r)}
                  >
                    {ROOM_LABELS[r] || 'Not stated'} <i>{n}</i>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <div className="sb-label">District</div>
            <div className="chips">
              {bounds.districts.map((d) => (
                <button
                  key={d}
                  className={`chip ${filters.districts.includes(d) ? 'on' : ''}`}
                  onClick={() => toggle('districts', d)}
                >
                  {d} <i>{apts.filter((a) => a.district === d).length}</i>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="sb-label">Features</div>
            <div className="chips">
              {bounds.features.map((f) => (
                <button
                  key={f}
                  className={`chip ${filters.features.includes(f) ? 'on' : ''}`}
                  onClick={() => toggle('features', f)}
                >
                  {FEATURE_LABELS[f] || f} <i>{apts.filter((a) => a.features.includes(f)).length}</i>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="sb-label">Agent</div>
            <div className="chips">
              {bounds.agents.map((n) => (
                <button
                  key={n}
                  className={`chip ${filters.agents.includes(n) ? 'on' : ''}`}
                  onClick={() => toggle('agents', n)}
                >
                  {n} <i>{apts.filter((a) => a.agent.name === n).length}</i>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="sb-check">
              <input
                type="checkbox"
                checked={filters.exactOnly}
                onChange={(e) => setFilters((f) => ({ ...f, exactOnly: e.target.checked }))}
              />
              exact location only (hide approximate pins)
            </label>
            <label className="sb-check">
              <input
                type="checkbox"
                checked={filters.videoOnly}
                onChange={(e) => setFilters((f) => ({ ...f, videoOnly: e.target.checked }))}
              />
              has video tour
            </label>
          </section>

          <section>
            <div className="sb-label">Sort by</div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="sb-select">
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </section>

          <section className="sb-results">
            <div className="sb-label">Results ({visible.length})</div>
            {visible.length === 0 && <p className="sb-empty">Nothing matches these filters.</p>}
            {visible.map((a) => (
              <button
                key={a.id}
                className={`apt-row ${a.id === selected ? 'active' : ''}`}
                onClick={() => {
                  setSelected(a.id)
                  setFlyTarget({ lat: a.lat, lng: a.lng, t: Date.now() })
                }}
              >
                <span
                  className="swatch"
                  style={{ background: a.zone ? ZONES[a.zone].color : '#64748b' }}
                />
                <span className="apt-row-main">
                  <span className="apt-row-title">
                    {a.approx && <span className="warn-badge sm" title="Approximate location">!</span>}
                    {a.title}
                  </span>
                  <span className="apt-row-meta">
                    {a.area ? `${a.area} m²` : 'size ?'} · {a.km} km
                    {a.has_video && ' · ▶'}
                  </span>
                </span>
                <span className="apt-row-price">{a.price.replace(' ₫/mo', '')}</span>
              </button>
            ))}
          </section>
        </div>
      </aside>

      {selectedApt && (
        <div className="card">
          <button className="close" onClick={() => setSelected(null)}>✕</button>
          <Gallery photos={selectedApt.photos} title={selectedApt.title} />
          <div className="card-body">
            <div className="card-header">
              <h2>{selectedApt.title}</h2>
              {selectedApt.price && <div className="price">{selectedApt.price}</div>}
            </div>
            {selectedApt.zone ? (
              <div className="zone-badge" style={{ background: ZONES[selectedApt.zone].color }}>
                {ZONES[selectedApt.zone].label}
              </div>
            ) : (
              <div className="zone-badge" style={{ background: '#64748b' }}>45+ min walk</div>
            )}
            <div className="routes">
              {routesLoading && <span className="route-chip muted">loading routes…</span>}
              {!routesLoading &&
                Object.entries(routes).map(([k, r]) => (
                  <span
                    key={k}
                    className="route-chip"
                    style={{ '--rc': ROUTE_STYLE[k].color }}
                  >
                    {r
                      ? `${ROUTE_STYLE[k].label}: ${r.minutes} min · ${r.km} km`
                      : `${ROUTE_STYLE[k].label}: n/a`}
                  </span>
                ))}
            </div>
            {selectedApt.address && <p className="addr">📍 {selectedApt.address}</p>}
            {selectedApt.approx && (
              <p className="approx-note">
                <span className="warn-badge">!</span>
                Approximate location — the agent gave no map link, so the pin sits on the street, not the exact building.
              </p>
            )}
            {selectedApt.notes && <p className="notes">{selectedApt.notes}</p>}
            {selectedApt.agent && (
              <a
                className="agent"
                href={selectedApt.agent.facebook}
                target="_blank"
                rel="noreferrer"
              >
                <img src={selectedApt.agent.photo} alt={selectedApt.agent.name} />
                <span>
                  <span className="agent-name">{selectedApt.agent.name}</span>
                  <span className="agent-sub">Agent · Facebook ↗</span>
                </span>
              </a>
            )}
            {selectedApt.whatsapp && (
              <a
                className="agent whatsapp"
                href={`https://wa.me/${selectedApt.whatsapp.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                  `Hi! I'm interested in "${selectedApt.title}" (${selectedApt.address}). Is it still available?`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <img src="agents/whatsapp.svg" alt="WhatsApp" />
                <span>
                  <span className="agent-name">{selectedApt.whatsapp.name || 'WhatsApp'}</span>
                  <span className="agent-sub">{selectedApt.whatsapp.phone} · open chat ↗</span>
                </span>
              </a>
            )}
            <div className="card-links">
              {selectedApt.link && (
                <a href={selectedApt.link} target="_blank" rel="noreferrer">Listing ↗</a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${selectedApt.lat},${selectedApt.lng}&destination=${SCHOOL.lat},${SCHOOL.lng}&travelmode=walking`}
                target="_blank"
                rel="noreferrer"
              >
                Route to school ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
