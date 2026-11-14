import { useMemo } from 'react'
import type { Day, Trip } from '../types'
import { dayRouteDistance, formatDayKm } from '../lib/dayMap'
import { dayTitleParts } from '../lib/display'
import { formatDayLabel } from '../lib/format'
import { fixedStops } from '../lib/places'

type Props = {
  trip: Trip
  day: Day
  dayIndex: number
  dayCount: number
}

export function DayHero({ trip, day, dayIndex, dayCount }: Props) {
  const visitStops = fixedStops(day.stops)
  const done = visitStops.filter((stop) => stop.done).length
  const total = visitStops.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const tags = dayTitleParts(day.dayType)
  const title = tags.map((t) => t.text).join(' + ')
  const route = useMemo(() => dayRouteDistance(trip, day), [trip, day])
  const kmLabel = formatDayKm(route.km)

  return (
    <section className="day-hero">
      <div className="day-hero__body">
        <p className="day-hero__eyebrow">
          {formatDayLabel(day.date)}
          {day.weekday ? ` · ${day.weekday}` : ''}
        </p>
        <h1 className="day-hero__title">{title}</h1>
        <div className="day-hero__tags">
          {tags.map((tag) => {
            const Icon = tag.icon
            return (
              <span key={tag.text} className="day-hero__tag">
                <Icon size={16} aria-hidden />
                {tag.text}
              </span>
            )
          })}
        </div>
        <div className="day-hero__progress-row">
          <div>
            <p className="day-hero__pct">{pct}%</p>
            <p className="day-hero__progress-label">
              {done} de {total} paradas concluídas
              {day.stops.length > total
                ? ` · ${day.stops.length - total} opcionais`
                : ''}
              .
            </p>
          </div>
          <div className="day-hero__side">
            <p className="day-hero__km" title="Distância estimada na ordem das paradas">
              {kmLabel}
            </p>
            <p className="day-hero__index">
              Dia {dayIndex + 1} de {dayCount}
            </p>
          </div>
        </div>
        <div className="day-hero__track" aria-hidden>
          <div className="day-hero__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  )
}
