import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'

import {
  type AppRole,
  appRoleLabelEs,
  formatRolesListEs,
} from '@/app/roleMatrix'

type Props = {
  pathname: string
  effectiveRole: AppRole
  requiredRoles: readonly AppRole[]
  onGoDashboard: () => void
}

export function AccessDeniedContent({
  pathname,
  effectiveRole,
  requiredRoles,
  onGoDashboard,
}: Props) {
  const theme = useTheme()

  return (
    <Box
      className="flex flex-1 items-center justify-center p-4"
      sx={{ minHeight: '40vh' }}
    >
      <Paper
        elevation={0}
        className="max-w-md w-full overflow-hidden"
        sx={{
          border: 1,
          borderColor: 'divider',
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'grey.900'
              : theme.palette.background.paper,
        }}
      >
        <Stack spacing={2} className="p-6">
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              sx={{
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'error.dark'
                    : 'error.light',
                color: 'error.main',
              }}
              aria-hidden
            >
              <GavelOutlinedIcon fontSize="medium" />
            </Box>
            <Box className="min-w-0 flex-1">
              <Typography variant="h6" component="h1" gutterBottom>
                Sin permiso para esta sección
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tu perfil actual es{' '}
                <strong>{appRoleLabelEs(effectiveRole)}</strong>. Esta ruta
                requiere uno de los siguientes perfiles:{' '}
                <strong>{formatRolesListEs(requiredRoles)}</strong>.
              </Typography>
              <Typography
                variant="caption"
                component="p"
                color="text.disabled"
                className="mt-2 font-mono break-all"
              >
                {pathname}
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            color="primary"
            onClick={onGoDashboard}
            fullWidth
          >
            Ir al panel principal
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
