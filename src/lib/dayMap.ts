import { PLACE_COORDS } from '../data/placeCoords'
import type { Day, Hotel, Trip } from '../types'
import { parseDayMeta, type DayPlace } from './dayMeta'

export const DEFAULT_HOTEL: Hotel = {
  name: 'Hotel',
  address: '8600 International Dr, Orlando, FL 32819',
}

const SKIP_PLACE =
  /\b(galeao|galeão|\bgig\b|rio de janeiro|aeroporto do gale[aã]o)\b/i
const ORLANDO_AREA =
  /\b(orlando|kissimmee|winter garden|celebration|lake buena vista|florida|\bfl\b|miami|\bmia\b|disney|universal|epic universe|magic kingdom|animal kingdom|hollywood studios|icon park)\b/i

export type MapStop = {
  id: string
  label: string
  query: string
  kind: 'hotel' | 'place'
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

export function mapsQuery(name: string, address?: string): string {
  const addr = sanitizeAddress(address ?? '')
  if (/^\d+\s/.test(addr)) {
    return `${name}, ${addr}`
  }
  if (
    addr &&
    !/^buscar pelo nome$/i.test(addr) &&
    !/^estacionamento\b/i.test(addr) &&
    !/^town center\b/i.test(addr)
  ) {
    return `${name}, ${addr}`
  }
  return `${name}, Orlando, FL`
}

export function stopKey(name: string, address?: string): string {
  const text = fold(sanitizeAddress(address || name))
    .replace(/[.,#]/g, ' ')
    .replace(/\b(ste|suite|unit|apt)\b.*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const match = text.match(/(\d+)\s+((?:[a-z0-9]+\s+){0,3}[a-z0-9]+)/)
  if (match) {
    const street = match[2].replace(/\s+\b(rd|dr|ave|blvd|way|pkwy|trl|st|hwy|plaza)\b.*$/, ' $1')
    return `${match[1]} ${street}`.trim()
  }
  return fold(name)
}

function isMappablePlace(place: DayPlace): boolean {
  const blob = `${place.name} ${place.addr}`
  if (SKIP_PLACE.test(blob)) return false
  return ORLANDO_AREA.test(blob) || /^\d+\s/.test(sanitizeAddress(place.addr))
}

export function dayPlacesForMap(day: Pick<Day, 'dayNotes'>): DayPlace[] {
  return parseDayMeta(day.dayNotes).places.filter(isMappablePlace)
}

function joinLabels(names: string[]): string {
  const unique = [...new Set(names.map((name) => name.replace(/\s+/g, ' ').trim()).filter(Boolean))]
  if (unique.length <= 3) return unique.join(' · ')
  return `${unique.slice(0, 2).join(' · ')} +${unique.length - 2}`
}

export function buildDayMapStops(
  trip: Pick<Trip, 'hotel'>,
  day: Pick<Day, 'dayNotes'>,
): MapStop[] {
  const hotel = hotelOf(trip)
  const grouped = new Map<string, { names: string[]; query: string }>()

  const rawPlaces = dayPlacesForMap(day)
  const hasDisneySprings = rawPlaces.some((place) => /disney springs/i.test(place.name))

  for (const place of rawPlaces) {
    if (hasDisneySprings && /ticket center/i.test(place.name)) continue
    const key = stopKey(place.name, place.addr)
    const query = mapsQuery(place.name, place.addr)
    const existing = grouped.get(key)
    if (existing) {
      existing.names.push(place.name)
      continue
    }
    grouped.set(key, { names: [place.name], query })
  }

  if (!grouped.size) return []

  const hotelKey = stopKey(hotel.name, hotel.address)
  const stops: MapStop[] = [
    {
      id: 'hotel',
      label: hotel.name,
      query: mapsQuery(hotel.name, hotel.address),
      kind: 'hotel',
    },
  ]

  let index = 1
  for (const [key, group] of grouped) {
    if (key === hotelKey) continue
    stops.push({
      id: `stop-${index}`,
      label: joinLabels(group.names),
      query: group.query,
      kind: 'place',
    })
    index += 1
  }

  return stops
}

const GOOGLE_MAX_STOPS = 10

export function googleMapsDirUrl(stops: MapStop[]): string {
  const route = stops.slice(0, GOOGLE_MAX_STOPS)
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
  if (/miami|\bmia\b/i.test(query)) {
    return coords.lat > 25.2 && coords.lat < 26.5 && coords.lng > -80.7 && coords.lng < -80.0
  }
  return coords.lat > 27.8 && coords.lat < 29.0 && coords.lng > -82.0 && coords.lng < -80.8
}

export function coordsForStop(stop: MapStop): Coords | undefined {
  const keys = [
    stopKey(stop.label.split(' · ')[0], stop.query),
    stopKey('', stop.query),
    fold(stop.query),
    fold(stop.label),
  ]
  for (const key of keys) {
    const coords = PLACE_COORDS[key]
    if (coords && isPlausible(stop.query, coords)) return coords
  }
  return undefined
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
