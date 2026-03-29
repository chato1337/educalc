import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { APP_NAME } from '@/app/appName'
import App from '@/App.tsx'
import '@/index.css'

document.title = `${APP_NAME} — Administración`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
