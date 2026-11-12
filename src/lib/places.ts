import type { Place, PlaceCategory, Stop, StopStatus, Trip } from '../types'
import { PLACE_CATEGORY_LABELS } from '../types'
import {
  BedDouble,
  Plane,
  ShoppingBag,
  Sparkles,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

export const PLACE_CATEGORY_ICONS: Record<PlaceCategory, LucideIcon> = {
  hotel: BedDouble,
  alimentacao: Utensils,
  compras: ShoppingBag,
  lazer: Sparkles,
  transporte: Plane,
}

export function placeCategoryLabel(category: PlaceCategory): string {
  return PLACE_CATEGORY_LABELS[category]
}

export function normalizePlaceCategory(value: unknown): PlaceCategory | null {
  const raw = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  if (
    raw === 'hotel' ||
    raw === 'alimentacao' ||
    raw === 'compras' ||
    raw === 'lazer' ||
    raw === 'transporte'
  ) {
    return raw
  }
  return null
}

export function normalizeStopStatus(value: unknown): StopStatus {
  const raw = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  return raw.startsWith('opc') ? 'opcional' : 'fixo'
}

export function placesById(trip: Pick<Trip, 'places'>): Map<string, Place> {
  return new Map(trip.places.map((place) => [place.id, place]))
}

export function placeOf(
  trip: Pick<Trip, 'places'>,
  placeId: string,
): Place | undefined {
  return trip.places.find((place) => place.id === placeId)
}

export function resolveStopPlace(
  trip: Pick<Trip, 'places'>,
  stop: Stop,
): Place | undefined {
  return placeOf(trip, stop.placeId)
}

/** Paradas fixas (exclui opcionais) — contagem de “lugares a visitar”. */
export function fixedStops(stops: Stop[]): Stop[] {
  return stops.filter((stop) => stop.status === 'fixo')
}

export function optionalStops(stops: Stop[]): Stop[] {
  return stops.filter((stop) => stop.status === 'opcional')
}

export function sortStops(stops: Stop[]): Stop[] {
  return [...stops].sort(
    (a, b) => a.orderInDay - b.orderInDay || a.seq - b.seq,
  )
}

export function sortedDayStops(day: { stops: Stop[] }): Stop[] {
  return sortStops(day.stops)
}

export function hasAddress(place: Pick<Place, 'address'> | undefined): boolean {
  const address = place?.address?.trim()
  return Boolean(address)
}

export function mapsSearchQuery(place: Pick<Place, 'name' | 'address'>): string {
  const address = place.address?.trim()
  if (address) return `${place.name}, ${address}`
  if (/\bgig\b|gale[aã]o/i.test(place.name)) {
    return `${place.name}, Rio de Janeiro, Brasil`
  }
  if (/\bmia\b|miami international/i.test(place.name)) {
    return `${place.name}, Miami, FL`
  }
  return `${place.name}, Orlando, FL`
}

export function placeDisplayLine(place: Place): string {
  const address = place.address?.trim()
  return address ? `${place.name} – ${address}` : place.name
}
