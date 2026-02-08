import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initTheme } from './lib/theme'
import App from './App.tsx'

// Apply saved theme before first paint to prevent FOUC
initTheme()

// Cache version - change to bust CDN cache
console.log('ZedOps v2026.01.15.2')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
