import { useMemo, useState, type FormEvent } from 'react'
import { Copy, MapPin, Navigation, Plus } from 'lucide-react'
import type { Place, PlaceCategory, Trip } from '../types'
import { PLACE_CATEGORY_LABELS, PLACE_CATEGORY_ORDER } from '../types'
import { copyText } from '../lib/addresses'
import { formatShortDate, uid } from '../lib/format'
import {
  groupTripLocations,
  type LocatedPlace,
  type PlaceDayRef,
} from '../lib/locations'
import { hasAddress, normalizePlaceCategory } from '../lib/places'

type Props = {
  trip: Trip
  onOpenDay: (dayId: string) => void
  onChange: (trip: Trip) => void | Promise<void>
}

export function LocationsView({ trip, onOpenDay, onChange }: Props) {
  const groups = useMemo(() => groupTripLocations(trip), [trip])
  const [copied, setCopied] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const total = groups.reduce((sum, group) => sum + group.places.length, 0)

  async function handleCopy(key: string, text: string) {
    if (!(await copyText(text))) return
    setCopied(key)
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600)
  }

  function handleAddPlace(input: {
    name: string
    address?: string | null
    category: PlaceCategory
  }) {
    const name = input.name.trim().slice(0, 160)
    if (!name) return

    const existing = trip.places.find(
      (place) => place.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
    )
    if (existing) {
      window.alert(`Já existe um local chamado “${existing.name}”.`)
      return
    }

    const place: Place = {
      id: uid('loc'),
      name,
      address: input.address?.trim() || null,
      category: normalizePlaceCategory(input.category) ?? 'lazer',
      lat: null,
      lng: null,
    }

    void onChange({
      ...trip,
      places: [...trip.places, place].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    })
    setAdding(false)
  }

  return (
    <section className="view">
      <section className="band band--parchment band--hero">
        <div className="band__inner">
          <p className="eyebrow">Locais</p>
          <h1 className="display-lg">Todos os endereços.</h1>
          <p className="lede">
            {total
              ? `${total} locais únicos do roteiro, por categoria. O mesmo local pode aparecer em vários dias.`
              : 'Nenhum local no roteiro ainda.'}
          </p>
          {adding ? (
            <PlaceForm
              onSave={handleAddPlace}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              className="btn btn--primary locations-add-btn"
              onClick={() => setAdding(true)}
            >
              <Plus size={18} aria-hidden />
              Adicionar local
            </button>
          )}
        </div>
      </section>

      {groups.map((group) => (
        <section className="band locations-group" key={group.category}>
          <div className="band__inner">
            <div className="locations-group__head">
              <h2 className="section-title">{group.categoryLabel}</h2>
              <span>{group.places.length}</span>
            </div>
            <LocationCards
              places={group.places}
              copied={copied}
              onCopy={handleCopy}
              onOpenDay={onOpenDay}
            />
          </div>
        </section>
      ))}
    </section>
  )
}

function PlaceForm({
  onSave,
  onCancel,
}: {
  onSave: (input: {
    name: string
    address?: string | null
    category: PlaceCategory
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('compras')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    onSave({
      name: cleanName,
      address: address.trim() || null,
      category,
    })
  }

  return (
    <form className="itinerary-editor locations-add-form" onSubmit={handleSubmit}>
      <h3>Novo local.</h3>
      <div className="field">
        <label htmlFor="place-name">Nome</label>
        <input
          id="place-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Target Sand Lake"
          maxLength={160}
          required
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="place-address">Endereço</label>
        <input
          id="place-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Opcional — deixe vazio se ainda não souber"
          maxLength={300}
        />
      </div>
      <div className="field">
        <label htmlFor="place-category">Categoria</label>
        <select
          id="place-category"
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
      <div className="itinerary-editor__actions">
        <button type="button" className="btn btn--ghost-pill" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary">
          Salvar local
        </button>
      </div>
    </form>
  )
}

function LocationCards({
  places,
  copied,
  onCopy,
  onOpenDay,
}: {
  places: LocatedPlace[]
  copied: string | null
  onCopy: (key: string, text: string) => void
  onOpenDay: (dayId: string) => void
}) {
  return (
    <ul className="locations-list">
      {places.map((place) => {
        const key = place.id
        const query = encodeURIComponent(
          place.address ? `${place.name}, ${place.address}` : `${place.name}, Orlando, FL`,
        )
        return (
          <li className="location-card" key={key}>
            <MapPin size={19} aria-hidden className="location-card__pin" />
            <div className="location-card__text">
              <h3>{place.name}</h3>
              {place.address ? <p>{place.address}</p> : <p className="muted">Endereço a completar</p>}
              {place.days.length ? (
                <div className="location-card__days">
                  {place.days.map((day) => (
                    <DayTag key={day.dayId} day={day} onOpen={onOpenDay} />
                  ))}
                </div>
              ) : (
                <p className="location-card__orphan muted">Ainda sem parada no roteiro</p>
              )}
            </div>
            <div className="location-card__actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  onCopy(
                    key,
                    place.address ? `${place.name} – ${place.address}` : place.name,
                  )
                }
                aria-label={`Copiar endereço de ${place.name}`}
                title="Copiar endereço"
              >
                <Copy size={18} aria-hidden />
              </button>
              {hasAddress(place) ? (
                <a
                  className="icon-btn"
                  href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${place.name} no mapa`}
                  title="Abrir no mapa"
                >
                  <Navigation size={18} aria-hidden />
                </a>
              ) : null}
            </div>
            {copied === key ? (
              <span className="location-card__copied" role="status">
                Copiado
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function DayTag({
  day,
  onOpen,
}: {
  day: PlaceDayRef
  onOpen: (dayId: string) => void
}) {
  const label = `D${day.index} · ${formatShortDate(day.date)}`
  return (
    <button
      type="button"
      className="location-day-tag"
      onClick={() => onOpen(day.dayId)}
      aria-label={`Abrir ${label} no roteiro`}
      title={`Abrir ${label} no roteiro`}
    >
      {label}
    </button>
  )
}
