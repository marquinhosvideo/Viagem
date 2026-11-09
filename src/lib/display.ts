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
  NotebookPen,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
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

export function dayTitleParts(label: string): Array<{ text: string; icon: LucideIcon }> {
  return label.split('+').map((part) => ({
    text: stripEmoji(part),
    icon: iconFromEmoji(part, Map),
  }))
}
