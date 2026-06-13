import {
  alpha,
  createTheme,
  type PaletteMode,
  type Theme,
} from '@mui/material/styles'

import { brandColors } from './palette'

const fontFamily = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(',')

function buildPalette(mode: PaletteMode) {
  if (mode === 'dark') {
    return {
      mode: 'dark' as const,
      primary: {
        main: brandColors.primary[400],
        light: brandColors.primary[300],
        dark: brandColors.primary[600],
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: brandColors.secondary[400],
        light: brandColors.secondary[400],
        dark: brandColors.secondary[600],
        contrastText: '#FFFFFF',
      },
      success: {
        main: brandColors.success.main,
        dark: brandColors.success.dark,
        contrastText: '#FFFFFF',
      },
      warning: {
        main: brandColors.warning.main,
        dark: brandColors.warning.dark,
        contrastText: brandColors.neutral[900],
      },
      error: {
        main: brandColors.error.main,
        dark: brandColors.error.dark,
        contrastText: '#FFFFFF',
      },
      info: {
        main: brandColors.info.main,
        dark: brandColors.info.dark,
        contrastText: '#FFFFFF',
      },
      background: {
        default: brandColors.slate[900],
        paper: brandColors.slate[800],
      },
      text: {
        primary: brandColors.neutral[50],
        secondary: brandColors.neutral[400],
        disabled: brandColors.neutral[500],
      },
      divider: alpha('#FFFFFF', 0.12),
      action: {
        hover: alpha(brandColors.primary[400], 0.12),
        selected: alpha(brandColors.primary[400], 0.18),
        focus: alpha(brandColors.primary[400], 0.2),
      },
    }
  }

  return {
    mode: 'light' as const,
    primary: {
      main: brandColors.primary[500],
      light: brandColors.primary[300],
      dark: brandColors.primary[600],
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brandColors.secondary[500],
      light: brandColors.secondary[400],
      dark: brandColors.secondary[600],
      contrastText: '#FFFFFF',
    },
    success: {
      main: brandColors.success.main,
      dark: brandColors.success.dark,
      contrastText: '#FFFFFF',
    },
    warning: {
      main: brandColors.warning.main,
      dark: brandColors.warning.dark,
      contrastText: brandColors.neutral[900],
    },
    error: {
      main: brandColors.error.main,
      dark: brandColors.error.dark,
      contrastText: '#FFFFFF',
    },
    info: {
      main: brandColors.info.main,
      dark: brandColors.info.dark,
      contrastText: '#FFFFFF',
    },
    background: {
      default: brandColors.neutral[100],
      paper: '#FFFFFF',
    },
    text: {
      primary: brandColors.neutral[900],
      secondary: brandColors.neutral[600],
      disabled: brandColors.neutral[400],
    },
    divider: brandColors.neutral[200],
    action: {
      hover: alpha(brandColors.primary[500], 0.06),
      selected: alpha(brandColors.primary[500], 0.12),
      focus: alpha(brandColors.primary[500], 0.12),
    },
  }
}

function buildComponents(mode: PaletteMode): Theme['components'] {
  const primaryMain =
    mode === 'dark' ? brandColors.primary[400] : brandColors.primary[500]

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${alpha(primaryMain, 0.35)} transparent`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: mode === 'light' ? '#FFFFFF' : undefined,
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: primaryMain,
            borderWidth: 2,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            color: primaryMain,
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'primary',
      },
      styleOverrides: {
        root: {
          borderBottom: '1px solid',
          borderColor:
            mode === 'light'
              ? alpha(brandColors.primary[700], 0.24)
              : alpha('#FFFFFF', 0.08),
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid',
          borderColor:
            mode === 'light'
              ? brandColors.neutral[200]
              : alpha('#FFFFFF', 0.12),
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          '&.Mui-selected': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            color: theme.palette.primary.main,
            '& .MuiListItemIcon-root': {
              color: theme.palette.primary.main,
            },
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.16),
            },
          },
        }),
      },
    },
    MuiLink: {
      defaultProps: {
        underline: 'hover',
      },
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiCircularProgress: {
      defaultProps: {
        color: 'primary',
      },
    },
  }
}

export function createAppTheme(mode: PaletteMode): Theme {
  return createTheme({
    palette: buildPalette(mode),
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily,
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      button: { fontWeight: 600 },
    },
    shadows: [
      'none',
      '0 1px 2px rgba(16, 24, 40, 0.05)',
      '0 4px 8px rgba(16, 24, 40, 0.06)',
      '0 8px 16px rgba(16, 24, 40, 0.08)',
      '0 12px 24px rgba(16, 24, 40, 0.08)',
      '0 16px 32px rgba(16, 24, 40, 0.1)',
      '0 20px 40px rgba(16, 24, 40, 0.12)',
      '0 24px 48px rgba(16, 24, 40, 0.12)',
      '0 24px 48px rgba(16, 24, 40, 0.14)',
      '0 24px 48px rgba(16, 24, 40, 0.16)',
      '0 24px 48px rgba(16, 24, 40, 0.18)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
      '0 24px 48px rgba(16, 24, 40, 0.2)',
    ],
    components: buildComponents(mode),
  })
}
