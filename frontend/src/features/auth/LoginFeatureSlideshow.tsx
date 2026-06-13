import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import { Box, Typography, useTheme } from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { APP_NAME } from '@/app/appName'

import { LOGIN_FEATURE_SLIDES } from './loginFeatures'

const SLIDE_INTERVAL_MS = 6000

export function LoginFeatureSlideshow() {
  const { t } = useTranslation()
  const theme = useTheme()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % LOGIN_FEATURE_SLIDES.length)
    }, SLIDE_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  const activeSlide = LOGIN_FEATURE_SLIDES[activeIndex]

  return (
    <Box
      className="relative flex flex-col h-full min-h-[320px] md:min-h-0"
      sx={{
        background: activeSlide.gradient,
        transition: 'background 0.8s ease',
        color: '#fff',
        p: { xs: 4, md: 5 },
      }}
    >
      <Box className="relative z-10 flex items-center gap-2">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.14)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CalculateOutlinedIcon fontSize="small" />
        </Box>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {APP_NAME}
        </Typography>
      </Box>

      <Box className="relative z-10 flex-1 flex flex-col justify-center py-8">
        {LOGIN_FEATURE_SLIDES.map((slide, index) => {
          const Icon = slide.icon
          const isActive = index === activeIndex

          return (
            <Box
              key={slide.id}
              aria-hidden={!isActive}
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
                px: { md: 1 },
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.12)',
                  display: 'grid',
                  placeItems: 'center',
                  mb: 1,
                }}
              >
                <Icon sx={{ fontSize: 30 }} />
              </Box>
              <Typography
                variant="h4"
                component="p"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.25,
                  fontSize: { xs: '1.75rem', md: '2rem' },
                }}
              >
                {t(slide.quoteKey)}
              </Typography>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t(slide.titleKey)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(255,255,255,0.78)', mt: 0.5, maxWidth: 360 }}
                >
                  {t(slide.descriptionKey)}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>

      <Box
        className="relative z-10 flex items-center gap-2"
        role="tablist"
        aria-label={t('login.slides.navigation')}
      >
        {LOGIN_FEATURE_SLIDES.map((slide, index) => {
          const isActive = index === activeIndex

          return (
            <Box
              key={slide.id}
              component="button"
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={t(slide.titleKey)}
              onClick={() => setActiveIndex(index)}
              sx={{
                width: isActive ? 28 : 10,
                height: 10,
                border: 0,
                borderRadius: 999,
                p: 0,
                cursor: 'pointer',
                bgcolor: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'width 0.25s ease, background-color 0.25s ease',
                '&:hover': {
                  bgcolor: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                },
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            />
          )
        })}
      </Box>
    </Box>
  )
}
