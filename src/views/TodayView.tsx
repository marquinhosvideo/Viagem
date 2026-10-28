import { useMemo } from 'react'
import type { Day, Trip } from '../types'
import { ActivityItem } from '../components/ActivityItem'
import { AddressCopyList } from '../components/AddressCopyList'
import { DayMap } from '../components/DayMap'
import { BudgetWidgets } from '../components/BudgetWidgets'
import { DayHero } from '../components/DayHero'
import { DayInfo } from '../components/DayInfo'
import { FxRatesBand } from '../components/FxRatesBand'
import { parseDayMeta } from '../lib/dayMeta'
import { formatMoneyPair } from '../lib/format'
import { spentByBudget } from '../lib/budgets'
import { BUDGET_LABELS, BUDGET_ORDER } from '../types'
import { MoneyPair } from '../components/MoneyPair'

type Props = {
  trip: Trip
  day: Day
  onToggle: (dayId: string, activityId: string) => void
}

export function TodayView({ trip, day, onToggle }: Props) {
  const dayIndex = Math.max(
    0,
    trip.days.findIndex((d) => d.id === day.id),
  )
  const dayExpenses = trip.expenses.filter((e) => e.dayId === day.id)
  const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
  const byBudget = spentByBudget(dayExpenses)
  const { notes, places } = useMemo(() => parseDayMeta(day.dayNotes), [day.dayNotes])

  return (
    <section className="view today-view">
      <DayHero day={day} dayIndex={dayIndex} dayCount={trip.days.length} />

      <FxRatesBand />

      <BudgetWidgets trip={trip} />

      <section className="band">
        <div className="band__inner">
          <p className="eyebrow">Gasto do dia</p>
          <p className="display-lg">
            <MoneyPair amountBrl={dayTotal} layout="stack" className="money-pair--hero" />
          </p>
          <div className="spend-pills">
            {BUDGET_ORDER.filter((id) => byBudget[id] > 0).map((id) => (
              <span key={id} className="hairline-pill">
                {BUDGET_LABELS[id]} {formatMoneyPair(byBudget[id])}
              </span>
            ))}
            {!dayExpenses.length ? (
              <span className="muted">Sem gastos ainda.</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="band__inner">
          <h2 className="section-title">Programação.</h2>
          <div className="activity-stack">
            {day.activities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                onToggle={() => onToggle(day.id, activity.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <DayInfo notes={notes} />
      <DayMap trip={trip} day={day} />
      <AddressCopyList places={places} />
    </section>
  )
}
