import type { Day, SavedPlace, Trip } from '../types'
import { parseDayMeta } from './dayMeta'

export const PLACE_SECTIONS = ['Alimentação', 'Lazer', 'Compras'] as const
export type PlaceSection = (typeof PLACE_SECTIONS)[number]

export const SHOPPING_KINDS = ['Eletrônicos', 'Moda', 'Geral'] as const
export type ShoppingKind = (typeof SHOPPING_KINDS)[number]

const FOOD_NAME = /\b(caf[eé]|chef|restaurant|dining)\b/i
const LEISURE_BEFORE_STORE = /\b(play park|ticket center|crayola experience)\b/i
const LEISURE_OVERRIDE =
  /\b(disney springs|icon park|magic kingdom|animal kingdom|hollywood studios|epic universe|gatorland|peppa|theme park)\b/i
const STORE_NAME =
  /\b(best buy|apple store|micro center|walmart|target|five below|burlington|marshalls|nordstrom|ross|t\.?\s*j\.?\s*maxx|ulta|beauty|outlets?|factory stores?|sawgrass|dolphin mall|buybuy|baby|mall|crayola store|old town|world of disney)\b/i
const LEISURE_NAME =
  /\b(universal|leu gardens|lake eola|celebration|winter garden|plant st|farmers market|science center|sea life|kennedy|cocoa beach|gaylord|now snowing|splash|boat tour|aquarium|gingerbread|resort hopping|aeroporto|airport)\b/i
const ELECTRONICS_NAME = /\b(best buy|apple store|micro center|eletr[oô]nic)/i
const FASHION_NAME =
  /\b(burlington|marshalls|nordstrom|ross|t\.?\s*j\.?\s*maxx|ulta|beauty|outlets?|factory stores?|sawgrass|nike|zara|moda)\b/i

function clean(value: string): string {
  return value
    .replace(/[⭐*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function isFood(name: string, category: string, context: string): boolean {
  if (/^aliment/.test(fold(category))) return true
  if (FOOD_NAME.test(name)) return true
  return (
    /refei[cç][aã]o|alimenta|chef|caf[eé]|jantar|almo[cç]o/i.test(context) &&
    /\b(resort|hotel|chef|caf[eé]|restaurant)\b/i.test(name)
  )
}

function isLeisureCategory(category: string): boolean {
  return /^(parque|passeio|centrinho|hospedagem|aeroporto|lazer|outros)\b/.test(fold(category))
}

function isShoppingCategory(category: string): boolean {
  return /(compra|shopping|beleza|bebe|loja|off-price|outlet|variedade|rua de loja|moda|eletronico)/.test(
    fold(category),
  )
}

function shoppingKind(name: string, category: string): ShoppingKind {
  const folded = fold(category)
  if (folded === 'eletronicos') return 'Eletrônicos'
  if (folded === 'moda') return 'Moda'
  if (folded === 'geral') return 'Geral'

  const blob = `${name} ${category}`
  if (ELECTRONICS_NAME.test(blob)) return 'Eletrônicos'
  if (FASHION_NAME.test(blob) || /beleza|off-price|outlet|moda/.test(folded)) return 'Moda'
  return 'Geral'
}

export function classifyPlace(
  name: string,
  category = '',
  context = '',
): { section: PlaceSection; shoppingKind?: ShoppingKind } {
  if (isFood(name, category, context)) return { section: 'Alimentação' }
  if (LEISURE_BEFORE_STORE.test(name)) return { section: 'Lazer' }
  if (STORE_NAME.test(name)) {
    return { section: 'Compras', shoppingKind: shoppingKind(name, category) }
  }
  if (LEISURE_OVERRIDE.test(name) || LEISURE_NAME.test(name) || isLeisureCategory(category)) {
    return { section: 'Lazer' }
  }
  if (isShoppingCategory(category)) {
    return { section: 'Compras', shoppingKind: shoppingKind(name, category) }
  }
  if (/\b(compras|mercado|beleza|outlet)\b/i.test(context) && context.length <= 40) {
    return { section: 'Compras', shoppingKind: shoppingKind(name, context) }
  }
  return { section: 'Lazer' }
}

export function inferPlaceCategory(name: string, context = ''): string {
  const category = context.length <= 40 ? context : ''
  const dayContext = category ? '' : context
  return classifyPlace(name, category, dayContext).section
}

function parsePlaceLine(raw: string): { name: string; address: string } | null {
  const piece = clean(raw)
  if (!piece) return null
  const [name, ...rest] = piece.split(/\s+[–—-]\s+/)
  const cleanName = name.trim()
  if (!cleanName) return null
  return { name: cleanName, address: rest.join(' – ').trim() }
}

function dayContext(day: Day): string {
  return [
    day.label,
    ...day.activities.flatMap((activity) => [
      activity.title,
      activity.notes ?? '',
    ]),
  ].join(' ')
}

function placesFromDay(day: Day): SavedPlace[] {
  const context = dayContext(day)
  const fromNotes = parseDayMeta(day.dayNotes).places.map((place) => ({
    name: clean(place.name),
    address: clean(place.addr),
    category: inferPlaceCategory(place.name, context),
  }))
  const fromActivities = day.activities.flatMap((activity) => {
    const parsed = parsePlaceLine(activity.location ?? '')
    if (!parsed) return []
    return [
      {
        name: parsed.name,
        address: parsed.address,
        category: inferPlaceCategory(parsed.name, `${context} ${activity.location}`),
      },
    ]
  })
  return [...fromNotes, ...fromActivities]
}

export function normalizePlace(
  place: SavedPlace,
  options?: { allowMissingAddress?: boolean },
): SavedPlace | null {
  const name = clean(place.name).slice(0, 160)
  const address = clean(place.address).slice(0, 300)
  const category = clean(place.category).slice(0, 80) || 'Outros'
  const missingAddress = !address || /^buscar pelo nome$/i.test(address)
  if (!name) return null
  if (missingAddress && !options?.allowMissingAddress) return null
  return { name, address: missingAddress ? '' : address, category }
}

function placeNameKey(name: string): string {
  return fold(name)
}

function placeFullKey(name: string, address: string): string {
  return address ? `${placeNameKey(name)}|${fold(address)}` : placeNameKey(name)
}

export type PlaceDayRef = {
  dayId: string
  date: string
  index: number
}

export type LocatedPlace = SavedPlace & {
  days: PlaceDayRef[]
}

function mergeDays(current: PlaceDayRef[], incoming: PlaceDayRef[]): PlaceDayRef[] {
  const seen = new Set(current.map((day) => day.dayId))
  const next = [...current]
  for (const day of incoming) {
    if (seen.has(day.dayId)) continue
    seen.add(day.dayId)
    next.push(day)
  }
  return next.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
}

function upsertLocatedPlace(
  byKey: Map<string, LocatedPlace>,
  candidate: LocatedPlace,
) {
  const nameKey = placeNameKey(candidate.name)
  const fullKey = placeFullKey(candidate.name, candidate.address)
  const existing =
    byKey.get(fullKey) ??
    byKey.get(nameKey) ??
    [...byKey.values()].find((place) => placeNameKey(place.name) === nameKey)

  if (!existing) {
    byKey.set(fullKey, candidate)
    return
  }

  const richerAddress =
    candidate.address.length > existing.address.length ? candidate.address : existing.address
  const merged: LocatedPlace = {
    ...existing,
    address: richerAddress,
    category: existing.category || candidate.category,
    days: mergeDays(existing.days, candidate.days),
  }
  const nextKey = placeFullKey(merged.name, merged.address)
  for (const [key, value] of byKey) {
    if (value === existing) byKey.delete(key)
  }
  byKey.set(nextKey, merged)
}

export function collectLocatedPlaces(trip: Trip): LocatedPlace[] {
  const byKey = new Map<string, LocatedPlace>()

  for (const [index, day] of trip.days.entries()) {
    const dayRef: PlaceDayRef = { dayId: day.id, date: day.date, index: index + 1 }
    for (const candidate of placesFromDay(day)) {
      const place = normalizePlace(candidate, { allowMissingAddress: true })
      if (!place) continue
      upsertLocatedPlace(byKey, { ...place, days: [dayRef] })
    }
  }

  for (const candidate of trip.locations ?? []) {
    const place = normalizePlace(candidate)
    if (!place) continue
    upsertLocatedPlace(byKey, { ...place, days: [] })
  }

  return [...byKey.values()].sort((a, b) => {
    const category = a.category.localeCompare(b.category, 'pt-BR')
    return category || a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function collectTripLocations(trip: Trip): SavedPlace[] {
  return collectLocatedPlaces(trip).map((place) => ({
    name: place.name,
    address: place.address,
    category: place.category,
  }))
}

export type PlaceSubgroup = {
  category: ShoppingKind
  places: LocatedPlace[]
}

export type PlaceGroup = {
  category: PlaceSection
  places: LocatedPlace[]
  subgroups: PlaceSubgroup[]
}

function byName(a: LocatedPlace, b: LocatedPlace): number {
  return a.name.localeCompare(b.name, 'pt-BR')
}

export function groupTripLocations(trip: Trip): PlaceGroup[] {
  const sections = new Map<PlaceSection, LocatedPlace[]>()
  const shopping = new Map<ShoppingKind, LocatedPlace[]>()

  for (const place of collectLocatedPlaces(trip)) {
    const classified = classifyPlace(place.name, place.category)
    const sectionPlaces = sections.get(classified.section) ?? []
    sectionPlaces.push(place)
    sections.set(classified.section, sectionPlaces)
    if (classified.section === 'Compras' && classified.shoppingKind) {
      const kindPlaces = shopping.get(classified.shoppingKind) ?? []
      kindPlaces.push(place)
      shopping.set(classified.shoppingKind, kindPlaces)
    }
  }

  return PLACE_SECTIONS.flatMap((category) => {
    const places = sections.get(category)
    if (!places?.length) return []
    const subgroups =
      category === 'Compras'
        ? SHOPPING_KINDS.flatMap((kind) => {
            const kindPlaces = shopping.get(kind)
            if (!kindPlaces?.length) return []
            return [{ category: kind, places: kindPlaces.sort(byName) }]
          })
        : []
    return [{ category, places: places.sort(byName), subgroups }]
  })
}
