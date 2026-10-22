function pad(n) {
  return String(n).padStart(2, '0')
}

/** BCB PTAX expects MM-DD-YYYY. */
function bcbDate(d) {
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${d.getUTCFullYear()}`
}

async function fetchComercial() {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 10)

  const url =
    'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/' +
    'CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)' +
    `?@dataInicial='${bcbDate(start)}'` +
    `&@dataFinalCotacao='${bcbDate(end)}'` +
    '&$top=1&$orderby=dataHoraCotacao%20desc&$format=json'

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  const row = data.value?.[0]
  if (!row?.cotacaoVenda) return null
  return {
    rate: row.cotacaoVenda,
    asOf: row.dataHoraCotacao,
    source: 'BCB PTAX',
  }
}

async function fetchWise() {
  const url =
    'https://wise.com/rates/history+live?source=USD&target=BRL&length=1&resolution=hourly&unit=day'
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || !data.length) return null
  const latest = data[data.length - 1]
  if (!latest?.value) return null
  return {
    rate: latest.value,
    asOf: new Date(latest.time).toISOString(),
    source: 'Wise',
  }
}

export default async function handler(_request, response) {
  try {
    const [comercial, wise] = await Promise.all([
      fetchComercial().catch(() => null),
      fetchWise().catch(() => null),
    ])
    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.status(200).json({
      comercial,
      wise,
      fetchedAt: new Date().toISOString(),
    })
  } catch {
    response.status(502).json({ error: 'fx_unavailable' })
  }
}
