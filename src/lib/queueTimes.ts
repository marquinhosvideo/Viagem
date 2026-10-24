import type { Day, Trip } from '../types'

export type QueuePark = {
  id: number
  name: string
  operator: string
  aliases: string[]
  officialSearch: (rideName: string) => string
}

function disneySearch(rideName: string): string {
  return `https://disneyworld.disney.go.com/search/?searchQuery=${encodeURIComponent(rideName)}`
}

function universalSearch(rideName: string): string {
  return `https://www.universalorlando.com/web/en/us/search-results?searchQuery=${encodeURIComponent(rideName)}`
}

function peppaSearch(rideName: string): string {
  return `https://www.peppapigthemepark.com/florida/things-to-do/?q=${encodeURIComponent(rideName)}`
}

function legolandSearch(rideName: string): string {
  return `https://www.legoland.com/florida/things-to-do/?q=${encodeURIComponent(rideName)}`
}

function seaworldSearch(rideName: string): string {
  return `https://seaworld.com/orlando/rides/?q=${encodeURIComponent(rideName)}`
}

/** Parques com fila ao vivo no Queue Times e que cabem neste roteiro. */
const QUEUE_PARKS: QueuePark[] = [
  { id: 6, name: 'Magic Kingdom', operator: 'Disney', aliases: ['magic kingdom'], officialSearch: disneySearch },
  { id: 8, name: 'Animal Kingdom', operator: 'Disney', aliases: ['animal kingdom'], officialSearch: disneySearch },
  { id: 7, name: 'Hollywood Studios', operator: 'Disney', aliases: ['hollywood studios'], officialSearch: disneySearch },
  { id: 5, name: 'Epcot', operator: 'Disney', aliases: ['epcot'], officialSearch: disneySearch },
  { id: 334, name: 'Epic Universe', operator: 'Universal', aliases: ['epic universe'], officialSearch: universalSearch },
  { id: 64, name: 'Islands of Adventure', operator: 'Universal', aliases: ['islands of adventure'], officialSearch: universalSearch },
  { id: 65, name: 'Universal Studios', operator: 'Universal', aliases: ['universal studios'], officialSearch: universalSearch },
  { id: 67, name: 'Volcano Bay', operator: 'Universal', aliases: ['volcano bay'], officialSearch: universalSearch },
  { id: 316, name: 'Peppa Pig Theme Park', operator: 'Merlin', aliases: ['peppa pig'], officialSearch: peppaSearch },
  { id: 280, name: 'Legoland Florida', operator: 'Merlin', aliases: ['legoland'], officialSearch: legolandSearch },
  { id: 21, name: 'SeaWorld Orlando', operator: 'SeaWorld', aliases: ['seaworld', 'sea world'], officialSearch: seaworldSearch },
  { id: 94, name: 'Aquatica Orlando', operator: 'SeaWorld', aliases: ['aquatica'], officialSearch: seaworldSearch },
]

export type PlanPark = QueuePark & {
  /** Dias do roteiro em que o parque aparece. */
  dates: string[]
}

export type RideWait = {
  id: string
  name: string
  land: string
  isOpen: boolean
  waitTime: number
  updatedAt: string
}

export type RideSnapshot = {
  rides: RideWait[]
  source: 'queue-times' | 'themeparks'
}

type QueueRide = {
  id: number | string
  name: string
  is_open: boolean
  wait_time: number
  last_updated: string
}

type QueuePayload = {
  source?: RideSnapshot['source']
  lands?: Array<{ name?: string; rides?: QueueRide[] }>
  rides?: QueueRide[]
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\bepcot resorts\b/g, ' ')
}

function mentions(text: string, aliases: string[]): boolean {
  const haystack = fold(text)
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)
  })
}

function dayText(day: Day): string {
  const pin = (day.dayNotes ?? '').split(/\n\n+/)[0] ?? ''
  const places = pin.includes('📍') ? pin : ''
  return [places, ...day.activities.map((activity) => activity.location ?? '')].join('\n')
}

export function parksInTrip(trip: Trip): PlanPark[] {
  const locationNames = (trip.locations ?? []).map((place) => place.name).join('\n')

  return QUEUE_PARKS.flatMap((park) => {
    const dates = trip.days
      .filter((day) => mentions(dayText(day), park.aliases))
      .map((day) => day.date)
    const inPlaces = mentions(locationNames, park.aliases)
    if (!dates.length && !inPlaces) return []
    return [{ ...park, dates }]
  }).sort((a, b) => {
    const aDate = a.dates[0] ?? '9999'
    const bDate = b.dates[0] ?? '9999'
    const byDate = aDate.localeCompare(bDate)
    return byDate || a.name.localeCompare(b.name, 'pt-BR')
  })
}

function mapRide(ride: QueueRide, land: string): RideWait {
  return {
    id: String(ride.id),
    name: ride.name,
    land,
    isOpen: Boolean(ride.is_open),
    waitTime: Number.isFinite(ride.wait_time) ? ride.wait_time : 0,
    updatedAt: ride.last_updated ?? '',
  }
}

export function officialRideUrl(park: QueuePark, rideName: string): string {
  return park.officialSearch(rideName)
}

function snapshotFromPayload(payload: QueuePayload): RideWait[] {
  return sortRidesByWait([
    ...(payload.lands ?? []).flatMap((land) =>
      (land.rides ?? []).map((ride) => mapRide(ride, land.name ?? '')),
    ),
    ...(payload.rides ?? []).map((ride) => mapRide(ride, '')),
  ])
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

export function sortRidesByWait(rides: RideWait[]): RideWait[] {
  return [...rides].sort((a, b) => {
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1
    if (a.isOpen && a.waitTime !== b.waitTime) return b.waitTime - a.waitTime
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

async function requestRideWaits(parkId: number, fresh: boolean, signal?: AbortSignal): Promise<RideSnapshot> {
  const query = fresh ? `?fresh=${Date.now()}` : ''
  const response = await fetch(`/api/queue-times/parks/${parkId}${query}`, {
    signal,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('As filas deste parque não carregaram.')
  const payload = (await response.json()) as QueuePayload
  return {
    rides: snapshotFromPayload(payload),
    source: payload.source === 'themeparks' ? 'themeparks' : 'queue-times',
  }
}

export async function fetchRideWaits(
  parkId: number,
  options: { signal?: AbortSignal; fresh?: boolean } = {},
): Promise<RideSnapshot> {
  const attempts = options.fresh ? 2 : 1
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const snapshot = await requestRideWaits(parkId, Boolean(options.fresh), options.signal)
      if (snapshot.rides.length || attempt === attempts - 1) return snapshot
      await wait(400, options.signal)
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
      lastError = error
      if (attempt < attempts - 1) await wait(400, options.signal)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('As filas deste parque não carregaram.')
}

export function latestUpdate(rides: RideWait[]): string | null {
  const stamps = rides
    .map((ride) => Date.parse(ride.updatedAt))
    .filter((stamp) => Number.isFinite(stamp))
  if (!stamps.length) return null
  return new Date(Math.max(...stamps)).toISOString()
}
