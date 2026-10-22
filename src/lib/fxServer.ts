export type FxQuote = {
  rate: number
  asOf: string
  source: string
}

export type FxRates = {
  comercial: FxQuote | null
  wise: FxQuote | null
  fetchedAt: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** BCB PTAX expects MM-DD-YYYY. */
function bcbDate(d: Date): string {
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${d.getUTCFullYear()}`
}

async function fetchComercial(): Promise<FxQuote | null> {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 10)

  const url =
    'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/' +
    `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${bcbDate(start)}'` +
    `&@dataFinalCotacao='${bcbDate(end)}'` +
    `&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = (await res.json()) as {
    value?: Array<{ cotacaoVenda: number; dataHoraCotacao: string }>
  }
  const row = data.value?.[0]
  if (!row?.cotacaoVenda) return null
  return {
    rate: row.cotacaoVenda,
    asOf: row.dataHoraCotacao,
    source: 'BCB PTAX',
  }
}

async function fetchWise(): Promise<FxQuote | null> {
  const url =
    'https://wise.com/rates/history+live?source=USD&target=BRL&length=1&resolution=hourly&unit=day'
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{ value: number; time: number }>
  if (!Array.isArray(data) || !data.length) return null
  const latest = data[data.length - 1]
  if (!latest?.value) return null
  return {
    rate: latest.value,
    asOf: new Date(latest.time).toISOString(),
    source: 'Wise',
  }
}

export async function getFxRates(): Promise<FxRates> {
  const [comercial, wise] = await Promise.all([
    fetchComercial().catch(() => null),
    fetchWise().catch(() => null),
  ])
  return {
    comercial,
    wise,
    fetchedAt: new Date().toISOString(),
  }
}
