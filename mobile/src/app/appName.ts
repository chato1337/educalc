const raw = import.meta.env.VITE_APP_NAME

/** Nombre de la aplicación (variable `VITE_APP_NAME` en `.env`). */
export const APP_NAME =
  typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : 'eduCalc'

/** Iniciales para el rail de tablet (máx. 2 caracteres). */
export const APP_MARK = appMark(APP_NAME)

function appMark(name: string): string {
  const parts = name.split(/[\s—–-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2)
}
