import type { BudgetId, Expense, Trip } from '../types'
import { repairTripActivityLocations } from './activityLocation'
import { normalizeBudgetId } from './budgets'
import { supabase } from './supabase'

type CheckRow = {
  activity_id: string
  done: boolean
  updated_at: string
}

type ExpenseRow = {
  id: string
  day_id: string
  budget_id: string
  description: string
  amount: number | string
  created_at: string
}

type TripDocumentRow = {
  id: string
  trip: Trip
  updated_at: string
}

function isValidTrip(value: unknown): value is Trip {
  if (!value || typeof value !== 'object') return false
  const trip = value as Trip
  if (
    typeof trip.name !== 'string' ||
    trip.name.length > 200 ||
    !Array.isArray(trip.days) ||
    trip.days.length === 0 ||
    trip.days.length > 100 ||
    !Array.isArray(trip.expenses) ||
    trip.expenses.length > 5000 ||
    !trip.expenses.every(
      (expense) =>
        expense &&
        typeof expense.id === 'string' &&
        expense.id.length <= 200 &&
        typeof expense.dayId === 'string' &&
        expense.dayId.length <= 200 &&
        typeof expense.description === 'string' &&
        expense.description.trim().length > 0 &&
        expense.description.length <= 500 &&
        typeof expense.amount === 'number' &&
        Number.isFinite(expense.amount) &&
        expense.amount >= 0 &&
        expense.amount <= 1_000_000,
    )
  ) {
    return false
  }

  return trip.days.every(
    (day) =>
      day &&
      typeof day.id === 'string' &&
      day.id.length <= 200 &&
      typeof day.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
      Array.isArray(day.activities) &&
      day.activities.length <= 100 &&
      day.activities.every(
        (activity) =>
          activity &&
          typeof activity.id === 'string' &&
          activity.id.length <= 200 &&
          typeof activity.title === 'string' &&
          activity.title.length <= 1000,
      ),
  )
}

export async function fetchRemoteState(): Promise<{
  checks: Record<string, boolean>
  expenses: Expense[]
  tripDocument: Trip | null
  tripDocumentUpdatedAt: string | null
}> {
  if (!supabase) {
    return { checks: {}, expenses: [], tripDocument: null, tripDocumentUpdatedAt: null }
  }

  const [checksRes, expensesRes, tripRes] = await Promise.all([
    supabase.from('activity_checks').select('activity_id, done'),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('trip_document').select('trip, updated_at').eq('id', 'current').maybeSingle(),
  ])

  if (checksRes.error) throw checksRes.error
  if (expensesRes.error) throw expensesRes.error

  const checks: Record<string, boolean> = {}
  for (const row of (checksRes.data ?? []) as CheckRow[]) {
    checks[row.activity_id] = Boolean(row.done)
  }

  const expenses = ((expensesRes.data ?? []) as ExpenseRow[])
    .map(rowToExpense)
    .filter((e): e is Expense => e != null)

  // Projeto antigo sem trip_document: segue só com checks/gastos
  if (tripRes.error) {
    if (/trip_document|schema cache|does not exist/i.test(tripRes.error.message)) {
      return { checks, expenses, tripDocument: null, tripDocumentUpdatedAt: null }
    }
    throw tripRes.error
  }

  const tripRow = tripRes.data as TripDocumentRow | null
  const tripDocument =
    tripRow && isValidTrip(tripRow.trip)
      ? repairTripActivityLocations(tripRow.trip)
      : null

  return {
    checks,
    expenses,
    tripDocument,
    tripDocumentUpdatedAt: tripRow?.updated_at ?? null,
  }
}

export function applyRemoteToTrip(
  trip: Trip,
  checks: Record<string, boolean>,
  expenses: Expense[],
): Trip {
  const repaired = repairTripActivityLocations(trip)
  return {
    ...repaired,
    days: repaired.days.map((day) => ({
      ...day,
      activities: day.activities.map((act) => ({
        ...act,
        done: checks[act.id] ?? act.done,
      })),
    })),
    expenses,
  }
}

export async function upsertTripDocument(trip: Trip): Promise<void> {
  if (!supabase) return
  if (!isValidTrip(trip)) {
    throw new Error('O roteiro contém dados inválidos ou excede os limites permitidos.')
  }
  const { error } = await supabase.from('trip_document').upsert({
    id: 'current',
    trip: structuredClone(trip),
    updated_at: new Date().toISOString(),
  })
  if (error) {
    if (/trip_document|schema cache/i.test(error.message)) {
      throw new Error(
        'Falta criar as tabelas de versão no Supabase. Rode supabase/trip_versions.sql no SQL Editor.',
      )
    }
    throw error
  }
}

/**
 * Restaura checks, gastos e o documento do roteiro no banco a partir de um snapshot.
 */
export async function restoreRemoteFromTrip(trip: Trip): Promise<void> {
  if (!supabase) return

  await upsertTripDocument(trip)

  const { data: existingExpenses, error: listError } = await supabase
    .from('expenses')
    .select('id')
  if (listError) throw listError

  const keep = new Set(trip.expenses.map((e) => e.id))
  const toDelete = ((existingExpenses ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !keep.has(id))

  if (toDelete.length) {
    const { error } = await supabase.from('expenses').delete().in('id', toDelete)
    if (error) throw error
  }

  if (trip.expenses.length) {
    const { error } = await supabase.from('expenses').upsert(
      trip.expenses.map((expense) => ({
        id: expense.id,
        day_id: expense.dayId,
        budget_id: expense.budgetId,
        description: expense.description,
        amount: expense.amount,
        created_at: expense.createdAt,
      })),
    )
    if (error) throw error
  }

  const checks = trip.days.flatMap((day) =>
    day.activities.map((act) => ({
      activity_id: act.id,
      done: Boolean(act.done),
      updated_at: new Date().toISOString(),
    })),
  )

  if (checks.length) {
    const { error } = await supabase.from('activity_checks').upsert(checks)
    if (error) throw error
  }
}

export async function upsertCheck(activityId: string, done: boolean): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('activity_checks').upsert({
    activity_id: activityId,
    done,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function upsertExpense(expense: Expense): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('expenses').upsert({
    id: expense.id,
    day_id: expense.dayId,
    budget_id: expense.budgetId,
    description: expense.description,
    amount: expense.amount,
    created_at: expense.createdAt,
  })
  if (error) throw error
}

export async function deleteExpenseRemote(expenseId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
}

function rowToExpense(row: ExpenseRow): Expense | null {
  const budgetId = normalizeBudgetId(row.budget_id)
  const amount = Number(row.amount)
  if (!budgetId || !Number.isFinite(amount)) return null
  return {
    id: row.id,
    dayId: row.day_id,
    budgetId: budgetId as BudgetId,
    description: row.description,
    amount,
    createdAt: row.created_at,
  }
}

export type RemoteChange =
  | { type: 'check'; activityId: string; done: boolean }
  | { type: 'expense_upsert'; expense: Expense }
  | { type: 'expense_delete'; expenseId: string }
  | { type: 'trip_document'; trip: Trip }

export function subscribeRemote(
  onChange: (change: RemoteChange) => void,
): () => void {
  if (!supabase) return () => undefined

  const channel = supabase
    .channel('roteiro-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_checks' },
      (payload) => {
        const row = (payload.new ?? payload.old) as CheckRow | undefined
        if (!row?.activity_id) return
        if (payload.eventType === 'DELETE') {
          onChange({ type: 'check', activityId: row.activity_id, done: false })
          return
        }
        onChange({
          type: 'check',
          activityId: row.activity_id,
          done: Boolean((payload.new as CheckRow).done),
        })
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as ExpenseRow
          if (old?.id) onChange({ type: 'expense_delete', expenseId: old.id })
          return
        }
        const expense = rowToExpense(payload.new as ExpenseRow)
        if (expense) onChange({ type: 'expense_upsert', expense })
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trip_document' },
      (payload) => {
        if (payload.eventType === 'DELETE') return
        const row = payload.new as TripDocumentRow
        if (row?.id === 'current' && isValidTrip(row.trip)) {
          onChange({ type: 'trip_document', trip: row.trip })
        }
      },
    )
    .subscribe()

  return () => {
    void supabase?.removeChannel(channel)
  }
}
