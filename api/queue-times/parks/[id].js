export default async function handler(request, response) {
  const id = String(request.query.id ?? '')
  if (!/^\d{1,6}$/.test(id)) {
    response.status(400).json({ error: 'Parque inválido.' })
    return
  }

  const upstream = await fetch(`https://queue-times.com/parks/${id}/queue_times.json`, {
    headers: { accept: 'application/json' },
  })
  const body = await upstream.text()
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'public, max-age=60')
  response.status(upstream.status).send(body)
}
