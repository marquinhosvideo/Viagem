import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { brlToUsd } from './currency'

export function formatMoney(amount: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amount)
}

/** Valor canônico em BRL + equivalente em USD (taxa fixa). */
export function formatMoneyPair(amountBrl: number): string {
  return `${formatMoney(amountBrl, 'BRL')} · ${formatMoney(brlToUsd(amountBrl), 'USD')}`
}

export function formatDayLabel(dateIso: string): string {
  const date = parseISO(dateIso)
  if (!isValid(date)) return dateIso
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
}

export function formatShortDate(dateIso: string): string {
  const date = parseISO(dateIso)
  if (!isValid(date)) return dateIso
  return format(date, 'dd/MM', { locale: ptBR })
}

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function formatWeekdayShort(dateIso: string): string {
  const date = parseISO(dateIso)
  if (!isValid(date)) return ''
  return WEEKDAYS_SHORT[date.getUTCDay()] ?? ''
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Aceita formatos BR (12,99 / 1.234,56) e US (12.99 / 1,234.56),
 * com ou sem R$ / $.
 */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const s = value.replace(/(?:R\$|US\$|USD|\$)/gi, '').replace(/\s/g, '').trim()
  if (!s) return 0

  // US: 1,234.56 ou 12.99
  if (/^\d{1,3}(,\d{3})*\.\d{1,2}$/.test(s) || /^\d+\.\d{1,2}$/.test(s)) {
    const n = Number(s.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  // BR: 1.234,56 ou 12,99
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
