import react from '@vitejs/plugin-react'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import { getFxRates } from './src/lib/fxServer.ts'

function fxApiPlugin(): Plugin {
  const handle: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/api/fx')) {
      next()
      return
    }
    try {
      const rates = await getFxRates()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(rates))
    } catch {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'fx_unavailable' }))
    }
  }

  return {
    name: 'fx-api',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), fxApiPlugin()],
})
