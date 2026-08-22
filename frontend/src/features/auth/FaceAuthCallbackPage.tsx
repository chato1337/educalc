import { Box, CircularProgress, Typography } from '@mui/material'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { getErrorMessage } from '@/api/errors'
import { useAuthStore } from '@/stores/authStore'

export function FaceAuthCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loginWithFaceAuthToken = useAuthStore((s) => s.loginWithFaceAuthToken)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const token = params.get('token')
    if (!token) {
      navigate('/login', {
        replace: true,
        state: { faceAuthError: t('login.callbackMissingToken') },
      })
      return
    }

    void loginWithFaceAuthToken(token)
      .then(() => {
        navigate('/dashboard', { replace: true })
      })
      .catch((err) => {
        navigate('/login', {
          replace: true,
          state: {
            faceAuthError: getErrorMessage(err, t('login.callbackError')),
          },
        })
      })
  }, [loginWithFaceAuthToken, navigate, params, t])

  return (
    <Box
      className="min-h-screen flex flex-col items-center justify-center gap-3 p-4"
      sx={{ bgcolor: 'background.default' }}
      role="status"
      aria-label={t('login.callbackExchanging')}
    >
      <CircularProgress />
      <Typography color="text.secondary">{t('login.callbackExchanging')}</Typography>
    </Box>
  )
}
