import type { LucideIcon } from 'lucide-react'
import { Baby, Car, NotebookPen } from 'lucide-react'
import type { Day, Place, Stop, Trip } from '../types'
import { placeOf, sortStops } from './places'

export type DayNoteItem = {
  icon: LucideIcon
  label: string
  text: string
}

export type DayPlace = {
  name: string
  addr: string
  copyText: string
  optional?: boolean
}

export function formatDayPlace(name: string, addr?: string | null): string {
  const cleanName = name.trim()
  const cleanAddr = (addr ?? '').trim()
  if (!cleanName) return ''
  if (!cleanAddr) return cleanName
  return `${cleanName} – ${cleanAddr}`
}

export function toDayPlace(
  name: string,
  addr?: string | null,
  optional = false,
): DayPlace | null {
  const cleanName = name.trim().slice(0, 160)
  if (!cleanName) return null
  const cleanAddr = (addr ?? '').trim().slice(0, 300)
  return {
    name: cleanName,
    addr: cleanAddr,
    copyText: formatDayPlace(cleanName, cleanAddr),
    optional,
  }
}

/** Cabeçalho do dia: carro, criança e observações (uma vez só). */
export function dayHeaderNotes(day: Pick<Day, 'driveFromHotel' | 'kidNotes' | 'notes'>): DayNoteItem[] {
  const notes: DayNoteItem[] = []
  if (day.driveFromHotel?.trim()) {
    notes.push({
      icon: Car,
      label: 'Deslocamento',
      text: day.driveFromHotel.trim(),
    })
  }
  if (day.kidNotes?.trim()) {
    notes.push({
      icon: Baby,
      label: 'Com a criança',
      text: day.kidNotes.trim(),
    })
  }
  if (day.notes?.trim()) {
    notes.push({
      icon: NotebookPen,
      label: 'Observações',
      text: day.notes.trim(),
    })
  }
  return notes
}

export function placesFromStops(
  trip: Pick<Trip, 'places'>,
  stops: Stop[],
): DayPlace[] {
  return sortStops(stops).flatMap((stop) => {
    const place = placeOf(trip, stop.placeId)
    if (!place) return []
    const item = toDayPlace(place.name, place.address, stop.status === 'opcional')
    return item ? [item] : []
  })
}

export function dayPlaces(trip: Pick<Trip, 'places'>, day: Day): DayPlace[] {
  return placesFromStops(trip, day.stops)
}

export function placeToDayPlace(place: Place, optional = false): DayPlace {
  return {
    name: place.name,
    addr: place.address?.trim() ?? '',
    copyText: formatDayPlace(place.name, place.address),
    optional,
  }
}
