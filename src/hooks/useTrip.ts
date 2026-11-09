import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BudgetId, Expense, Trip } from '../types'
import { ensureCurrentHotel } from '../lib/dayMap'
import { loadTrip, resetTrip, saveTrip } from '../lib/storage'
import { uid } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  applyRemoteToTrip,
  deleteExpenseRemote,
  fetchRemoteState,
  restoreRemoteFromTrip,
  subscribeRemote,
  upsertCheck,
  upsertExpense,
  upsertTripDocument,
} from '../lib/remoteSync'

export type SyncState = 'local' | 'loading' | 'synced' | 'saving' | 'error'

export function useTrip(enabled = true) {
  const [trip, setTrip] = useState<Trip>(() => loadTrip())
  const [syncState, setSyncState] = useState<SyncState>(
    isSupabaseConfigured ? 'loading' : 'local',
  )
  const [syncError, setSyncError] = useState<string | null>(null)
  const tripRef = useRef(trip)
  tripRef.current = trip

  useEffect(() => {
    saveTrip(trip)
  }, [trip])

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setSyncState(isSupabaseConfigured ? 'loading' : 'local')
      return
    }

    let cancelled = false
    setSyncState('loading')

    void (async () => {
      try {
        const remote = await fetchRemoteState()
        if (cancelled) return
        setTrip((prev) => {
          const base = remote.tripDocument ?? prev
          return applyRemoteToTrip(base, remote.checks, remote.expenses)
        })
        setSyncState('synced')
        setSyncError(null)
      } catch (err) {
        if (cancelled) return
        setSyncState('error')
        setSyncError(err instanceof Error ? err.message : 'Falha ao sincronizar')
      }
    })()

    const unsubscribe = subscribeRemote((change) => {
      setTrip((prev) => {
        if (change.type === 'trip_document') {
          const incoming = ensureCurrentHotel(change.trip)
          return {
            ...incoming,
            expenses: incoming.expenses?.length ? incoming.expenses : prev.expenses,
            days: incoming.days.map((day) => {
              const prevDay = prev.days.find((d) => d.id === day.id)
              return {
                ...day,
                stops: day.stops.map((stop) => {
                  const prevStop = prevDay?.stops.find((s) => s.id === stop.id)
                  return prevStop ? { ...stop, done: prevStop.done } : stop
                }),
              }
            }),
          }
        }
        if (change.type === 'check') {
          return {
            ...prev,
            days: prev.days.map((day) => ({
              ...day,
              stops: day.stops.map((stop) =>
                stop.id === change.activityId ? { ...stop, done: change.done } : stop,
              ),
            })),
          }
        }
        if (change.type === 'expense_delete') {
          return {
            ...prev,
            expenses: prev.expenses.filter((e) => e.id !== change.expenseId),
          }
        }
        const others = prev.expenses.filter((e) => e.id !== change.expense.id)
        return { ...prev, expenses: [change.expense, ...others] }
      })
      setSyncState('synced')
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [enabled])

  const replaceTrip = useCallback(
    async (next: Trip) => {
      setTrip(next)
      if (!isSupabaseConfigured || !enabled) return
      setSyncState('saving')
      try {
        await upsertTripDocument(next)
        setSyncState('synced')
        setSyncError(null)
      } catch (err) {
        setSyncState('error')
        setSyncError(err instanceof Error ? err.message : 'Falha ao salvar roteiro')
      }
    },
    [enabled],
  )

  const restoreTripSnapshot = useCallback(
    async (next: Trip) => {
      setTrip(next)
      if (!isSupabaseConfigured || !enabled) return
      setSyncState('saving')
      try {
        await restoreRemoteFromTrip(next)
        setSyncState('synced')
        setSyncError(null)
      } catch (err) {
        setSyncState('error')
        setSyncError(err instanceof Error ? err.message : 'Falha ao restaurar banco')
        throw err
      }
    },
    [enabled],
  )

  const resetToSample = useCallback(async () => {
    const next = resetTrip()
    setTrip(next)
    if (!isSupabaseConfigured || !enabled) return
    setSyncState('saving')
    try {
      await restoreRemoteFromTrip(next)
      setSyncState('synced')
      setSyncError(null)
    } catch (err) {
      setSyncState('error')
      setSyncError(err instanceof Error ? err.message : 'Falha ao restaurar roteiro')
    }
  }, [enabled])

  const toggleStop = useCallback(async (dayId: string, stopId: string) => {
    const current = tripRef.current.days
      .find((d) => d.id === dayId)
      ?.stops.find((s) => s.id === stopId)
    if (!current) return
    const nextDone = !current.done

    setTrip((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.id !== dayId
          ? day
          : {
              ...day,
              stops: day.stops.map((stop) =>
                stop.id === stopId ? { ...stop, done: nextDone } : stop,
              ),
            },
      ),
    }))

    if (!isSupabaseConfigured || !enabled) return
    setSyncState('saving')
    try {
      await upsertCheck(stopId, nextDone)
      setSyncState('synced')
      setSyncError(null)
    } catch (err) {
      setSyncState('error')
      setSyncError(err instanceof Error ? err.message : 'Falha ao salvar check')
    }
  }, [enabled])

  const addExpense = useCallback(
    async (input: {
      dayId: string
      budgetId: BudgetId
      description: string
      amount: number
    }) => {
      const expense: Expense = {
        id: uid('exp'),
        dayId: input.dayId,
        budgetId: input.budgetId,
        description: input.description.trim(),
        amount: input.amount,
        createdAt: new Date().toISOString(),
      }
      setTrip((prev) => ({
        ...prev,
        expenses: [expense, ...prev.expenses],
      }))

      if (!isSupabaseConfigured || !enabled) return
      setSyncState('saving')
      try {
        await upsertExpense(expense)
        setSyncState('synced')
        setSyncError(null)
      } catch (err) {
        setSyncState('error')
        setSyncError(err instanceof Error ? err.message : 'Falha ao salvar gasto')
      }
    },
    [enabled],
  )

  const removeExpense = useCallback(async (expenseId: string) => {
    setTrip((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
    }))

    if (!isSupabaseConfigured || !enabled) return
    setSyncState('saving')
    try {
      await deleteExpenseRemote(expenseId)
      setSyncState('synced')
      setSyncError(null)
    } catch (err) {
      setSyncState('error')
      setSyncError(err instanceof Error ? err.message : 'Falha ao remover gasto')
    }
  }, [enabled])

  const todayIso = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  const activeDay = useMemo(() => {
    const match = trip.days.find((d) => d.date === todayIso)
    if (match) return match
    const unfinished = trip.days.find((d) =>
      d.stops.some((s) => s.status === 'fixo' && !s.done),
    )
    return unfinished ?? trip.days[0]
  }, [trip.days, todayIso])

  return {
    trip,
    activeDay,
    todayIso,
    syncState,
    syncError,
    replaceTrip,
    restoreTripSnapshot,
    resetToSample,
    toggleStop,
    /** @deprecated use toggleStop */
    toggleActivity: toggleStop,
    addExpense,
    removeExpense,
  }
}
