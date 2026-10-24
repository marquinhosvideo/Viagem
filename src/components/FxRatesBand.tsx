import { RefreshCw } from 'lucide-react'
import { useFxRates } from '../hooks/useFxRates'
import { formatFxAsOf, formatFxRate } from '../lib/fxRates'

export function FxRatesBand() {
  const { rates, error, loading, refresh } = useFxRates()

  const comercial = rates?.comercial
  const wise = rates?.wise
  const asOf = comercial?.asOf || wise?.asOf || rates?.fetchedAt

  return (
    <section className="band fx-rates" aria-live="polite">
      <div className="band__inner">
        <div className="fx-rates__head">
          <h2 className="section-title">Câmbio.</h2>
          <div className="fx-rates__meta">
            {asOf ? (
              <p className="section-sub">Atualizado {formatFxAsOf(asOf)}</p>
            ) : null}
            <button
              type="button"
              className="fx-rates__sync"
              onClick={() => void refresh()}
              disabled={loading}
              aria-label="Sincronizar câmbio"
              title="Sincronizar"
            >
              <RefreshCw size={16} aria-hidden className={loading ? 'spin' : undefined} />
            </button>
          </div>
        </div>

        {loading && !rates ? (
          <p className="muted">Buscando cotações…</p>
        ) : error && !comercial && !wise ? (
          <p className="muted">Não foi possível carregar o câmbio agora.</p>
        ) : (
          <dl className="fx-rates__list">
            <div className="fx-rates__row">
              <dt>Dólar comercial</dt>
              <dd>{comercial ? formatFxRate(comercial.rate) : '—'}</dd>
            </div>
            <div className="fx-rates__row">
              <dt>Dólar Wise</dt>
              <dd>{wise ? formatFxRate(wise.rate) : '—'}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}
