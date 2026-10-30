import type { LucideIcon } from 'lucide-react'
import { MapPin, NotebookPen } from 'lucide-react'
import { iconFromEmoji, noteLabelForIcon, stripEmoji } from './display'

export type DayNoteItem = {
  icon: LucideIcon
  label: string
  text: string
}

export type DayPlace = {
  name: string
  addr: string
  copyText: string
}

/** Splits "A | B" and "A (alternativa: B)" into separate place lines. */
export function splitPlaceChunks(raw: string): string[] {
  const parts: string[] = []
  for (const chunk of raw.split('|').map((value) => value.trim()).filter(Boolean)) {
    const alt = chunk.match(/^(.*?)\s*\((?:alternativa|alt\.?):\s*(.+?)\)\s*$/i)
    if (alt) {
      parts.push(alt[1].trim())
      parts.push(alt[2].trim())
    } else {
      parts.push(chunk)
    }
  }
  return parts
}

export function formatDayPlace(name: string, addr?: string): string {
  const cleanName = name.trim()
  const cleanAddr = (addr ?? '').trim()
  if (!cleanName) return ''
  if (!cleanAddr || /^buscar pelo nome$/i.test(cleanAddr)) return cleanName
  return `${cleanName} – ${cleanAddr}`
}

export function toDayPlace(name: string, addr?: string): DayPlace | null {
  const cleanName = name.trim().slice(0, 160)
  if (!cleanName) return null
  const cleanAddr = (addr ?? '').trim().slice(0, 300)
  const copyText = formatDayPlace(cleanName, cleanAddr)
  return {
    name: cleanName,
    addr: cleanAddr || 'Buscar pelo nome',
    copyText,
  }
}

function isPlaceParagraph(para: string): boolean {
  const icon = iconFromEmoji(para, NotebookPen)
  return icon === MapPin || para.trim().startsWith('📍')
}

/** Rebuilds dayNotes keeping non-place paragraphs and replacing the places block. */
export function replaceDayPlaces(
  dayNotes: string | undefined,
  places: DayPlace[],
): string | undefined {
  const kept = (dayNotes ?? '')
    .split(/\n\n+/)
    .map((para) => para.trim())
    .filter((para) => para && !isPlaceParagraph(para))
  const placePara = places.length
    ? `📍 ${places.map((place) => place.copyText || formatDayPlace(place.name, place.addr)).join(' | ')}`
    : ''
  const next = [placePara, ...kept].filter(Boolean).join('\n\n')
  return next || undefined
}

export function parseDayMeta(dayNotes?: string): {
  notes: DayNoteItem[]
  places: DayPlace[]
} {
  const notes: DayNoteItem[] = []
  const places: DayPlace[] = []
  if (!dayNotes?.trim()) return { notes, places }

  const paras = dayNotes.split(/\n\n+/).filter((p) => p.trim())
  for (const para of paras) {
    if (isPlaceParagraph(para)) {
      const raw = stripEmoji(para)
      splitPlaceChunks(raw).forEach((piece) => {
        const [name, ...rest] = piece.split(/\s+[–—-]\s+/)
        const place = toDayPlace(name, rest.join(' – '))
        if (place) places.push(place)
      })
    } else {
      const icon = iconFromEmoji(para, NotebookPen)
      notes.push({
        icon,
        label: noteLabelForIcon(icon),
        text: stripEmoji(para),
      })
    }
  }

  return { notes, places }
}
