import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Activity, Day, Trip } from '../types'
import { ActivityItem } from '../components/ActivityItem'
import { AddressCopyList } from '../components/AddressCopyList'
import { DayChips } from '../components/DayChips'
import { DayHero } from '../components/DayHero'
import { DayInfo } from '../components/DayInfo'
import { ActivityForm, DayForm } from '../components/ItineraryEditor'
import { parseDayMeta } from '../lib/dayMeta'
import { uid } from '../lib/format'

type Props = {
  trip: Trip
  initialDayId?: string
  focusDayId?: string
  onToggle: (dayId: string, activityId: string) => void
  onChange: (trip: Trip) => void | Promise<void>
}

type Editor =
  | { type: 'day-add' }
  | { type: 'day-edit' }
  | { type: 'activity-add' }
  | { type: 'activity-edit'; activity: Activity }
  | null

export function ItineraryView({
  trip,
  initialDayId,
  focusDayId,
  onToggle,
  onChange,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialDayId ?? trip.days[0]?.id)
  const [editor, setEditor] = useState<Editor>(null)

  useEffect(() => {
    if (!focusDayId) return
    if (!trip.days.some((day) => day.id === focusDayId)) return
    setSelectedId(focusDayId)
    setEditor(null)
  }, [focusDayId, trip.days])
  const dayIndex = Math.max(
    0,
    trip.days.findIndex((d) => d.id === selectedId),
  )
  const day = trip.days[dayIndex] ?? trip.days[0]
  const { notes, places } = useMemo(
    () => parseDayMeta(day?.dayNotes),
    [day?.dayNotes],
  )

  if (!day) {
    return <p className="empty-hint">Nenhum dia no roteiro. Importe seu Excel.</p>
  }

  function withDays(days: Day[], expenses = trip.expenses): Trip {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
    return {
      ...trip,
      days: sorted,
      expenses,
      startDate: sorted[0]?.date ?? trip.startDate,
      endDate: sorted.at(-1)?.date ?? trip.endDate,
    }
  }

  function saveDay(input: { date: string; label: string; dayNotes?: string }) {
    if (editor?.type === 'day-add') {
      if (trip.days.some((candidate) => candidate.date === input.date)) {
        window.alert('Já existe um dia com essa data.')
        return
      }
      const nextDay: Day = {
        id: uid('day'),
        ...input,
        activities: [],
      }
      setSelectedId(nextDay.id)
      void onChange(withDays([...trip.days, nextDay]))
    } else {
      void onChange(
        withDays(
          trip.days.map((candidate) =>
            candidate.id === day.id ? { ...candidate, ...input } : candidate,
          ),
        ),
      )
    }
    setEditor(null)
  }

  function deleteDay() {
    if (trip.days.length <= 1) {
      window.alert('O roteiro precisa manter pelo menos um dia.')
      return
    }
    if (!window.confirm(`Excluir ${day.label} e toda a programação desse dia?`)) return
    const remaining = trip.days.filter((candidate) => candidate.id !== day.id)
    const nextSelected = remaining[Math.min(dayIndex, remaining.length - 1)]
    setSelectedId(nextSelected.id)
    setEditor(null)
    void onChange(
      withDays(
        remaining,
        trip.expenses.filter((expense) => expense.dayId !== day.id),
      ),
    )
  }

  function saveActivity(input: {
    period: 'manha' | 'tarde' | 'noite'
    time?: string
    title: string
    location?: string
    notes?: string
  }) {
    const existing = editor?.type === 'activity-edit' ? editor.activity : null
    const baseId = existing?.id.replace(/-(manha|tarde|noite)$/, '') ?? uid('act')
    const nextActivity: Activity = {
      id: `${baseId}-${input.period}`,
      time: input.time,
      title: input.title,
      location: input.location,
      notes: input.notes,
      done: existing?.done ?? false,
    }
    const activities = existing
      ? day.activities.map((activity) =>
          activity.id === existing.id ? nextActivity : activity,
        )
      : [...day.activities, nextActivity]
    activities.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    void onChange(
      withDays(
        trip.days.map((candidate) =>
          candidate.id === day.id ? { ...candidate, activities } : candidate,
        ),
      ),
    )
    setEditor(null)
  }

  function deleteActivity(activity: Activity) {
    if (!window.confirm(`Excluir “${activity.title}”?`)) return
    void onChange(
      withDays(
        trip.days.map((candidate) =>
          candidate.id === day.id
            ? {
                ...candidate,
                activities: candidate.activities.filter(
                  (item) => item.id !== activity.id,
                ),
              }
            : candidate,
        ),
      ),
    )
    setEditor(null)
  }

  return (
    <section className="view">
      <section className="band band--parchment band--hero">
        <div className="band__inner">
          <p className="eyebrow">Roteiro</p>
          <h1 className="display-lg">{trip.days.length} dias em Orlando.</h1>
          <p className="lede">Marque e edite manhã, tarde e noite.</p>
          <button
            type="button"
            className="btn btn--ghost-pill itinerary-add-day"
            onClick={() => setEditor({ type: 'day-add' })}
          >
            <CalendarPlus size={18} aria-hidden />
            Adicionar dia
          </button>
          {editor?.type === 'day-add' ? (
            <DayForm
              key="day-add"
              onSave={saveDay}
              onCancel={() => setEditor(null)}
            />
          ) : null}
        </div>
        <DayChips
          days={trip.days}
          selectedId={day.id}
          onSelect={(id) => {
            setSelectedId(id)
            setEditor(null)
          }}
        />
      </section>

      <DayHero day={day} dayIndex={dayIndex} dayCount={trip.days.length} />

      <section className="band">
        <div className="band__inner">
          <div className="itinerary-section-head">
            <h2 className="section-title">Programação.</h2>
            <div className="itinerary-section-head__actions">
              <button
                type="button"
                className="btn btn--pearl"
                onClick={() => setEditor({ type: 'day-edit' })}
              >
                <Pencil size={16} aria-hidden />
                Editar dia
              </button>
              <button
                type="button"
                className="btn btn--pearl btn--danger"
                onClick={deleteDay}
              >
                <Trash2 size={16} aria-hidden />
                Excluir dia
              </button>
            </div>
          </div>
          {editor?.type === 'day-edit' ? (
            <DayForm
              key={`day-${day.id}`}
              day={day}
              onSave={saveDay}
              onCancel={() => setEditor(null)}
            />
          ) : null}
          <div className="activity-stack">
            {day.activities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                onToggle={() => onToggle(day.id, activity.id)}
                onEdit={() => setEditor({ type: 'activity-edit', activity })}
                onDelete={() => deleteActivity(activity)}
              />
            ))}
          </div>
          {day.activities.length === 0 ? (
            <p className="empty-hint">Nenhum período adicionado neste dia.</p>
          ) : null}
          {editor?.type === 'activity-add' ||
          editor?.type === 'activity-edit' ? (
            <ActivityForm
              key={
                editor.type === 'activity-edit'
                  ? editor.activity.id
                  : `new-${day.id}`
              }
              activity={
                editor.type === 'activity-edit' ? editor.activity : undefined
              }
              onSave={saveActivity}
              onCancel={() => setEditor(null)}
            />
          ) : (
            <button
              type="button"
              className="btn btn--primary itinerary-add-activity"
              onClick={() => setEditor({ type: 'activity-add' })}
            >
              <Plus size={18} aria-hidden />
              Adicionar período
            </button>
          )}
        </div>
      </section>

      <DayInfo notes={notes} />
      <AddressCopyList places={places} />
    </section>
  )
}
