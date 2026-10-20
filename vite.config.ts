import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Same path the production nginx serves: /engine/v1/* → vo101-engine
    proxy: {
      '/engine': {
        target: process.env.ENGINE_DEV_URL || 'http://127.0.0.1:9100',
        rewrite: (path) => path.replace(/^\/engine/, ''),
      },
    },
  },
})
