import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { APP_NAME } from '@/app/appName'
import App from '@/App.tsx'
import { i18n } from '@/i18n'
import '@/index.css'

const setDocumentTitle = () => {
  document.title = i18n.t('app.adminTitle', { appName: APP_NAME })
}

setDocumentTitle()
i18n.on('languageChanged', setDocumentTitle)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
