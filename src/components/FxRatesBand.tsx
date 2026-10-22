import { useFxRates } from '../hooks/useFxRates'
import { formatFxAsOf, formatFxRate } from '../lib/fxRates'

export function FxRatesBand() {
  const { rates, error, loading } = useFxRates()

  const comercial = rates?.comercial
  const wise = rates?.wise
  const asOf = comercial?.asOf || wise?.asOf || rates?.fetchedAt

  return (
    <section className="band fx-rates" aria-live="polite">
      <div className="band__inner">
        <div className="fx-rates__head">
          <h2 className="section-title">Câmbio.</h2>
          {asOf ? (
            <p className="section-sub">Atualizado {formatFxAsOf(asOf)}</p>
          ) : null}
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
