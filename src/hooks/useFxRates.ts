import { useEffect, useState } from 'react'
import { loadFxRates, type FxRates } from '../lib/fxRates'

export function useFxRates() {
  const [rates, setRates] = useState<FxRates | null>(() => {
    try {
      const raw = sessionStorage.getItem('fx-rates-v1')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { savedAt: number; rates: FxRates }
      if (!parsed?.rates || Date.now() - parsed.savedAt > 5 * 60 * 1000) return null
      return parsed.rates
    } catch {
      return null
    }
  })
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(!rates)

  useEffect(() => {
    let cancelled = false
    void loadFxRates()
      .then((next) => {
        if (cancelled) return
        setRates(next)
        setError(false)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { rates, error, loading }
}
