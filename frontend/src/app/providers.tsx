import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useMemo, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { i18n } from '@/i18n'
import { useUiStore } from '@/stores/uiStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
})

type Props = { children: ReactNode }

export function AppProviders({ children }: Props) {
  const themeMode = useUiStore((s) => s.themeMode)
  const language = useUiStore((s) => s.language)
  const setThemeMode = useUiStore((s) => s.setThemeMode)
  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode: themeMode },
        shape: { borderRadius: 10 },
      }),
    [themeMode],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      setThemeMode('light')
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    setThemeMode(media.matches ? 'dark' : 'light')

    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      setThemeMode(event.matches ? 'dark' : 'light')
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onSystemThemeChange)
      return () => media.removeEventListener('change', onSystemThemeChange)
    }

    media.addListener(onSystemThemeChange)
    return () => media.removeListener(onSystemThemeChange)
  }, [setThemeMode])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', themeMode === 'dark')
    root.style.colorScheme = themeMode
  }, [themeMode])

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language)
    }
  }, [language])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
