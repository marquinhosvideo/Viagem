import type { RideWait } from './queueTimes'

const STORAGE_KEY = 'roteiro-orlando-ride-favorites-v1'
const DISMISSED_KEY = 'roteiro-orlando-ride-favorites-dismissed-v1'

/**
 * Atrações que já entram como favoritas (match por trecho do nome no Queue Times).
 * Inclui meets/shows mesmo quando o feed usa um título um pouco diferente.
 */
export const DEFAULT_FAVORITE_MATCHERS = [
  "peter pan's flight",
  'jungle cruise',
  'many adventures of winnie the pooh',
  'princess fairytale hall',
  "ariel's grotto",
  'ariel at her grotto',
  "pete's silly sideshow",
  'town square theater',
  'enchanted tales with belle',
  'dumbo the flying elephant',
  'under the sea',
  "it's a small world",
  "mickey's philharmagic",
  'thotful spot',
  'kilimanjaro safaris',
  'adventurers outpost',
  "bluey's wild world",
  'festival of the lion king',
  'finding nemo',
  'meet moana at character landing',
  "mickey & minnie's runaway railway",
  'red carpet dreams',
  'olaf at celebrity spotlight',
  'meet the toys in toy story land',
  'disney jr. mickey mouse clubhouse',
  'frozen sing-along',
  'fantasmic',
  'pixar pals',
  'encounter darth vader',
  // Epic Universe — Isle of Berk / Super Nintendo World
  'meet toothless',
  'toothless and hiccup',
  'viking training camp',
  'untrainable dragon',
  'mario e luigi',
  'mario and luigi',
  'princess peach',
  'toad e donkey',
  'toad and donkey',
  'donkey kong',
  "yoshi's adventure",
] as const

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesDefaultFavorite(name: string): boolean {
  const folded = fold(name)
  return DEFAULT_FAVORITE_MATCHERS.some((matcher) => folded.includes(matcher))
}

function readIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value) => Number(value))
      .filter((id) => Number.isFinite(id) && id > 0)
  } catch {
    return []
  }
}

function writeIds(key: string, ids: number[]) {
  localStorage.setItem(key, JSON.stringify(ids))
}

export function loadFavoriteRideIds(): Set<number> {
  return new Set(readIds(STORAGE_KEY))
}

function loadDismissedDefaultIds(): Set<number> {
  return new Set(readIds(DISMISSED_KEY))
}

function saveFavorites(ids: Set<number>) {
  writeIds(STORAGE_KEY, [...ids])
}

function saveDismissed(ids: Set<number>) {
  writeIds(DISMISSED_KEY, [...ids])
}

/** Ao carregar filas, marca as atrações padrão que ainda não foram desfavoritadas. */
export function ensureDefaultFavorites(rides: RideWait[]): Set<number> {
  const favorites = loadFavoriteRideIds()
  const dismissed = loadDismissedDefaultIds()
  let changed = false

  for (const ride of rides) {
    if (!matchesDefaultFavorite(ride.name)) continue
    if (favorites.has(ride.id) || dismissed.has(ride.id)) continue
    favorites.add(ride.id)
    changed = true
  }

  if (changed) saveFavorites(favorites)
  return favorites
}

export function toggleFavoriteRideId(id: number, name = ''): Set<number> {
  const next = loadFavoriteRideIds()
  const dismissed = loadDismissedDefaultIds()

  if (next.has(id)) {
    next.delete(id)
    if (matchesDefaultFavorite(name)) {
      dismissed.add(id)
      saveDismissed(dismissed)
    }
  } else {
    next.add(id)
    if (dismissed.has(id)) {
      dismissed.delete(id)
      saveDismissed(dismissed)
    }
  }

  saveFavorites(next)
  return next
}
