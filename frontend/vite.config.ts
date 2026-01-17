import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
        target: 'https://zedops.mail-bcf.workers.dev',
        changeOrigin: true,
        secure: true,
      },
      '/ws': {
        target: 'wss://zedops.mail-bcf.workers.dev',
        changeOrigin: true,
        ws: true,
        secure: true,
      },
    },
  },
})
