import type { FxRates } from './fxServer'

export type { FxQuote, FxRates } from './fxServer'

const CACHE_KEY = 'fx-rates-v1'
const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEnvelope = {
  savedAt: number
  rates: FxRates
}

function readCache(): FxRates | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope
    if (!parsed?.rates || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.rates
  } catch {
    return null
  }
}

function writeCache(rates: FxRates) {
  try {
    const payload: CacheEnvelope = { savedAt: Date.now(), rates }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}

export async function loadFxRates(): Promise<FxRates> {
  const cached = readCache()
  if (cached) return cached

  const res = await fetch('/api/fx', { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`fx_${res.status}`)
  const rates = (await res.json()) as FxRates
  writeCache(rates)
  return rates
}

export function formatFxRate(rate: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(rate)
}

export function formatFxAsOf(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
