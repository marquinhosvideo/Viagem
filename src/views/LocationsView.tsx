import { useMemo, useState } from 'react'
import { Copy, MapPin, Navigation } from 'lucide-react'
import type { Trip } from '../types'
import { copyText } from '../lib/addresses'
import { formatShortDate } from '../lib/format'
import {
  groupTripLocations,
  type LocatedPlace,
  type PlaceDayRef,
} from '../lib/locations'

type Props = {
  trip: Trip
  onOpenDay: (dayId: string) => void
}

export function LocationsView({ trip, onOpenDay }: Props) {
  const groups = useMemo(() => groupTripLocations(trip), [trip])
  const [copied, setCopied] = useState<string | null>(null)
  const total = groups.reduce((sum, group) => sum + group.places.length, 0)

  async function handleCopy(key: string, text: string) {
    if (!(await copyText(text))) return
    setCopied(key)
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600)
  }

  return (
    <section className="view">
      <section className="band band--parchment band--hero">
        <div className="band__inner">
          <p className="eyebrow">Locais</p>
          <h1 className="display-lg">Todos os endereços.</h1>
          <p className="lede">
            {total
              ? `${total} locais do roteiro, em Alimentação, Lazer e Compras. Cada filial da mesma rede tem o próprio endereço.`
              : 'Nenhum endereço no roteiro ainda.'}
          </p>
        </div>
      </section>

      {groups.map((group) => (
        <section className="band locations-group" key={group.category}>
          <div className="band__inner">
            <div className="locations-group__head">
              <h2 className="section-title">{group.category}</h2>
              <span>{group.places.length}</span>
            </div>
            {group.subgroups.length > 0 ? (
              group.subgroups.map((subgroup) => (
                <div className="locations-subgroup" key={subgroup.category}>
                  <div className="locations-subgroup__head">
                    <h3>{subgroup.category}</h3>
                    <span>{subgroup.places.length}</span>
                  </div>
                  <LocationCards
                    places={subgroup.places}
                    copied={copied}
                    onCopy={handleCopy}
                    onOpenDay={onOpenDay}
                  />
                </div>
              ))
            ) : (
              <LocationCards
                places={group.places}
                copied={copied}
                onCopy={handleCopy}
                onOpenDay={onOpenDay}
              />
            )}
          </div>
        </section>
      ))}
    </section>
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
        const key = `${place.name}|${place.address}`
        const query = encodeURIComponent(
          place.address ? `${place.name}, ${place.address}` : place.name,
        )
        return (
          <li className="location-card" key={key}>
            <MapPin size={19} aria-hidden className="location-card__pin" />
            <div className="location-card__text">
              <h3>{place.name}</h3>
              {place.address ? <p>{place.address}</p> : null}
              {place.days.length ? (
                <div className="location-card__days">
                  {place.days.map((day) => (
                    <DayTag key={day.dayId} day={day} onOpen={onOpenDay} />
                  ))}
                </div>
              ) : null}
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
