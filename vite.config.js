import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // equivalente a '0.0.0.0': accesible desde la red local
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})