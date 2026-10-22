import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getFxRates } from '../src/lib/fxServer.ts'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const rates = await getFxRates()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(200).json(rates)
  } catch {
    res.status(502).json({ error: 'fx_unavailable' })
  }
}
