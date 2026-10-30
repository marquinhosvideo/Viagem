import { useState, type FormEvent } from 'react'
import type { Activity, Day } from '../types'
import { parseDayMeta, replaceDayPlaces } from '../lib/dayMeta'

function notesOnlyText(dayNotes?: string): string {
  return parseDayMeta(dayNotes)
    .notes.map((note) => {
      if (note.label === 'Deslocamento') return `🚗 ${note.text}`
      if (note.label === 'Com a criança') return `👶 ${note.text}`
      if (note.label === 'Onde') return `📍 ${note.text}`
      return `📝 ${note.text}`
    })
    .join('\n\n')
}

type DayFormProps = {
  day?: Day
  onSave: (input: { date: string; label: string; dayNotes?: string }) => void
  onCancel: () => void
}

export function DayForm({ day, onSave, onCancel }: DayFormProps) {
  const [date, setDate] = useState(day?.date ?? '')
  const [label, setLabel] = useState(day?.label ?? '')
  const [dayNotes, setDayNotes] = useState(notesOnlyText(day?.dayNotes))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanLabel = label.trim()
    if (!date || !cleanLabel) return
    const places = parseDayMeta(day?.dayNotes).places
    const merged = replaceDayPlaces(dayNotes.trim().slice(0, 10_000) || undefined, places)
    onSave({
      date,
      label: cleanLabel.slice(0, 200),
      dayNotes: merged,
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
          <label htmlFor="day-label">Título do dia</label>
          <input
            id="day-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Parque + compras"
            maxLength={200}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="day-notes">Observações do dia</label>
        <textarea
          id="day-notes"
          value={dayNotes}
          onChange={(event) => setDayNotes(event.target.value)}
          placeholder={'🚗 Deslocamento\n\n📝 Observações'}
          maxLength={10_000}
          rows={5}
        />
      </div>
      <EditorActions onCancel={onCancel} />
    </form>
  )
}

type ActivityFormProps = {
  activity?: Activity
  onSave: (input: {
    time?: string
    title: string
    location?: string
    notes?: string
  }) => void
  onCancel: () => void
}

export function ActivityForm({ activity, onSave, onCancel }: ActivityFormProps) {
  const [time, setTime] = useState(activity?.time ?? '')
  const [title, setTitle] = useState(activity?.title ?? '')
  const [location, setLocation] = useState(activity?.location ?? '')
  const [notes, setNotes] = useState(activity?.notes ?? '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    onSave({
      time: time || undefined,
      title: cleanTitle.slice(0, 1000),
      location: location.trim().slice(0, 500) || undefined,
      notes: notes.trim().slice(0, 10_000) || undefined,
    })
  }

  return (
    <form className="itinerary-editor" onSubmit={handleSubmit}>
      <h3>{activity ? 'Editar evento.' : 'Adicionar evento.'}</h3>
      <div className="field">
        <label htmlFor="activity-time">Horário (opcional)</label>
        <input
          id="activity-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="activity-title">Evento</label>
        <input
          id="activity-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nome do evento"
          maxLength={1000}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="activity-location">Local ou endereço</label>
        <input
          id="activity-location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Nome – endereço"
          maxLength={500}
        />
      </div>
      <div className="field">
        <label htmlFor="activity-notes">Detalhes</label>
        <textarea
          id="activity-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Informações úteis"
          maxLength={10_000}
          rows={4}
        />
      </div>
      <EditorActions onCancel={onCancel} />
    </form>
  )
}

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
