export const WHITE_DOT_BORDER = {
  borderWidth: 0.8,
  borderColor: '#71717A',
} as const

export function isWhiteColor(hexColor?: string | null): boolean {
  if (!hexColor) return false
  const norm = hexColor.trim().toUpperCase()
  return norm === '#FFFFFF' || norm === '#FFF' || norm === '#FAFAFA'
}
