import { useState, type FormEvent } from 'react'
import type { Day, Place, PlaceCategory, Stop, StopStatus, Trip } from '../types'
import { PLACE_CATEGORY_LABELS, PLACE_CATEGORY_ORDER } from '../types'
import { normalizePlaceCategory, normalizeStopStatus } from '../lib/places'

type DayFormProps = {
  day?: Day
  onSave: (input: {
    date: string
    dayType: string
    weekday?: string
    driveFromHotel?: string | null
    kidNotes?: string | null
    notes?: string | null
  }) => void
  onCancel: () => void
}

export function DayForm({ day, onSave, onCancel }: DayFormProps) {
  const [date, setDate] = useState(day?.date ?? '')
  const [dayType, setDayType] = useState(day?.dayType ?? '')
  const [driveFromHotel, setDriveFromHotel] = useState(day?.driveFromHotel ?? '')
  const [kidNotes, setKidNotes] = useState(day?.kidNotes ?? '')
  const [notes, setNotes] = useState(day?.notes ?? '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanType = dayType.trim()
    if (!date || !cleanType) return
    onSave({
      date,
      dayType: cleanType.slice(0, 200),
      weekday: day?.weekday,
      driveFromHotel: driveFromHotel.trim() || null,
      kidNotes: kidNotes.trim() || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <form className="itinerary-editor" onSubmit={handleSubmit}>
      <h3>{day ? 'Editar dia.' : 'Adicionar dia.'}</h3>
      <div className="itinerary-editor__grid">
        <div className="field">
          <label htmlFor="day-date">Data</label>
          <input
            id="day-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="day-type">Tipo do dia</label>
          <input
            id="day-type"
            value={dayType}
            onChange={(event) => setDayType(event.target.value)}
            placeholder="Parque + compras"
            maxLength={200}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="day-drive">Carro a partir do hotel</label>
        <textarea
          id="day-drive"
          value={driveFromHotel}
          onChange={(event) => setDriveFromHotel(event.target.value)}
          maxLength={10_000}
          rows={2}
        />
      </div>
      <div className="field">
        <label htmlFor="day-kid">Criança</label>
        <textarea
          id="day-kid"
          value={kidNotes}
          onChange={(event) => setKidNotes(event.target.value)}
          maxLength={10_000}
          rows={2}
        />
      </div>
      <div className="field">
        <label htmlFor="day-notes">Observações / horários</label>
        <textarea
          id="day-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={10_000}
          rows={3}
        />
      </div>
      <EditorActions onCancel={onCancel} />
    </form>
  )
}

type StopFormProps = {
  trip: Trip
  stop?: Stop
  place?: Place
  nextOrder: number
  nextSeq: number
  onSave: (input: {
    placeName: string
    address?: string | null
    category: PlaceCategory
    status: StopStatus
    note?: string | null
    orderInDay: number
  }) => void
  onCancel: () => void
}

export function StopForm({
  trip,
  stop,
  place,
  nextOrder,
  nextSeq: _nextSeq,
  onSave,
  onCancel,
}: StopFormProps) {
  void _nextSeq
  const [placeName, setPlaceName] = useState(place?.name ?? '')
  const [address, setAddress] = useState(place?.address ?? '')
  const [category, setCategory] = useState<PlaceCategory>(place?.category ?? 'lazer')
  const [status, setStatus] = useState<StopStatus>(stop?.status ?? 'fixo')
  const [note, setNote] = useState(stop?.note ?? '')
  const [orderInDay, setOrderInDay] = useState(stop?.orderInDay ?? nextOrder)

  function handlePlacePick(name: string) {
    setPlaceName(name)
    const existing = trip.places.find(
      (item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
    )
    if (!existing) return
    setAddress(existing.address ?? '')
    setCategory(existing.category)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanName = placeName.trim()
    if (!cleanName) return
    onSave({
      placeName: cleanName.slice(0, 160),
      address: address.trim() || null,
      category: normalizePlaceCategory(category) ?? 'lazer',
      status: normalizeStopStatus(status),
      note: note.trim() || null,
      orderInDay: Math.max(1, Number(orderInDay) || nextOrder),
    })
  }

  return (
    <form className="itinerary-editor" onSubmit={handleSubmit}>
      <h3>{stop ? 'Editar parada.' : 'Adicionar parada.'}</h3>
      <div className="itinerary-editor__grid">
        <div className="field">
          <label htmlFor="stop-order">Ordem no dia</label>
          <input
            id="stop-order"
            type="number"
            min={1}
            value={orderInDay}
            onChange={(event) => setOrderInDay(Number(event.target.value))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="stop-status">Status</label>
          <select
            id="stop-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StopStatus)}
          >
            <option value="fixo">Fixo</option>
            <option value="opcional">Opcional</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="stop-place">Local</label>
        <input
          id="stop-place"
          list="trip-places"
          value={placeName}
          onChange={(event) => handlePlacePick(event.target.value)}
          placeholder="Nome do local"
          maxLength={160}
          required
        />
        <datalist id="trip-places">
          {trip.places.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </div>
      <div className="field">
        <label htmlFor="stop-address">Endereço</label>
        <input
          id="stop-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Opcional — deixe vazio se ainda não souber"
          maxLength={300}
        />
      </div>
      <div className="field">
        <label htmlFor="stop-category">Categoria</label>
        <select
          id="stop-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as PlaceCategory)}
        >
          {PLACE_CATEGORY_ORDER.map((value) => (
            <option key={value} value={value}>
              {PLACE_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="stop-note">Observação</label>
        <textarea
          id="stop-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={10_000}
          rows={3}
        />
      </div>
      <EditorActions onCancel={onCancel} />
    </form>
  )
}

/** @deprecated use StopForm */
export const ActivityForm = StopForm

function EditorActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="itinerary-editor__actions">
      <button type="button" className="btn btn--ghost-pill" onClick={onCancel}>
        Cancelar
      </button>
      <button type="submit" className="btn btn--primary">
        Salvar
      </button>
    </div>
  )
}
