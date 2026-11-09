import type { Day } from '../types'
import { stripEmoji } from '../lib/display'
import { formatShortDate } from '../lib/format'
import { fixedStops } from '../lib/places'

type Props = {
  days: Day[]
  selectedId: string
  onSelect: (id: string) => void
  includeAll?: boolean
  allLabel?: string
  allMeta?: string
  metaForDay?: (day: Day, index: number) => string
}

export function DayChips({
  days,
  selectedId,
  onSelect,
  includeAll = false,
  allLabel = 'Todos',
  allMeta,
  metaForDay,
}: Props) {
  return (
    <div className="day-chips" role="tablist" aria-label="Dias da viagem">
      {includeAll ? (
        <button
          type="button"
          role="tab"
          aria-selected={selectedId === 'all'}
          className={`option-chip ${selectedId === 'all' ? 'option-chip--selected' : ''}`}
          onClick={() => onSelect('all')}
        >
          <span className="option-chip__label">{allLabel}</span>
          {allMeta ? <span className="option-chip__meta">{allMeta}</span> : null}
        </button>
      ) : null}
      {days.map((day, index) => {
        const visit = fixedStops(day.stops)
        const done = visit.filter((stop) => stop.done).length
        const total = visit.length
        const selected = day.id === selectedId
        const firstLabel = stripEmoji(day.dayType.split('+')[0] || day.dayType)
        const meta =
          metaForDay?.(day, index) ?? `${firstLabel} · ${done}/${total}`
        return (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`option-chip ${selected ? 'option-chip--selected' : ''}`}
            onClick={() => onSelect(day.id)}
          >
            <span className="option-chip__label">
              D{index + 1} · {formatShortDate(day.date)}
            </span>
            <span className="option-chip__meta">{meta}</span>
          </button>
        )
      })}
    </div>
  )
}
