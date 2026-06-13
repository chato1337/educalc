import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { APP_NAME } from '@/app/appName'
import { getErrorMessage } from '@/api/errors'
import { useAuthStoreHydrated } from '@/hooks/useAuthStoreHydrated'
import { useAuthStore } from '@/stores/authStore'

import { LoginFeatureSlideshow } from './LoginFeatureSlideshow'

export function LoginPage() {
  const { t } = useTranslation()
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const hydrated = useAuthStoreHydrated()
  const access = useAuthStore((s) => s.access)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!hydrated) {
    return (
      <Box
        className="min-h-screen flex items-center justify-center p-4"
        sx={{ bgcolor: 'background.default' }}
        role="status"
        aria-label={t('login.restoreSession')}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (access) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, t('login.defaultError')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      className="min-h-screen flex items-center justify-center p-4"
      sx={{ bgcolor: 'background.default' }}
    >
      <Paper
        sx={{
          width: '100%',
          maxWidth: 1080,
          overflow: 'hidden',
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: theme.shadows[8],
          display: 'flex',
          flexDirection: isCompact ? 'column' : 'row',
          minHeight: isCompact ? undefined : 640,
        }}
      >
        {!isCompact ? (
          <Box sx={{ width: '42%', minWidth: 320 }}>
            <LoginFeatureSlideshow />
          </Box>
        ) : null}

        <Box
          className="flex flex-col justify-center"
          sx={{
            flex: 1,
            bgcolor: 'background.paper',
            px: { xs: 3, sm: 5, md: 6 },
            py: { xs: 4, md: 6 },
          }}
        >
          {isCompact ? (
            <Typography
              variant="subtitle2"
              color="primary"
              sx={{ fontWeight: 700, mb: 1 }}
            >
              {APP_NAME}
            </Typography>
          ) : null}

          <Typography
            variant="h4"
            component="h1"
            sx={{ fontSize: { xs: '1.75rem', sm: '2rem' } }}
          >
            {t('login.welcomeTitle', { appName: APP_NAME })}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
            {t('login.welcomeSubtitle')}
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <TextField
              label={t('login.username')}
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label={t('login.password')}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        aria-label={
                          showPassword
                            ? t('login.hidePassword')
                            : t('login.showPassword')
                        }
                        onClick={() => setShowPassword((visible) => !visible)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        sx={{ color: 'text.secondary' }}
                      >
                        {showPassword ? (
                          <VisibilityOffOutlinedIcon />
                        ) : (
                          <VisibilityOutlinedIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              sx={{ mt: 1, py: 1.4, fontSize: '1rem' }}
            >
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
