import { useState, type FormEvent } from 'react'
import type { BudgetId, Day } from '../types'
import { BUDGET_LABELS, BUDGET_ORDER } from '../types'
import { stripEmoji } from '../lib/display'
import { usdToBrl, USD_BRL_RATE } from '../lib/currency'
import { formatMoney, formatShortDate, parseAmount } from '../lib/format'

type Props = {
  days: Day[]
  defaultDayId: string
  currency: string
  onSubmit: (data: {
    dayId: string
    budgetId: BudgetId
    description: string
    amount: number
  }) => void
}

export function ExpenseForm({ days, defaultDayId, onSubmit }: Props) {
  const [dayId, setDayId] = useState(defaultDayId)
  const [budgetId, setBudgetId] = useState<BudgetId>('marcos')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [open, setOpen] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const usd = parseAmount(amount)
    const cleanDescription = description.trim()
    if (!cleanDescription || usd <= 0 || usdToBrl(usd) > 1_000_000) return
    onSubmit({ dayId, budgetId, description: cleanDescription, amount: usdToBrl(usd) })
    setDescription('')
    setAmount('')
    setOpen(false)
  }

  const usdPreview = parseAmount(amount)
  const brlPreview = usdPreview > 0 ? usdToBrl(usdPreview) : 0

  if (!open) {
    return (
      <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
        Registrar gasto
      </button>
    )
  }

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      <h3 className="expense-form__title">Novo gasto.</h3>

      <div className="field">
        <label htmlFor="exp-day">Dia</label>
        <select id="exp-day" value={dayId} onChange={(e) => setDayId(e.target.value)}>
          {days.map((day, i) => (
            <option key={day.id} value={day.id}>
              D{i + 1} · {formatShortDate(day.date)} · {stripEmoji(day.dayType)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="field__label">Orçamento</span>
        <div className="chip-picks">
          {BUDGET_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`option-chip option-chip--compact ${budgetId === id ? 'option-chip--selected' : ''}`}
              onClick={() => setBudgetId(id)}
            >
              <span className="option-chip__label">{BUDGET_LABELS[id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="exp-desc">Descrição</label>
        <input
          id="exp-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Almoço, ingressos, Uber"
          maxLength={500}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="exp-amount">Valor (US$)</label>
        <input
          id="exp-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
        <p className="field__hint">
          Convertido a R$ {USD_BRL_RATE.toFixed(2).replace('.', ',')}/US$
          {brlPreview > 0 ? ` → ${formatMoney(brlPreview, 'BRL')}` : ''}
        </p>
      </div>

      <div className="expense-form__actions">
        <button type="button" className="btn btn--ghost-pill" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary">
          Salvar
        </button>
      </div>
    </form>
  )
}
