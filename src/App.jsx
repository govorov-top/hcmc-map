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

function aptIcon(zone, active) {
  const color = zone ? ZONES[zone].color : '#64748b'
  return L.divIcon({
    className: '',
    html: `<div class="apt-pin ${active ? 'active' : ''}" style="--pin:${color}"><div class="apt-pin-dot"></div></div>`,
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

function Gallery({ photos, title }) {
  const [i, setI] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  if (!photos?.length) return null
  return (
    <>
      <div className="gallery">
        <img src={photos[i]} alt={title} onClick={() => setZoomed(true)} />
        {photos.length > 1 && (
          <>
            <button className="nav prev" onClick={() => setI((i - 1 + photos.length) % photos.length)}>‹</button>
            <button className="nav next" onClick={() => setI((i + 1) % photos.length)}>›</button>
            <div className="dots">
              {photos.map((_, k) => (
                <span key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} />
              ))}
            </div>
          </>
        )}
      </div>
      {zoomed && (
        <div className="lightbox" onClick={() => setZoomed(false)}>
          <img src={photos[i]} alt={title} />
        </div>
      )}
    </>
  )
}

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

  const apts = useMemo(() => apartments.map((a) => ({ ...a, zone: zoneOf(a) })), [])
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
        {apts.map((a) => (
          <Marker
            key={a.id}
            position={[a.lat, a.lng]}
            icon={aptIcon(a.zone, a.id === selected)}
            zIndexOffset={a.id === selected ? 1000 : 0}
            eventHandlers={{
              click: () => {
                setSelected(a.id)
                setFlyTarget({ lat: a.lat, lng: a.lng, t: Date.now() })
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -36]}>{a.title}</Tooltip>
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

      <div className="legend">
        <div className="legend-title">Walk time to school</div>
        {[25, 35, 45].map((c) => (
          <div key={c} className="legend-row">
            <span className="swatch" style={{ background: ZONES[c].color }} />
            {ZONES[c].label}
          </div>
        ))}
      </div>

      {apts.length > 0 && (
        <div className="apt-list">
          <div className="legend-title">Apartments ({apts.length})</div>
          {apts.map((a) => (
            <button
              key={a.id}
              className={`apt-row ${a.id === selected ? 'active' : ''}`}
              onClick={() => {
                setSelected(a.id)
                setFlyTarget({ lat: a.lat, lng: a.lng, t: Date.now() })
              }}
            >
              <span className="swatch" style={{ background: a.zone ? ZONES[a.zone].color : '#64748b' }} />
              <span className="apt-row-title">{a.title}</span>
              {a.price && <span className="apt-row-price">{a.price}</span>}
            </button>
          ))}
        </div>
      )}

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
