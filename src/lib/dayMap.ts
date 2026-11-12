import { PLACE_COORDS } from '../data/placeCoords'
import type { Day, Hotel, Trip } from '../types'
import { applyCanonicalHotel, CANONICAL_HOTEL } from './hotel'
import { mapsSearchQuery, placeOf, sortStops } from './places'

export const DEFAULT_HOTEL: Hotel = CANONICAL_HOTEL

/** Forces the canonical Turkey Lake hotel on the trip. */
export function ensureCurrentHotel(trip: Trip): Trip {
  return applyCanonicalHotel(trip)
}

export type MapStop = {
  id: string
  label: string
  query: string
  kind: 'hotel' | 'place'
  optional?: boolean
  /** Ordem no dia (1..n), alinhada ao rodapé de endereços. */
  orderInDay: number
}

export type Coords = { lat: number; lng: number }

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeAddress(value: string): string {
  return value
    .replace(/[⭐*]+/g, '')
    .replace(/\s*\(todos em [^)]+\)\s*$/i, '')
    .replace(/\s*\([^)]*estacionamento[^)]*\)/gi, '')
    .replace(/\binternational blvd\b/i, 'International Dr')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hotelOf(trip: Pick<Trip, 'hotel'>): Hotel {
  const name = trip.hotel?.name?.trim()
  const address = trip.hotel?.address?.trim()
  return {
    name: name || DEFAULT_HOTEL.name,
    address: address || DEFAULT_HOTEL.address,
  }
}

export function mapsQuery(name: string, address?: string | null): string {
  const cleaned = address ? sanitizeAddress(address) : ''
  return mapsSearchQuery({ name, address: cleaned || address })
}

export function stopKey(name: string, address?: string | null): string {
  const text = fold(sanitizeAddress(address || name))
    .replace(/[.,#]/g, ' ')
    .replace(/\b(ste|suite|unit|apt)\b.*$/g, ' ')
    .replace(/\bfl\b\s*\d{5}(?:-\d{4})?\b/g, ' ')
    .replace(/\borlando\b|\bkissimmee\b|\bwinter garden\b|\bcelebration\b|\blake buena vista\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const match = text.match(/(\d+)\s+((?:[a-z0-9]+\s+){0,4}[a-z0-9]+)/)
  if (match) {
    const street = match[2].replace(
      /\s+\b(rd|road|dr|drive|ave|avenue|blvd|way|pkwy|trl|trail|st|street|hwy|plaza)\b.*$/,
      ' $1',
    )
    return `${match[1]} ${street}`.trim()
  }
  return fold(name)
}

/**
 * Mesma sequência do rodapé de endereços: uma entrada por parada,
 * na ordem `ordem_no_dia`, sem colapsar lojas nem reinventar o hotel.
 */
export function buildDayMapStops(
  trip: Pick<Trip, 'hotel' | 'places'>,
  day: Pick<Day, 'stops'>,
): MapStop[] {
  return sortStops(day.stops).flatMap((stop) => {
    const place = placeOf(trip, stop.placeId)
    if (!place) return []
    const isHotel =
      place.category === 'hotel' || /^hotel\b/i.test(place.name.trim())
    return [
      {
        id: stop.id,
        label: place.name,
        query: mapsQuery(place.name, place.address),
        kind: isHotel ? ('hotel' as const) : ('place' as const),
        optional: stop.status === 'opcional',
        orderInDay: stop.orderInDay,
      },
    ]
  })
}

const GOOGLE_MAX_STOPS = 10

export function googleMapsDirUrl(stops: MapStop[]): string {
  const route = stops.slice(0, GOOGLE_MAX_STOPS)
  if (!route.length) return ''
  if (route.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(route[0].query)}`
  }
  const origin = route[0].query
  const destination = route[route.length - 1].query
  const waypoints = route.slice(1, -1).map((stop) => stop.query)
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
    hl: 'pt-BR',
  })
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function isPlausible(query: string, coords: Coords): boolean {
  if (/galeao|galeão|\bgig\b|rio de janeiro/i.test(query)) {
    return coords.lat > -23.5 && coords.lat < -22.5 && coords.lng > -43.8 && coords.lng < -42.8
  }
  if (/miami|\bmia\b/i.test(query)) {
    return coords.lat > 25.2 && coords.lat < 26.5 && coords.lng > -80.7 && coords.lng < -80.0
  }
  return coords.lat > 27.8 && coords.lat < 29.0 && coords.lng > -82.0 && coords.lng < -80.8
}

export function coordsForStop(stop: MapStop): Coords | undefined {
  const primary = stopKey(stop.label, stop.query)
  const keys = [
    primary,
    stopKey('', stop.query),
    fold(stop.query),
    fold(stop.label),
    // aliases curtos (ex.: "10330 turkey lake road" sem cidade)
    primary.replace(/\s+\b(road|drive|avenue|trail|street)\b/g, (_, kind: string) => {
      const short: Record<string, string> = {
        road: 'rd',
        drive: 'dr',
        avenue: 'ave',
        trail: 'trl',
        street: 'st',
      }
      return ` ${short[kind] ?? kind}`
    }),
  ]
  for (const key of keys) {
    const coords = PLACE_COORDS[key]
    if (coords && isPlausible(stop.query, coords)) return coords
  }
  return undefined
}

const OVERLAP_EPS = 0.00008 // ~9 m — trata o mesmo prédio / suite como um cluster

function coordBucket(point: Coords): string {
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
}

/**
 * Espalha pins que caem no mesmo ponto (várias lojas no mesmo endereço)
 * para que cada parada da sequência fique visível no mapa.
 */
export function spreadOverlappingCoords(
  items: Array<{ id: string; point: Coords }>,
): Record<string, Coords> {
  const groups = new Map<string, Array<{ id: string; point: Coords }>>()
  for (const item of items) {
    const key = coordBucket(item.point)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }

  const next: Record<string, Coords> = {}
  for (const group of groups.values()) {
    if (group.length === 1) {
      next[group[0].id] = group[0].point
      continue
    }
    const center = group[0].point
    // raio ~35–55 m, cresce um pouco com o tamanho do cluster
    const radius = OVERLAP_EPS * (1.8 + Math.min(group.length, 8) * 0.35)
    group.forEach((item, index) => {
      const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2
      next[item.id] = {
        lat: center.lat + Math.cos(angle) * radius,
        lng: center.lng + Math.sin(angle) * radius,
      }
    })
  }
  return next
}

const geocodeMemory = new Map<string, Coords | null>()

export async function geocodeQuery(query: string): Promise<Coords | null> {
  const folded = fold(query)
  const known =
    PLACE_COORDS[folded] ??
    PLACE_COORDS[stopKey('', query)] ??
    PLACE_COORDS[stopKey(query, query)]
  if (known) return known
  if (geocodeMemory.has(folded)) return geocodeMemory.get(folded) ?? null

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`
    const response = await fetch(url)
    if (!response.ok) {
      geocodeMemory.set(folded, null)
      return null
    }
    const data = (await response.json()) as {
      features?: Array<{ geometry?: { coordinates?: number[] } }>
    }
    const pair = data.features?.[0]?.geometry?.coordinates
    if (!pair || pair.length < 2) {
      geocodeMemory.set(folded, null)
      return null
    }
    const coords = { lat: pair[1], lng: pair[0] }
    if (!isPlausible(query, coords)) {
      geocodeMemory.set(folded, null)
      return null
    }
    geocodeMemory.set(folded, coords)
    return coords
  } catch {
    geocodeMemory.set(folded, null)
    return null
  }
}
