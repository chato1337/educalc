import { Box, CircularProgress } from '@mui/material'

/** Mostrado mientras carga el chunk de una ruta (lazy). */
export function RoutePageFallback() {
  return (
    <Box
      className="flex items-center justify-center min-h-[40vh] w-full"
      role="status"
      aria-label="Cargando pantalla"
    >
      <CircularProgress />
    </Box>
  )
}
