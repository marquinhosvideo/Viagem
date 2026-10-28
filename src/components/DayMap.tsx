import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { ExternalLink, MapPinned } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { Day, Trip } from '../types'
import {
  buildDayMapStops,
  coordsForStop,
  geocodeQuery,
  googleMapsDirUrl,
  type Coords,
  type MapStop,
} from '../lib/dayMap'

type Props = {
  trip: Trip
  day: Day
}

export function DayMap({ trip, day }: Props) {
  const stops = useMemo(() => buildDayMapStops(trip, day), [trip, day])
  const mapsUrl = useMemo(() => (stops.length ? googleMapsDirUrl(stops) : ''), [stops])
  const knownCoords = useMemo(() => {
    const next: Record<string, Coords> = {}
    for (const stop of stops) {
      const known = coordsForStop(stop)
      if (known) next[stop.id] = known
    }
    return next
  }, [stops])
  const [extraCoords, setExtraCoords] = useState<Record<string, Coords>>({})
  const coords = useMemo(() => {
    const next: Record<string, Coords> = {}
    for (const stop of stops) {
      const found = knownCoords[stop.id] ?? extraCoords[stop.query]
      if (found) next[stop.id] = found
    }
    return next
  }, [stops, knownCoords, extraCoords])

  useEffect(() => {
    if (!stops.length) return
    let cancelled = false
    void (async () => {
      for (const stop of stops) {
        if (knownCoords[stop.id] || extraCoords[stop.query]) continue
        const found = await geocodeQuery(stop.query)
        if (cancelled || !found) continue
        setExtraCoords((current) => ({ ...current, [stop.query]: found }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stops, knownCoords, extraCoords])

  if (stops.length < 2) return null

  return (
    <section className="band">
      <div className="band__inner">
        <h2 className="section-title">Mapa do dia.</h2>
        <p className="section-sub">
          Percurso saindo do hotel, na ordem dos endereços — para ver a distância entre os
          pontos.
        </p>
        <DayLeafletMap stops={stops} coords={coords} />
        <ol className="day-map__legend">
          {stops.map((stop, index) => (
            <li key={stop.id} className="day-map__legend-item">
              <span
                className={`day-map__badge ${stop.kind === 'hotel' ? 'day-map__badge--hotel' : ''}`}
              >
                {stop.kind === 'hotel' ? 'H' : index}
              </span>
              <span>
                <strong>{stop.label}</strong>
                {stop.kind === 'hotel' ? ' · ponto de partida' : null}
              </span>
            </li>
          ))}
        </ol>
        <a
          className="btn btn--primary day-map__open"
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={18} aria-hidden />
          Abrir rota no Google Maps
        </a>
      </div>
    </section>
  )
}

function DayLeafletMap({
  stops,
  coords,
}: {
  stops: MapStop[]
  coords: Record<string, Coords>
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const points = stops
      .map((stop) => {
        const point = coords[stop.id]
        if (!point) return null
        return { stop, point }
      })
      .filter((item): item is { stop: MapStop; point: Coords } => item != null)
    if (!points.length) return

    const map = L.map(host, {
      scrollWheelZoom: false,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    const latLngs = points.map(({ point }) => L.latLng(point.lat, point.lng))
    if (latLngs.length >= 2) {
      L.polyline(latLngs, {
        color: '#292524',
        weight: 3,
        opacity: 0.85,
      }).addTo(map)
    }

    points.forEach(({ stop, point }) => {
      const hotel = stop.kind === 'hotel'
      const number = stops.findIndex((item) => item.id === stop.id)
      L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: `day-map__marker ${hotel ? 'day-map__marker--hotel' : ''}`,
          html: `<span>${hotel ? 'H' : number}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: stop.label,
      })
        .bindPopup(stop.label)
        .addTo(map)
    })

    if (latLngs.length === 1) map.setView(latLngs[0], 13)
    else map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36], maxZoom: 13 })
    window.setTimeout(() => map.invalidateSize(), 80)

    return () => {
      map.remove()
    }
  }, [stops, coords])

  const ready = stops.some((stop) => coords[stop.id])

  return (
    <div className="day-map">
      <div ref={hostRef} className="day-map__canvas" />
      {!ready ? (
        <p className="day-map__pending">
          <MapPinned size={18} aria-hidden />
          Montando o mapa…
        </p>
      ) : null}
    </div>
  )
}
