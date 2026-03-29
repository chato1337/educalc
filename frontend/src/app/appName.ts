const raw = import.meta.env.VITE_APP_NAME

/** Nombre de la aplicación (variable `VITE_APP_NAME` en `.env`). */
export const APP_NAME =
  typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : 'eduCalc'
