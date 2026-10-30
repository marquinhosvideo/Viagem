import type { Activity, Day, Trip } from '../types'
import { formatDayPlace, parseDayMeta, type DayPlace } from './dayMeta'

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

/** Only attach a place when the activity text mentions exactly one day place. */
export function locationForActivityText(
  text: string,
  places: DayPlace[],
): string | undefined {
  if (!text.trim() || !places.length) return undefined
  const blob = fold(text)
  const matches = places.filter((place) => {
    const name = fold(place.name)
    return name.length >= 3 && blob.includes(name)
  })
  if (matches.length !== 1) return undefined
  return formatDayPlace(matches[0].name, matches[0].addr) || undefined
}

export function stripPeriodTitlePrefix(title: string): string {
  return title
    .replace(/^(Manhã|Tarde|Noite)\s*[—-]\s*/i, '')
    .replace(/^[\uFE0F\u200D\s]+/, '')
    .trim()
}

function sameLocation(a?: string, b?: string): boolean {
  if (!a || !b) return false
  return fold(a) === fold(b)
}

/** True when every activity inherited the first day address (legacy import bug). */
function hasRepeatedFirstPlace(day: Day, places: DayPlace[]): boolean {
  if (places.length < 2 || day.activities.length < 2) return false
  const first = formatDayPlace(places[0].name, places[0].addr)
  if (!first) return false
  return day.activities.every((activity) => sameLocation(activity.location, first))
}

export function repairDayActivities(day: Day): Day {
  const places = parseDayMeta(day.dayNotes).places
  const first = places[0] ? formatDayPlace(places[0].name, places[0].addr) : ''
  const repeated = hasRepeatedFirstPlace(day, places)

  return {
    ...day,
    activities: day.activities.map((activity) => {
      const title = stripPeriodTitlePrefix(activity.title)
      const next: Activity = { ...activity, title }

      if (
        repeated ||
        (places.length > 1 && first && sameLocation(activity.location, first))
      ) {
        const matched = locationForActivityText(
          `${activity.notes ?? ''}\n${title}`,
          places,
        )
        if (matched) next.location = matched
        else delete next.location
      }

      return next
    }),
  }
}

/** Fixes legacy imports that copied the first day address onto every period. */
export function repairTripActivityLocations(trip: Trip): Trip {
  return {
    ...trip,
    days: trip.days.map(repairDayActivities),
  }
}
