import { Box, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'

/** Mostrado mientras carga el chunk de una ruta (lazy). */
export function RoutePageFallback() {
  const { t } = useTranslation()
  return (
    <Box
      className="flex items-center justify-center min-h-[40vh] w-full"
      role="status"
      aria-label={t('routePageFallback.loadingScreen')}
    >
      <CircularProgress />
    </Box>
  )
}
