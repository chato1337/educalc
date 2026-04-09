import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { APP_NAME } from '@/app/appName'
import { getErrorMessage } from '@/api/errors'
import { useAuthStoreHydrated } from '@/hooks/useAuthStoreHydrated'
import { useAuthStore } from '@/stores/authStore'

export function LoginPage() {
  const { t } = useTranslation()
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
      <Paper className="p-6 w-full max-w-md flex flex-col gap-4">
        <Typography variant="h5" component="h1">
          {t('login.title', { appName: APP_NAME })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('login.subtitle')}
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
          >
            {loading ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
      </Paper>
    </Box>
  )
}
