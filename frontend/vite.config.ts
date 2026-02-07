import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend target: use VITE_BACKEND_URL env var or default to dev environment
const backendUrl = process.env.VITE_BACKEND_URL || 'https://zedops-dev.mail-bcf.workers.dev'
const wsUrl = backendUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: true,
      },
      '/ws': {
        target: wsUrl,
        changeOrigin: true,
        ws: true,
        secure: true,
      },
    },
  },
})
