import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import es from '@/i18n/locales/es.json'

void i18n.use(initReactI18next).init({
  resources: {
    es: {
      translation: es,
    },
  },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
})

export { i18n }
