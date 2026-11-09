import type { Expense, Trip } from '../types'
import { sampleTrip } from '../data/sampleTrip'
import { ensureCurrentHotel } from './dayMap'
import { normalizeBudgetId } from './budgets'

const STORAGE_KEY = 'roteiro-orlando-2026-v4-paradas'
const LEGACY_KEYS = [
  'roteiro-orlando-2026-v3-budgets',
  'roteiro-orlando-2026-v2',
]

export function loadTrip(): Trip {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Trip
      if (isNewTripShape(parsed)) return withBudgets(parsed)
    }
    // Modelo antigo (manhã/tarde/noite + " | ") — descarta e usa a planilha revisada.
    for (const key of LEGACY_KEYS) localStorage.removeItem(key)
    return withBudgets(structuredClone(sampleTrip))
  } catch {
    return withBudgets(structuredClone(sampleTrip))
  }
}

export function saveTrip(trip: Trip): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trip))
}

export function resetTrip(): Trip {
  const trip = withBudgets(structuredClone(sampleTrip))
  saveTrip(trip)
  return trip
}

function isNewTripShape(value: unknown): value is Trip {
  if (!value || typeof value !== 'object') return false
  const trip = value as Trip & { days?: Array<{ stops?: unknown; activities?: unknown }> }
  if (!Array.isArray(trip.places) || !Array.isArray(trip.days) || !trip.days.length) {
    return false
  }
  return trip.days.every(
    (day) => Array.isArray(day.stops) && !('activities' in day && day.activities),
  )
}

function withBudgets(trip: Trip): Trip {
  const repaired = ensureCurrentHotel(trip)
  return {
    ...repaired,
    currency: 'BRL',
    places: repaired.places ?? [],
    budgetLimits: repaired.budgetLimits ?? {
      marcos: 5000,
      dielen: 5000,
      helena: 5000,
      alimentacao: 5000,
      outros: 5000,
    },
    expenses: (repaired.expenses ?? []).map(migrateExpense).filter(Boolean) as Expense[],
  }
}

function migrateExpense(raw: Expense | Record<string, unknown>): Expense | null {
  const e = raw as Expense & { category?: string }
  const budgetId = normalizeBudgetId(e.budgetId ?? e.category)
  if (!budgetId || typeof e.amount !== 'number') return null
  return {
    id: String(e.id),
    dayId: String(e.dayId),
    budgetId,
    description: String(e.description ?? ''),
    amount: e.amount,
    createdAt: String(e.createdAt ?? new Date().toISOString()),
  }
}
