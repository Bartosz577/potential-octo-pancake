import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// ── Global error handlers — forward to main process for logging ──

window.onerror = (_message, _source, _lineno, _colno, error) => {
  window.api.logError(
    error?.message || String(_message),
    error?.stack
  )
}

window.onunhandledrejection = (event) => {
  const error = event.reason
  window.api.logError(
    error instanceof Error ? error.message : String(error),
    error instanceof Error ? error.stack : undefined
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
