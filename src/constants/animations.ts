import { Easing } from 'react-native'

export const APPLE_EASING = Easing.bezier(0.16, 1, 0.3, 1)

export const ANIMATION_DURATIONS = {
  instant: 120,
  fast: 180,
  normal: 260,
  smooth: 320,
  slow: 450,
} as const
