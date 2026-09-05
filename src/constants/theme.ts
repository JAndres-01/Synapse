export const THEME = {
  colors: {
    bg: '#000000',
    surface: '#09090B',
    surfaceElevated: '#121215',
    card: '#18181B',
    cardElevated: '#1F1F23',
    cardHover: '#27272A',
    border: '#27272A',
    borderSubtle: '#27272A',
    borderLight: '#3F3F46',
    borderStrong: '#52525B',
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    textDark: '#52525B',
    accent: '#FAFAFA',
    accentMuted: '#27272A',
    white: '#FFFFFF',
    black: '#000000',
    danger: '#EF4444',
    dangerMuted: '#7F1D1D',
    dangerBg: 'rgba(239, 68, 68, 0.1)',
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.1)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.1)',
    info: '#3B82F6',
    infoBg: 'rgba(59, 130, 246, 0.1)',
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
} as const

export const WHITE_DOT_BORDER = {
  borderWidth: 0.8,
  borderColor: '#71717A',
} as const

export function isWhiteColor(hexColor?: string | null): boolean {
  if (!hexColor) return false
  const norm = hexColor.trim().toUpperCase()
  return norm === '#FFFFFF' || norm === '#FFF' || norm === '#FAFAFA'
}
