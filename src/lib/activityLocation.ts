import type { Activity, Day, Hotel, Trip } from '../types'
import { formatDayPlace, parseDayMeta, toDayPlace, type DayPlace } from './dayMeta'
import { DEFAULT_HOTEL } from './dayMap'

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

/** Line that starts a new spreadsheet event: optional emoji + CATEGORY — body */
const BLOCK_START =
  /^(?:[\p{Extended_Pictographic}\uFE0F\u200D⭐*\s]*)([A-ZÀ-Ú][A-ZÀ-Ú/ ]{1,40})\s+[—-]\s+/u

/**
 * Splits a Manhã/Tarde/Noite cell into one block per "CATEGORIA — …" line.
 * Continuation lines stay attached to the previous block.
 */
export function splitActivityBlocks(raw: string): string[] {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
  const blocks: string[] = []
  let current: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (current.length) current.push('')
      continue
    }
    if (BLOCK_START.test(trimmed) && current.length) {
      blocks.push(current.join('\n').trim())
      current = [trimmed]
      continue
    }
    current.push(trimmed)
  }

  if (current.length) blocks.push(current.join('\n').trim())
  return blocks.filter(Boolean)
}

const HOTEL_HINT =
  /\b(hotel|check-?\s*in|soneca no hotel|perto do hotel|volta ao hotel|voltar ao hotel|dormir cedo|jantar (?:cedo )?(?:perto do|no) hotel)\b/i

function hotelPlace(hotel?: Hotel | null): DayPlace | null {
  const name = hotel?.name?.trim() || DEFAULT_HOTEL.name
  const address = hotel?.address?.trim() || DEFAULT_HOTEL.address
  return toDayPlace(name, address)
}

export function placesForActivityMatching(
  day: Pick<Day, 'dayNotes'>,
  hotel?: Hotel | null,
): DayPlace[] {
  const places = [...parseDayMeta(day.dayNotes).places]
  const hotelAsPlace = hotelPlace(hotel)
  if (
    hotelAsPlace &&
    !places.some((place) => fold(place.name) === fold(hotelAsPlace.name))
  ) {
    places.push(hotelAsPlace)
  }
  return places
}

/**
 * Picks the place this event refers to: first mentioned in the text.
 * Hotel only counts when the text has a hotel hint.
 */
export function locationForActivityText(
  text: string,
  places: DayPlace[],
): string | undefined {
  if (!text.trim() || !places.length) return undefined
  const blob = fold(text)
  const mentionsHotel = HOTEL_HINT.test(text)

  const ranked = places
    .map((place) => {
      const name = fold(place.name)
      if (name.length < 3) return null
      const hotelNamed = /^hotel\b/i.test(place.name)
      if (hotelNamed && !mentionsHotel) return null
      const index = blob.indexOf(name)
      if (index < 0) return null
      return { place, index, length: name.length }
    })
    .filter((item): item is { place: DayPlace; index: number; length: number } => item != null)
    // Prefer the most specific place name, then the earliest mention in the text.
    .sort((a, b) => b.length - a.length || a.index - b.index)

  if (!ranked.length) {
    if (mentionsHotel) {
      const hotel = places.find((place) => /^hotel\b/i.test(place.name))
      if (hotel) return formatDayPlace(hotel.name, hotel.addr) || undefined
    }
    return undefined
  }

  const best = ranked[0]
  return formatDayPlace(best.place.name, best.place.addr) || undefined
}

export function stripPeriodTitlePrefix(title: string): string {
  return title
    .replace(/^(Manhã|Tarde|Noite)\s*[—-]\s*/i, '')
    .replace(/^[\uFE0F\u200D\s]+/, '')
    .trim()
}

export function activityTitleFromBlock(text: string): string {
  const line = text.split('\n')[0] ?? text
  const body = line
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D⭐*\s]+/u, '')
    .trim()
  return body.length > 100 ? `${body.slice(0, 97)}…` : body
}

function buildActivityFromBlock(
  block: string,
  id: string,
  places: DayPlace[],
  done: boolean,
): Activity {
  const title = stripPeriodTitlePrefix(activityTitleFromBlock(block))
  const location = locationForActivityText(block, places)
  const next: Activity = {
    id,
    title,
    notes: block,
    done,
  }
  if (location) next.location = location
  return next
}

function periodBaseId(activityId: string): string {
  return activityId.replace(/-(manha|tarde|noite)(?:-\d+)?$/i, '') || activityId
}

function periodSlug(activityId: string, index: number): string | null {
  const match = activityId.match(/(manha|tarde|noite)(?:-\d+)?$/i)
  if (!match) return null
  const key = match[1].toLowerCase()
  return index === 0 ? key : `${key}-${index}`
}

/** Expands multi-event period cells and fixes mismatched addresses. */
export function repairDayActivities(day: Day, hotel?: Hotel | null): Day {
  const places = placesForActivityMatching(day, hotel)
  const activities: Activity[] = []

  for (const activity of day.activities) {
    const source = (activity.notes?.trim() || activity.title).trim()
    const blocks = splitActivityBlocks(source)
    const base = periodBaseId(activity.id)

    blocks.forEach((block, index) => {
      const slug = periodSlug(activity.id, index)
      const nextId =
        blocks.length === 1
          ? activity.id
          : slug
            ? `${base}-${slug}`
            : `${activity.id}-${index + 1}`
      activities.push(
        buildActivityFromBlock(
          block,
          nextId,
          places,
          index === 0 ? activity.done : false,
        ),
      )
    })
  }

  return { ...day, activities }
}

/** Fixes legacy period blobs and wrong shared addresses across the trip. */
export function repairTripActivityLocations(trip: Trip): Trip {
  return {
    ...trip,
    days: trip.days.map((day) => repairDayActivities(day, trip.hotel)),
  }
}
