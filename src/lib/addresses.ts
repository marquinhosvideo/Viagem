import type { Place, Stop, Trip } from '../types'
import { placeDisplayLine, placeOf, sortStops } from './places'

/** Endereços do dia a partir das paradas ordenadas. */
export function extractDayAddresses(
  trip: Pick<Trip, 'places'>,
  stops: Stop[],
): string[] {
  return unique(
    sortStops(stops).flatMap((stop) => {
      const place = placeOf(trip, stop.placeId)
      if (!place) return []
      const line = placeDisplayLine(place)
      return line.length >= 3 ? [line] : []
    }),
  )
}

export function formatPlaceAddress(place: Place): string {
  return placeDisplayLine(place)
}

function unique(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fallback abaixo
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
