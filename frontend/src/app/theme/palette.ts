/** Paleta de marca eduCalc (azul sobrio). */
export const brandColors = {
  primary: {
    25: '#F5F9FF',
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#2563EB',
    600: '#1D4ED8',
    700: '#1E40AF',
    800: '#1E3A8A',
    900: '#172554',
  },
  secondary: {
    400: '#64748B',
    500: '#475569',
    600: '#334155',
    700: '#1E293B',
  },
  neutral: {
    25: '#FCFCFD',
    50: '#F9FAFB',
    100: '#F2F4F7',
    200: '#EAECF0',
    300: '#D0D5DD',
    400: '#98A2B3',
    500: '#667085',
    600: '#475467',
    700: '#344054',
    800: '#1D2939',
    900: '#101828',
  },
  slate: {
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  success: {
    main: '#12B76A',
    dark: '#027A48',
  },
  warning: {
    main: '#F79009',
    dark: '#B54708',
  },
  error: {
    main: '#F04438',
    dark: '#B42318',
  },
  info: {
    main: '#0EA5E9',
    dark: '#0284C7',
  },
} as const

/** Tonos semitransparentes para gradientes del slideshow de login. */
export const brandGradients = {
  blue: 'rgba(37, 99, 235, 0.72)',
  steel: 'rgba(29, 78, 216, 0.72)',
  navy: 'rgba(30, 64, 175, 0.72)',
  deep: 'rgba(23, 37, 84, 0.78)',
  overlayBase: 'rgba(15, 23, 42, 0.92)',
} as const

export function brandSlideGradient(accent: string) {
  return `linear-gradient(145deg, ${brandGradients.overlayBase} 0%, ${accent} 100%)`
}
