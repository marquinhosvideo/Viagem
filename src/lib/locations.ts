import type { Place, PlaceCategory, Trip } from '../types'
import { PLACE_CATEGORY_LABELS, PLACE_CATEGORY_ORDER } from '../types'
import { placeCategoryLabel } from './places'

export type PlaceDayRef = {
  dayId: string
  date: string
  index: number
}

export type LocatedPlace = {
  id: string
  name: string
  address: string
  category: PlaceCategory
  categoryLabel: string
  days: PlaceDayRef[]
}

export type PlaceGroup = {
  category: PlaceCategory
  categoryLabel: string
  places: LocatedPlace[]
}

function byName(a: LocatedPlace, b: LocatedPlace): number {
  return a.name.localeCompare(b.name, 'pt-BR')
}

export function collectLocatedPlaces(trip: Trip): LocatedPlace[] {
  const dayRefs = new Map<string, PlaceDayRef[]>()

  for (const [index, day] of trip.days.entries()) {
    const ref: PlaceDayRef = { dayId: day.id, date: day.date, index: index + 1 }
    for (const stop of day.stops) {
      const list = dayRefs.get(stop.placeId) ?? []
      if (!list.some((item) => item.dayId === day.id)) list.push(ref)
      dayRefs.set(stop.placeId, list)
    }
  }

  return [...trip.places]
    .map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address?.trim() ?? '',
      category: place.category,
      categoryLabel: placeCategoryLabel(place.category),
      days: (dayRefs.get(place.id) ?? []).sort(
        (a, b) => a.date.localeCompare(b.date) || a.index - b.index,
      ),
    }))
    .sort((a, b) => {
      const category = a.categoryLabel.localeCompare(b.categoryLabel, 'pt-BR')
      return category || a.name.localeCompare(b.name, 'pt-BR')
    })
}

/** Catálogo canônico — sem deduzir de strings. */
export function collectTripLocations(trip: Trip): Place[] {
  return [...trip.places].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function groupTripLocations(trip: Trip): PlaceGroup[] {
  const sections = new Map<PlaceCategory, LocatedPlace[]>()
  for (const place of collectLocatedPlaces(trip)) {
    const list = sections.get(place.category) ?? []
    list.push(place)
    sections.set(place.category, list)
  }

  return PLACE_CATEGORY_ORDER.flatMap((category) => {
    const places = sections.get(category)
    if (!places?.length) return []
    return [
      {
        category,
        categoryLabel: PLACE_CATEGORY_LABELS[category],
        places: places.sort(byName),
      },
    ]
  })
}
