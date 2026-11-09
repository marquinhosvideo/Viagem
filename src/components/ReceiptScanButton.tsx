import { useRef, useState } from 'react'
import { Camera, LoaderCircle, Trash2 } from 'lucide-react'
import type { BudgetId, Day } from '../types'
import { BUDGET_LABELS, BUDGET_ORDER } from '../types'
import { usdToBrl, USD_BRL_RATE } from '../lib/currency'
import { formatMoney, formatShortDate } from '../lib/format'
import { scanReceiptImage, type ReceiptItemDraft } from '../lib/receiptOcr'
import { MoneyPair } from './MoneyPair'

type DraftRow = ReceiptItemDraft & { budgetId: BudgetId; keep: boolean }

type Props = {
  days: Day[]
  defaultDayId: string
  currency: string
  onConfirm: (
    items: Array<{
      dayId: string
      budgetId: BudgetId
      description: string
      amount: number
    }>,
  ) => void | Promise<void>
}

export function ReceiptScanButton({
  days,
  defaultDayId,
  onConfirm,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dayId, setDayId] = useState(defaultDayId)
  const [rows, setRows] = useState<DraftRow[]>([])

  function reset() {
    setOpen(false)
    setBusy(false)
    setProgress(0)
    setError(null)
    setRows([])
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setOpen(true)
    setBusy(true)
    setError(null)
    setProgress(0)
    setRows([])
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))

    try {
      const { items } = await scanReceiptImage(file, setProgress)
      if (!items.length) {
        setError(
          'Não encontrei itens com valor na foto. Tente outra foto, mais nítida e de perto.',
        )
      }
      setRows(
        items.map((item) => ({
          ...item,
          budgetId: 'alimentacao' as BudgetId,
          keep: true,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler a nota.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    const selected = rows.filter((r) => r.keep && r.amount > 0 && r.description.trim())
    if (!selected.length) {
      setError('Marque pelo menos um item para lançar.')
      return
    }
    setBusy(true)
    try {
      await onConfirm(
        selected.map((r) => ({
          dayId,
          budgetId: r.budgetId,
          description: r.description.trim(),
          // OCR / edição da nota são em USD → grava em BRL
          amount: usdToBrl(r.amount),
        })),
      )
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar gastos.')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <>
        <button
          type="button"
          className="btn btn--ghost-pill"
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={18} />
          Escanear recibo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </>
    )
  }

  return (
    <div className="receipt-scan">
      <div className="receipt-scan__head">
        <h3>Nota fiscal</h3>
        <button type="button" className="btn btn--ghost" onClick={reset}>
          Fechar
        </button>
      </div>

      {preview ? (
        <img src={preview} alt="Nota fiscal" className="receipt-scan__preview" />
      ) : null}

      {busy && !rows.length ? (
        <p className="receipt-scan__progress">
          <LoaderCircle size={16} className="spin" />
          Lendo a nota… {progress}%
        </p>
      ) : null}

      {error ? <p className="status status--err">{error}</p> : null}

      {rows.length > 0 ? (
        <>
          <div className="field">
            <label htmlFor="ocr-day">Dia do gasto</label>
            <select id="ocr-day" value={dayId} onChange={(e) => setDayId(e.target.value)}>
              {days.map((day, i) => (
                <option key={day.id} value={day.id}>
                  D{i + 1} · {formatShortDate(day.date)} · {day.dayType}
                </option>
              ))}
            </select>
          </div>

          <p className="muted">
            Valores da nota em US$ · conversão R${' '}
            {USD_BRL_RATE.toFixed(2).replace('.', ',')}/US$. Confira os itens e a
            classificação antes de lançar.
          </p>

          <ul className="receipt-scan__rows">
            {rows.map((row, index) => (
              <li key={row.id} className={`receipt-row ${row.keep ? '' : 'receipt-row--off'}`}>
                <div className="receipt-row__top">
                  <label className="receipt-row__keep">
                    <input
                      type="checkbox"
                      checked={row.keep}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === index ? { ...r, keep: e.target.checked } : r,
                          ),
                        )
                      }
                    />
                    Usar
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Remover item"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="field">
                  <label>Descrição</label>
                  <input
                    value={row.description}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, description: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </div>

                <div className="receipt-row__grid">
                  <div className="field">
                    <label>Valor (US$)</label>
                    <input
                      inputMode="decimal"
                      value={String(row.amount).replace('.', ',')}
                      onChange={(e) => {
                        const amount = Number(e.target.value.replace(',', '.'))
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === index
                              ? { ...r, amount: Number.isFinite(amount) ? amount : 0 }
                              : r,
                          ),
                        )
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>Classificação</label>
                    <select
                      value={row.budgetId}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === index
                              ? { ...r, budgetId: e.target.value as BudgetId }
                              : r,
                          ),
                        )
                      }
                    >
                      {BUDGET_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {BUDGET_LABELS[id]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="receipt-row__amount">
                  {row.amount > 0 ? (
                    <MoneyPair amountBrl={usdToBrl(row.amount)} />
                  ) : (
                    formatMoney(0, 'USD')
                  )}
                </p>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? 'Salvando…' : `Lançar ${rows.filter((r) => r.keep).length} itens`}
          </button>
        </>
      ) : null}

      {!busy ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={18} />
          Tirar outra foto
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
