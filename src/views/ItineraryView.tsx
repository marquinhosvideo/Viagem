import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Day, Place, PlaceCategory, Stop, Trip } from '../types'
import { ActivityItem } from '../components/ActivityItem'
import { DayMap } from '../components/DayMap'
import { DayChips } from '../components/DayChips'
import { DayHero } from '../components/DayHero'
import { DayInfo } from '../components/DayInfo'
import { DayForm, StopForm } from '../components/ItineraryEditor'
import { dayHeaderNotes } from '../lib/dayMeta'
import { formatWeekdayShort, uid } from '../lib/format'
import { placeOf, sortStops } from '../lib/places'

type Props = {
  trip: Trip
  initialDayId?: string
  focusDayId?: string
  onToggle: (dayId: string, stopId: string) => void
  onChange: (trip: Trip) => void | Promise<void>
}

type Editor =
  | { type: 'day-add' }
  | { type: 'day-edit' }
  | { type: 'stop-add' }
  | { type: 'stop-edit'; stop: Stop }
  | null

function upsertPlace(
  places: Place[],
  input: {
    placeName: string
    address?: string | null
    category: PlaceCategory
    existingId?: string
  },
): { places: Place[]; placeId: string } {
  const byName = places.find(
    (place) =>
      place.name.toLocaleLowerCase('pt-BR') ===
      input.placeName.toLocaleLowerCase('pt-BR'),
  )
  if (byName) {
    return {
      placeId: byName.id,
      places: places.map((place) =>
        place.id === byName.id
          ? {
              ...place,
              address: input.address ?? place.address,
              category: input.category,
            }
          : place,
      ),
    }
  }
  if (input.existingId) {
    return {
      placeId: input.existingId,
      places: places.map((place) =>
        place.id === input.existingId
          ? {
              ...place,
              name: input.placeName,
              address: input.address ?? null,
              category: input.category,
            }
          : place,
      ),
    }
  }
  const place: Place = {
    id: uid('loc'),
    name: input.placeName,
    address: input.address ?? null,
    category: input.category,
    lat: null,
    lng: null,
  }
  return { places: [...places, place], placeId: place.id }
}

export function ItineraryView({
  trip,
  initialDayId,
  focusDayId,
  onToggle,
  onChange,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialDayId ?? trip.days[0]?.id)
  const [editor, setEditor] = useState<Editor>(null)
  const [dragStopId, setDragStopId] = useState<string | null>(null)

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
  const notes = useMemo(() => (day ? dayHeaderNotes(day) : []), [day])
  const stops = useMemo(() => (day ? sortStops(day.stops) : []), [day])

  if (!day) {
    return <p className="empty-hint">Nenhum dia no roteiro. Importe seu Excel.</p>
  }

  function withDays(days: Day[], nextPlaces = trip.places, expenses = trip.expenses): Trip {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
    return {
      ...trip,
      places: nextPlaces,
      days: sorted,
      expenses,
      startDate: sorted[0]?.date ?? trip.startDate,
      endDate: sorted.at(-1)?.date ?? trip.endDate,
    }
  }

  function updateDay(nextDay: Day, nextPlaces = trip.places) {
    void onChange(
      withDays(
        trip.days.map((candidate) => (candidate.id === day.id ? nextDay : candidate)),
        nextPlaces,
      ),
    )
  }

  function saveDay(input: {
    date: string
    dayType: string
    weekday?: string
    driveFromHotel?: string | null
    kidNotes?: string | null
    notes?: string | null
  }) {
    if (editor?.type === 'day-add') {
      if (trip.days.some((candidate) => candidate.date === input.date)) {
        window.alert('Já existe um dia com essa data.')
        return
      }
      const nextDay: Day = {
        id: uid('day'),
        date: input.date,
        weekday: input.weekday || formatWeekdayShort(input.date),
        dayType: input.dayType,
        driveFromHotel: input.driveFromHotel,
        kidNotes: input.kidNotes,
        notes: input.notes,
        stops: [],
      }
      setSelectedId(nextDay.id)
      void onChange(withDays([...trip.days, nextDay]))
    } else {
      updateDay({
        ...day,
        date: input.date,
        dayType: input.dayType,
        driveFromHotel: input.driveFromHotel,
        kidNotes: input.kidNotes,
        notes: input.notes,
      })
    }
    setEditor(null)
  }

  function deleteDay() {
    if (trip.days.length <= 1) {
      window.alert('O roteiro precisa manter pelo menos um dia.')
      return
    }
    if (!window.confirm(`Excluir ${day.dayType} e todas as paradas desse dia?`)) return
    const remaining = trip.days.filter((candidate) => candidate.id !== day.id)
    const nextSelected = remaining[Math.min(dayIndex, remaining.length - 1)]
    setSelectedId(nextSelected.id)
    setEditor(null)
    void onChange(
      withDays(
        remaining,
        trip.places,
        trip.expenses.filter((expense) => expense.dayId !== day.id),
      ),
    )
  }

  function saveStop(input: {
    placeName: string
    address?: string | null
    category: PlaceCategory
    status: 'fixo' | 'opcional'
    note?: string | null
    orderInDay: number
  }) {
    const existing = editor?.type === 'stop-edit' ? editor.stop : null
    const { places: nextPlaces, placeId } = upsertPlace(trip.places, {
      placeName: input.placeName,
      address: input.address,
      category: input.category,
      existingId: existing?.placeId,
    })

    const maxSeq = Math.max(0, ...trip.days.flatMap((item) => item.stops.map((s) => s.seq)))
    const nextStop: Stop = {
      id: existing?.id ?? uid('stop'),
      seq: existing?.seq ?? maxSeq + 1,
      orderInDay: input.orderInDay,
      placeId,
      status: input.status,
      note: input.note,
      done: existing?.done ?? false,
    }

    let nextStops = existing
      ? day.stops.map((stop) => (stop.id === existing.id ? nextStop : stop))
      : [...day.stops, nextStop]

    nextStops = sortStops(nextStops).map((stop, index) => ({
      ...stop,
      orderInDay: index + 1,
    }))

    updateDay({ ...day, stops: nextStops }, nextPlaces)
    setEditor(null)
  }

  function deleteStop(stop: Stop) {
    const place = placeOf(trip, stop.placeId)
    if (!window.confirm(`Excluir “${place?.name ?? 'parada'}”?`)) return
    const nextStops = sortStops(day.stops.filter((item) => item.id !== stop.id)).map(
      (item, index) => ({ ...item, orderInDay: index + 1 }),
    )
    updateDay({ ...day, stops: nextStops })
    setEditor(null)
  }

  function reorderStops(fromId: string, toId: string) {
    if (fromId === toId) return
    const ordered = sortStops(day.stops)
    const from = ordered.findIndex((stop) => stop.id === fromId)
    const to = ordered.findIndex((stop) => stop.id === toId)
    if (from < 0 || to < 0) return
    const next = [...ordered]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateDay({
      ...day,
      stops: next.map((stop, index) => ({ ...stop, orderInDay: index + 1 })),
    })
  }

  function handleStopDragStart(stopId: string, event: DragEvent) {
    setDragStopId(stopId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', stopId)
  }

  function handleStopDrop(stopId: string, event: DragEvent) {
    event.preventDefault()
    const fromId = event.dataTransfer.getData('text/plain') || dragStopId
    if (fromId) reorderStops(fromId, stopId)
    setDragStopId(null)
  }

  const nextSeq =
    Math.max(0, ...trip.days.flatMap((item) => item.stops.map((stop) => stop.seq))) + 1

  return (
    <section className="view">
      <section className="band band--parchment band--hero">
        <div className="band__inner">
          <p className="eyebrow">Roteiro</p>
          <h1 className="display-lg">{trip.days.length} dias em Orlando.</h1>
          <p className="lede">Paradas em sequência — arraste para ordenar.</p>
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

      <DayHero trip={trip} day={day} dayIndex={dayIndex} dayCount={trip.days.length} />

      <section className="band">
        <div className="band__inner">
          <div className="itinerary-section-head">
            <h2 className="section-title">Paradas.</h2>
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
            {stops.map((stop) => (
              <ActivityItem
                key={stop.id}
                stop={stop}
                place={placeOf(trip, stop.placeId)}
                draggable
                dragging={dragStopId === stop.id}
                onDragStart={(event) => handleStopDragStart(stop.id, event)}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => handleStopDrop(stop.id, event)}
                onDragEnd={() => setDragStopId(null)}
                onToggle={() => onToggle(day.id, stop.id)}
                onEdit={() => setEditor({ type: 'stop-edit', stop })}
                onDelete={() => deleteStop(stop)}
              />
            ))}
          </div>
          {stops.length === 0 ? (
            <p className="empty-hint">Nenhuma parada neste dia.</p>
          ) : null}
          {editor?.type === 'stop-add' || editor?.type === 'stop-edit' ? (
            <StopForm
              key={
                editor.type === 'stop-edit' ? editor.stop.id : `new-${day.id}`
              }
              trip={trip}
              stop={editor.type === 'stop-edit' ? editor.stop : undefined}
              place={
                editor.type === 'stop-edit'
                  ? placeOf(trip, editor.stop.placeId)
                  : undefined
              }
              nextOrder={stops.length + 1}
              nextSeq={nextSeq}
              onSave={saveStop}
              onCancel={() => setEditor(null)}
            />
          ) : (
            <button
              type="button"
              className="btn btn--primary itinerary-add-activity"
              onClick={() => setEditor({ type: 'stop-add' })}
            >
              <Plus size={18} aria-hidden />
              Adicionar parada
            </button>
          )}
        </div>
      </section>

      <DayInfo notes={notes} />
      <DayMap trip={trip} day={day} />
    </section>
  )
}
