import type { Day, Trip } from '../types'

export type QueuePark = {
  id: number
  name: string
  operator: string
  aliases: string[]
}

/** Parques com fila ao vivo no Queue Times e que cabem neste roteiro. */
const QUEUE_PARKS: QueuePark[] = [
  { id: 6, name: 'Magic Kingdom', operator: 'Disney', aliases: ['magic kingdom'] },
  { id: 8, name: 'Animal Kingdom', operator: 'Disney', aliases: ['animal kingdom'] },
  { id: 7, name: 'Hollywood Studios', operator: 'Disney', aliases: ['hollywood studios'] },
  { id: 5, name: 'Epcot', operator: 'Disney', aliases: ['epcot'] },
  { id: 334, name: 'Epic Universe', operator: 'Universal', aliases: ['epic universe'] },
  { id: 64, name: 'Islands of Adventure', operator: 'Universal', aliases: ['islands of adventure'] },
  { id: 65, name: 'Universal Studios', operator: 'Universal', aliases: ['universal studios'] },
  { id: 67, name: 'Volcano Bay', operator: 'Universal', aliases: ['volcano bay'] },
  { id: 316, name: 'Peppa Pig Theme Park', operator: 'Merlin', aliases: ['peppa pig'] },
  { id: 280, name: 'Legoland Florida', operator: 'Merlin', aliases: ['legoland'] },
  { id: 21, name: 'SeaWorld Orlando', operator: 'SeaWorld', aliases: ['seaworld', 'sea world'] },
  { id: 94, name: 'Aquatica Orlando', operator: 'SeaWorld', aliases: ['aquatica'] },
]

export type PlanPark = QueuePark & {
  /** Dias do roteiro em que o parque aparece. */
  dates: string[]
}

export type RideWait = {
  id: number
  name: string
  land: string
  isOpen: boolean
  waitTime: number
  updatedAt: string
}

type QueueRide = {
  id: number
  name: string
  is_open: boolean
  wait_time: number
  last_updated: string
}

type QueuePayload = {
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
    id: ride.id,
    name: ride.name,
    land,
    isOpen: Boolean(ride.is_open),
    waitTime: Number.isFinite(ride.wait_time) ? ride.wait_time : 0,
    updatedAt: ride.last_updated ?? '',
  }
}

export function sortRidesByWait(rides: RideWait[]): RideWait[] {
  return [...rides].sort((a, b) => {
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1
    if (a.isOpen && a.waitTime !== b.waitTime) return b.waitTime - a.waitTime
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

export async function fetchRideWaits(parkId: number, signal?: AbortSignal): Promise<RideWait[]> {
  const response = await fetch(`/api/queue-times/parks/${parkId}/queue_times.json`, { signal })
  if (!response.ok) throw new Error('As filas deste parque não carregaram.')
  const payload = (await response.json()) as QueuePayload
  const rides = [
    ...(payload.lands ?? []).flatMap((land) =>
      (land.rides ?? []).map((ride) => mapRide(ride, land.name ?? '')),
    ),
    ...(payload.rides ?? []).map((ride) => mapRide(ride, '')),
  ]
  return sortRidesByWait(rides)
}

export function latestUpdate(rides: RideWait[]): string | null {
  const stamps = rides
    .map((ride) => Date.parse(ride.updatedAt))
    .filter((stamp) => Number.isFinite(stamp))
  if (!stamps.length) return null
  return new Date(Math.max(...stamps)).toISOString()
}
