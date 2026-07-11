import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from './locales/es/common.json'
import auth from './locales/es/auth.json'
import workout from './locales/es/workout.json'
import exercises from './locales/es/exercises.json'
import routines from './locales/es/routines.json'
import history from './locales/es/history.json'
import analytics from './locales/es/analytics.json'
import settings from './locales/es/settings.json'

export const resources = {
  es: { common, auth, workout, exercises, routines, history, analytics, settings },
} as const

i18n.use(initReactI18next).init({
  lng: 'es',
  fallbackLng: 'es',
  defaultNS: 'common',
  ns: Object.keys(resources.es),
  resources,
  interpolation: { escapeValue: false },
})

export default i18n
