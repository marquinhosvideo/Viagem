import type { LucideIcon } from 'lucide-react'
import {
  Baby,
  BedDouble,
  Calendar,
  CalendarCheck,
  Car,
  Castle,
  CircleDot,
  Clock,
  FerrisWheel,
  Info,
  Lightbulb,
  Map,
  MapPin,
  Moon,
  NotebookPen,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Sunrise,
  Sun,
  Tag,
  Ticket,
  TicketPercent,
  TreePine,
  Utensils,
} from 'lucide-react'

const EMOJI_ICONS: Record<string, LucideIcon> = {
  '✈': Plane,
  '🛒': ShoppingCart,
  '🛍': ShoppingBag,
  '🎢': Castle,
  '🎡': FerrisWheel,
  '💄': Sparkles,
  '😴': BedDouble,
  '🥞': Utensils,
  '🍽': Utensils,
  '🎟': Ticket,
  '📍': MapPin,
  '🚗': Car,
  '👶': Baby,
  '📝': NotebookPen,
  '🎄': TreePine,
}

const NOTE_LABEL_BY_ICON: Array<[LucideIcon, string]> = [
  [MapPin, 'Onde'],
  [Car, 'Deslocamento'],
  [Baby, 'Com a criança'],
  [NotebookPen, 'Observações'],
]

const TIP_ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/hor[aá]rio/i, Clock],
  [/reserva/i, CalendarCheck],
  [/black friday/i, Tag],
  [/cupo/i, TicketPercent],
  [/imposto/i, Receipt],
  [/crian/i, Baby],
  [/domingo/i, Calendar],
  [/disney/i, Castle],
  [/premissa/i, Info],
]

export function stripEmoji(value: string): string {
  return (value || '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function iconFromEmoji(value: string, fallback: LucideIcon = CircleDot): LucideIcon {
  const match = (value || '').match(/\p{Extended_Pictographic}/u)
  if (!match) return fallback
  return EMOJI_ICONS[match[0]] ?? fallback
}

export function tipIcon(tema: string): LucideIcon {
  for (const [re, icon] of TIP_ICON_RULES) {
    if (re.test(tema)) return icon
  }
  return Lightbulb
}

export function noteLabelForIcon(icon: LucideIcon): string {
  return NOTE_LABEL_BY_ICON.find(([candidate]) => candidate === icon)?.[1] || 'Observações'
}

export type PeriodKey = 'manha' | 'tarde' | 'noite'

export function periodFromActivityId(id: string): {
  key: PeriodKey | null
  label: string
  icon: LucideIcon
} {
  const key = (id.match(/(manha|tarde|noite)(?:-\d+)?$/) || [])[1] as PeriodKey | undefined
  if (key === 'manha') return { key, label: 'Manhã', icon: Sunrise }
  if (key === 'tarde') return { key, label: 'Tarde', icon: Sun }
  if (key === 'noite') return { key, label: 'Noite', icon: Moon }
  return { key: null, label: 'Período', icon: Clock }
}

export type ActivityLine = {
  icon: LucideIcon
  cat: string
  text: string
}

export function parseActivityLines(raw: string): ActivityLine[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const icon = iconFromEmoji(line)
      let text = stripEmoji(line)
      let cat = ''
      const m = text.match(/^([A-ZÀ-Ú/ ]{3,}?)\s+[—-]\s+([\s\S]*)$/)
      if (m) {
        cat = m[1].split('/')[0].trim()
        cat = cat.charAt(0) + cat.slice(1).toLowerCase()
        text = m[2]
      }
      return { icon, cat, text }
    })
}

export function dayTitleParts(label: string): Array<{ text: string; icon: LucideIcon }> {
  return label.split('+').map((part) => ({
    text: stripEmoji(part),
    icon: iconFromEmoji(part, Map),
  }))
}
