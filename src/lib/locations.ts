import { EXTRA_CHAIN_STORES } from '../data/chainStores'
import type { Day, SavedPlace, Trip } from '../types'
import { parseDayMeta, splitPlaceChunks } from './dayMeta'

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

function parsePlaceLine(raw: string): { name: string; address: string }[] {
  return splitPlaceChunks(clean(raw)).flatMap((piece) => {
    const [name, ...rest] = piece.split(/\s+[–—-]\s+/)
    const cleanName = name.trim()
    if (!cleanName) return []
    return [{ name: cleanName, address: rest.join(' – ').trim() }]
  })
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
  const fromActivities = day.activities.flatMap((activity) =>
    parsePlaceLine(activity.location ?? '').map((parsed) => ({
      name: parsed.name,
      address: parsed.address,
      category: inferPlaceCategory(parsed.name, `${context} ${activity.location}`),
    })),
  )
  return [...fromNotes, ...fromActivities]
}

function sanitizeAddress(value: string): string {
  return clean(value)
    .replace(/\s*\((?:alternativa|alt\.?):\s*.+$/i, '')
    .replace(/\s*\(todos em [^)]+\)\s*$/i, '')
    .replace(/^.+?\(\d+[.,]\d+[^)]*\baval\.?\)\s*[–—-]\s*/i, '')
    .trim()
}

function pickRicherAddress(current: string, incoming: string): string {
  const a = sanitizeAddress(current)
  const b = sanitizeAddress(incoming)
  const score = (value: string) => {
    let points = value.length
    if (/,\s*FL\s*\d{5}/i.test(value)) points += 24
    return points
  }
  return score(b) > score(a) ? b : a
}

export function normalizePlace(
  place: SavedPlace,
  options?: { allowMissingAddress?: boolean },
): SavedPlace | null {
  const name = clean(place.name).slice(0, 160)
  const address = sanitizeAddress(place.address).slice(0, 300)
  const category = clean(place.category).slice(0, 80) || 'Outros'
  const missingAddress = !address || /^buscar pelo nome$/i.test(address)
  if (!name) return null
  if (missingAddress && !options?.allowMissingAddress) return null
  return { name, address: missingAddress ? '' : address, category }
}

function placeNameKey(name: string): string {
  return fold(name)
}

const CHAINS: { key: string; label: string; match: RegExp }[] = [
  { key: 'walmart', label: 'Walmart', match: /\bwalmart\b/i },
  { key: 'target', label: 'Target', match: /\btarget\b/i },
  { key: 'ross', label: 'Ross', match: /\bross\b/i },
  { key: 'bestbuy', label: 'Best Buy', match: /\bbest buy\b/i },
  { key: 'burlington', label: 'Burlington', match: /\bburlington\b/i },
  { key: 'ulta', label: 'Ulta', match: /\bulta\b/i },
  { key: 'marshalls', label: 'Marshalls', match: /\bmarshalls\b/i },
  { key: 'fivebelow', label: 'Five Below', match: /\bfive below\b/i },
  { key: 'beautymaster', label: 'Beauty Master', match: /\bbeauty master\b/i },
  { key: 'nordstrom', label: 'Nordstrom Rack', match: /\bnordstrom\b/i },
  { key: 'tjmaxx', label: 'T.J. Maxx', match: /\bt\.?\s*j\.?\s*maxx\b/i },
]

const BRANCH_HINTS: [RegExp, string][] = [
  [/turkey lake/i, 'Turkey Lake'],
  [/vineland rd/i, 'Lake Buena Vista'],
  [/daryl carter/i, 'Vineland'],
  [/regency village/i, 'Vineland'],
  [/eastgate/i, 'Eastgate'],
  [/1736 sand lake/i, 'Florida Mall'],
  [/grand national/i, 'Grand National'],
  [/john young/i, 'John Young'],
  [/millenia/i, 'Millenia'],
  [/international dr/i, 'I-Drive'],
  [/international blvd/i, 'I-Drive'],
  [/orange blossom/i, 'Florida Mall'],
  [/sand lake/i, 'Sand Lake'],
  [/daniels rd/i, 'Winter Garden Village'],
  [/w colonial/i, 'W Colonial'],
  [/florida mall ave/i, 'Florida Mall'],
  [/kirkman/i, 'Kirkman'],
  [/osceola pkwy/i, 'Kissimmee'],
  [/rolling oaks/i, 'Rolling Oaks'],
]

function chainOf(name: string): (typeof CHAINS)[number] | undefined {
  return CHAINS.find((chain) => chain.match.test(name))
}

function streetIdentity(address: string): string {
  const text = fold(address)
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/[.,#]/g, ' ')
    .replace(/\b(ste|suite|unit|apt)\b.*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const match = text.match(/(\d+)\s+((?:[a-z0-9]+\s+){0,3}[a-z0-9]+)/)
  if (!match) return text
  const street = match[2].replace(/\s+\b(rd|dr|ave|blvd|way|pkwy|trl|st|hwy|plaza)\b.*$/, ' $1')
  return `${match[1]} ${street}`.trim()
}

function lookupKey(place: SavedPlace): string {
  const chain = chainOf(place.name)
  const street = streetIdentity(place.address)
  if (chain && street) return `${chain.key}|${street}`
  return street ? `${placeNameKey(place.name)}|${street}` : placeNameKey(place.name)
}

function branchLabel(name: string, address: string): string | undefined {
  const blob = `${name} ${address}`
  return BRANCH_HINTS.find(([pattern]) => pattern.test(blob))?.[1]
}

export function withBranchName(name: string, address: string): string {
  const chain = chainOf(name)
  if (!chain) return name
  const label = branchLabel(name, address)
  if (!label) return name
  const supercenter = /\bsupercenter\b/i.test(name) ? ' Supercenter' : ''
  const base = `${chain.label}${supercenter}`
  if (fold(name).includes(fold(label))) {
    return name.includes(label) ? name : `${base} ${label}`
  }
  return `${base} ${label}`
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

function findExistingPlace(
  byKey: Map<string, LocatedPlace>,
  candidate: LocatedPlace,
): LocatedPlace | undefined {
  const key = lookupKey(candidate)
  const exact = byKey.get(key)
  if (exact) return exact

  const chain = chainOf(candidate.name)
  const street = streetIdentity(candidate.address)
  const nameKey = placeNameKey(candidate.name)

  return [...byKey.values()].find((place) => {
    if (chain) {
      if (chainOf(place.name)?.key !== chain.key) return false
      if (!street) return !place.address
      return streetIdentity(place.address) === street
    }
    if (placeNameKey(place.name) !== nameKey) return false
    if (!street || !place.address) return true
    return streetIdentity(place.address) === street
  })
}

function upsertLocatedPlace(
  byKey: Map<string, LocatedPlace>,
  candidate: LocatedPlace,
) {
  const labeled: LocatedPlace = {
    ...candidate,
    name: withBranchName(candidate.name, candidate.address),
  }
  const existing = findExistingPlace(byKey, labeled)

  if (!existing) {
    byKey.set(lookupKey(labeled), labeled)
    return
  }

  const richerAddress = pickRicherAddress(existing.address, labeled.address)
  const merged: LocatedPlace = {
    ...existing,
    name: withBranchName(existing.name, richerAddress),
    address: richerAddress,
    category: existing.category || labeled.category,
    days: mergeDays(existing.days, labeled.days),
  }
  const nextKey = lookupKey(merged)
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

  for (const candidate of [...(trip.locations ?? []), ...EXTRA_CHAIN_STORES]) {
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
