import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, FerrisWheel, RefreshCw, Star } from 'lucide-react'
import type { Trip } from '../types'
import { formatShortDate } from '../lib/format'
import {
  fetchRideWaits,
  latestUpdate,
  parksInTrip,
  sortRidesByWait,
  type PlanPark,
  type RideWait,
} from '../lib/queueTimes'
import {
  ensureDefaultFavorites,
  loadFavoriteRideIds,
  toggleFavoriteRideId,
} from '../lib/rideFavorites'
import { sampleTrip } from '../data/sampleTrip'

type Props = {
  trip: Trip
}

const QUEUE_CREDIT = 'https://queue-times.com/'

export function ParksView({ trip }: Props) {
  const parks = useMemo(
    () =>
      parksInTrip({
        ...trip,
        locations: trip.locations?.length ? trip.locations : sampleTrip.locations,
      }),
    [trip],
  )
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = parks.find((park) => park.id === selectedId) ?? null

  return (
    <section className="view">
      <section className="band band--parchment band--hero">
        <div className="band__inner">
          <p className="eyebrow">Parques</p>
          <h1 className="display-lg">Filas agora.</h1>
          <p className="lede">
            {selected
              ? `${selected.name}: favoritos no topo, depois a menor fila.`
              : parks.length
                ? `${parks.length} parques do planejamento, com a fila ao vivo.`
                : 'Nenhum parque do planejamento tem fila ao vivo.'}
          </p>
          <p className="park-credit">
            <a href={QUEUE_CREDIT} target="_blank" rel="noopener noreferrer">
              Powered by Queue-Times.com
            </a>
          </p>
        </div>
      </section>

      {selected ? (
        <ParkWaits key={selected.id} park={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <section className="band">
          <div className="band__inner">
            <ul className="park-list">
              {parks.map((park) => (
                <li key={park.id}>
                  <button
                    type="button"
                    className="park-card"
                    onClick={() => setSelectedId(park.id)}
                  >
                    <FerrisWheel size={19} aria-hidden className="park-card__icon" />
                    <span className="park-card__text">
                      <span className="park-card__name">{park.name}</span>
                      <span className="park-card__meta">{parkMeta(park)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </section>
  )
}

function parkMeta(park: PlanPark): string {
  if (!park.dates.length) return `${park.operator} · no planejamento`
  const dates = park.dates.map((date) => formatShortDate(date)).join(' · ')
  return `${park.operator} · ${dates}`
}

function ParkWaits({ park, onBack }: { park: PlanPark; onBack: () => void }) {
  const [rides, setRides] = useState<RideWait[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [favoriteIds, setFavoriteIds] = useState(() => loadFavoriteRideIds())

  useEffect(() => {
    const controller = new AbortController()
    fetchRideWaits(park.id, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setFavoriteIds(ensureDefaultFavorites(next))
        setRides(next)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || (cause instanceof Error && cause.name === 'AbortError')) {
          return
        }
        setRides(null)
        setError('Não foi possível consultar as filas agora.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [park.id, reloadKey])

  const sortedRides = useMemo(
    () => (rides ? sortRidesByWait(rides, favoriteIds) : null),
    [rides, favoriteIds],
  )
  const openCount = sortedRides?.filter((ride) => ride.isOpen).length ?? 0
  const updated = sortedRides ? latestUpdate(sortedRides) : null

  function toggleFavorite(ride: RideWait) {
    setFavoriteIds(toggleFavoriteRideId(ride.id, ride.name))
  }

  return (
    <section className="band">
      <div className="band__inner">
        <div className="park-detail__bar">
          <button type="button" className="park-back" onClick={onBack}>
            <ChevronLeft size={18} aria-hidden />
            Parques
          </button>
          <button
            type="button"
            className="park-refresh"
            onClick={() => {
              setLoading(true)
              setError(null)
              setReloadKey((key) => key + 1)
            }}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden className={loading ? 'spin' : undefined} />
            Atualizar
          </button>
        </div>
        <h2 className="section-title">{park.name}</h2>
        <p className="park-detail__meta">
          {parkMeta(park)}
          {updated ? ` · atualizado ${formatOrlandoTime(updated)}` : ''}
          {sortedRides ? ` · ${openCount} abertas` : ''}
        </p>

        {loading && !sortedRides ? <p className="empty-hint">Buscando filas…</p> : null}
        {error ? (
          <p className="empty-hint" role="alert">
            {error}
          </p>
        ) : null}
        {sortedRides && !sortedRides.length ? (
          <p className="empty-hint">Nenhuma atração encontrada neste parque.</p>
        ) : null}
        {sortedRides?.length ? (
          <ul className="ride-list">
            {sortedRides.map((ride) => {
              const favorited = favoriteIds.has(ride.id)
              return (
                <li className="ride-row" key={ride.id}>
                  <button
                    type="button"
                    className={`ride-fav${favorited ? ' ride-fav--on' : ''}`}
                    onClick={() => toggleFavorite(ride)}
                    aria-label={
                      favorited
                        ? `Remover ${ride.name} dos favoritos`
                        : `Favoritar ${ride.name}`
                    }
                    aria-pressed={favorited}
                    title={favorited ? 'Remover dos favoritos' : 'Favoritar'}
                  >
                    <Star size={18} aria-hidden fill={favorited ? 'currentColor' : 'none'} />
                  </button>
                  <div className="ride-row__text">
                    <h3>{ride.name}</h3>
                    {ride.land ? <p>{ride.land}</p> : null}
                  </div>
                  <span className={ride.isOpen ? 'ride-wait' : 'ride-wait ride-wait--closed'}>
                    {ride.isOpen ? waitLabel(ride.waitTime) : 'Fechada'}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

function waitLabel(minutes: number): string {
  if (minutes <= 0) return 'Sem fila'
  return `${minutes} min`
}

function formatOrlandoTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(date)
}
