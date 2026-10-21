const WIKI_PARK_IDS = {
  5: '47f90d2c-e191-4239-a466-5892ef59a88b',
  6: '75ea578a-adc8-4116-a54d-dccb60765ef9',
  7: '288747d1-8b4f-4a64-867e-ea7c9b27bad8',
  8: '1c84a229-8862-4648-9c71-378ddd2c7693',
  21: '27d64dee-d85e-48dc-ad6d-8077445cd946',
  64: '267615cc-8943-4c2a-ae2c-5da728ca591f',
  65: 'eb3f4560-2383-4a36-9152-6b3e5ed6bc57',
  67: 'fe78a026-b91b-470c-b906-9d2266b692da',
  94: '9e2867f8-68eb-454f-b367-0ed0fd72d72a',
  280: 'bb285952-7e52-4a07-a312-d0a1ed91a9ac',
  316: '90d49146-8ae8-4f74-b2e6-2c91f3be6067',
  334: '12dbb85b-265f-44e6-bccf-f1faa17211fc',
}

function rideCount(payload) {
  const fromLands = (payload?.lands ?? []).reduce(
    (sum, land) => sum + (land.rides?.length ?? 0),
    0,
  )
  return fromLands + (payload?.rides?.length ?? 0)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJson(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'application/json',
        'user-agent': 'RoteiroOrlando/1.0',
      },
    })
    if (!response.ok) throw new Error(`status ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fromQueueTimes(id) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await readJson(
        `https://queue-times.com/parks/${id}/queue_times.json`,
        4000,
      )
      if (rideCount(data) > 0) return data
      lastError = new Error('empty')
    } catch (error) {
      lastError = error
    }
    if (attempt === 0) await delay(200)
  }
  throw lastError instanceof Error ? lastError : new Error('queue-times')
}

function fromWikiLive(data) {
  const rides = (data?.liveData ?? [])
    .filter((item) => item.entityType === 'ATTRACTION' || item.entityType === 'SHOW')
    .map((item) => {
      const wait = item.queue?.STANDBY?.waitTime
      return {
        id: item.id,
        name: item.name,
        is_open: item.status === 'OPERATING',
        wait_time: Number.isFinite(wait) ? wait : 0,
        last_updated: item.lastUpdated ?? '',
      }
    })
  return { lands: [{ name: '', rides }], rides: [] }
}

async function fromThemeParks(id) {
  const wikiId = WIKI_PARK_IDS[id]
  if (!wikiId) throw new Error('sem fallback')
  const data = await readJson(`https://api.themeparks.wiki/v1/entity/${wikiId}/live`, 4500)
  const payload = fromWikiLive(data)
  if (!rideCount(payload)) throw new Error('empty fallback')
  return payload
}

function settle(promise) {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  )
}

function hasRides(result) {
  return Boolean(result?.ok && rideCount(result.value.payload) > 0)
}

export async function loadParkQueues(id) {
  const queue = settle(
    fromQueueTimes(id).then((payload) => ({ source: 'queue-times', payload })),
  ).then((result) => ({ label: 'queue', result }))
  const wiki = settle(
    fromThemeParks(id).then((payload) => ({ source: 'themeparks', payload })),
  ).then((result) => ({ label: 'wiki', result }))

  const quick = await Promise.race([queue, delay(3200).then(() => null)])
  if (hasRides(quick?.result)) return quick.result.value

  if (quick && !quick.result.ok) {
    const fallback = await wiki
    if (hasRides(fallback.result)) return fallback.result.value
    throw fallback.result.ok ? new Error('sem filas') : fallback.result.error
  }

  const first = await Promise.race([queue, wiki])
  if (hasRides(first.result)) {
    if (first.label === 'queue') return first.result.value
    const queued = await Promise.race([queue, delay(0).then(() => null)])
    if (hasRides(queued?.result)) return queued.result.value
    return first.result.value
  }

  const other = await (first.label === 'queue' ? wiki : queue)
  if (hasRides(other.result)) return other.result.value
  if (first.result.ok) return first.result.value
  if (other.result.ok) return other.result.value
  const reason = first.result.error ?? other.result.error
  throw reason instanceof Error ? reason : new Error('sem filas')
}

export default async function handler(request, response) {
  const id = String(request.query.id ?? '')
  if (!/^\d{1,6}$/.test(id)) {
    response.setHeader('cache-control', 'no-store')
    response.status(400).json({ error: 'Parque inválido.' })
    return
  }

  const fresh = request.query.fresh != null
  try {
    const result = await loadParkQueues(id)
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('cache-control', fresh ? 'no-store' : 'public, s-maxage=20, max-age=0')
    response.status(200).json({ source: result.source, ...result.payload })
  } catch {
    response.setHeader('cache-control', 'no-store')
    response.status(502).json({ error: 'As filas não carregaram.' })
  }
}
