import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/queue-times': {
        target: 'https://queue-times.com',
        changeOrigin: true,
        rewrite: (path) => {
          const park = path.match(/\/parks\/(\d+)/)
          return park ? `/parks/${park[1]}/queue_times.json` : path
        },
      },
    },
  },
})
