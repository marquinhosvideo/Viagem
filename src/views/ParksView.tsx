import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, FerrisWheel, RefreshCw } from 'lucide-react'
import type { Trip } from '../types'
import { formatShortDate } from '../lib/format'
import {
  fetchRideWaits,
  latestUpdate,
  officialRideUrl,
  parksInTrip,
  type PlanPark,
  type RideSnapshot,
  type RideWait,
} from '../lib/queueTimes'
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
              ? `${selected.name}, com as atrações ordenadas pelo tempo de espera.`
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
  const [source, setSource] = useState<RideSnapshot['source'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const lastGood = useRef<RideSnapshot | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const fresh = reloadKey > 0
    fetchRideWaits(park.id, { signal: controller.signal, fresh })
      .then((snapshot) => {
        if (controller.signal.aborted) return
        if (snapshot.rides.length) {
          lastGood.current = snapshot
          setRides(snapshot.rides)
          setSource(snapshot.source)
          setNotice(null)
          setError(null)
        } else if (lastGood.current) {
          setRides(lastGood.current.rides)
          setSource(lastGood.current.source)
          setNotice('A consulta voltou vazia. Mostrando a última lista.')
          setError(null)
        } else {
          setRides([])
          setSource(snapshot.source)
          setNotice(null)
          setError(null)
        }
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || (cause instanceof Error && cause.name === 'AbortError')) {
          return
        }
        if (lastGood.current) {
          setRides(lastGood.current.rides)
          setSource(lastGood.current.source)
          setNotice('Não atualizou agora. Mostrando a última consulta.')
          setError(null)
        } else {
          setError('Não foi possível consultar as filas agora.')
        }
        setLoading(false)
      })
    return () => controller.abort()
  }, [park.id, reloadKey])

  const openCount = rides?.filter((ride) => ride.isOpen).length ?? 0
  const updated = rides ? latestUpdate(rides) : null

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
              setNotice(null)
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
          {rides ? ` · ${openCount} abertas` : ''}
        </p>

        {loading && !rides ? <p className="empty-hint">Buscando filas…</p> : null}
        {error ? (
          <p className="empty-hint" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="park-notice" role="status">
            {notice}
          </p>
        ) : null}
        {source === 'themeparks' && rides?.length ? (
          <p className="park-notice">
            Os tempos desta lista vieram do{' '}
            <a href="https://themeparks.wiki/" target="_blank" rel="noopener noreferrer">
              ThemeParks.wiki
            </a>
            .
          </p>
        ) : null}
        {rides && !rides.length ? (
          <p className="empty-hint">Nenhuma atração encontrada neste parque.</p>
        ) : null}
        {rides?.length ? (
          <ul className="ride-list">
            {rides.map((ride) => (
              <li className="ride-row" key={ride.id}>
                <div className="ride-row__text">
                  <h3>
                    <a
                      className="ride-row__link"
                      href={officialRideUrl(park, ride.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ride.name}
                    </a>
                  </h3>
                  {ride.land ? <p>{ride.land}</p> : null}
                </div>
                <span className={ride.isOpen ? 'ride-wait' : 'ride-wait ride-wait--closed'}>
                  {ride.isOpen ? waitLabel(ride.waitTime) : 'Fechada'}
                </span>
              </li>
            ))}
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
