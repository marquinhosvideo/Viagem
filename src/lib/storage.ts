import type { Expense, Trip } from '../types'
import { sampleTrip } from '../data/sampleTrip'
import { repairTripActivityLocations } from './activityLocation'
import { normalizeBudgetId } from './budgets'

const STORAGE_KEY = 'roteiro-orlando-2026-v3-budgets'

export function loadTrip(): Trip {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem('roteiro-orlando-2026-v2')
    if (!raw) return withBudgets(structuredClone(sampleTrip))
    const parsed = JSON.parse(raw) as Trip
    if (!parsed?.days?.length) return withBudgets(structuredClone(sampleTrip))
    return withBudgets(migrateTrip(parsed))
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

function withBudgets(trip: Trip): Trip {
  const repaired = repairTripActivityLocations(trip)
  return {
    ...repaired,
    currency: 'BRL',
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

function migrateTrip(trip: Trip): Trip {
  return withBudgets(trip)
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
