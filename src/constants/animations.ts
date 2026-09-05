import { Easing } from 'react-native'

export const APPLE_EASING = Easing.bezier(0.16, 1, 0.3, 1)

/**
 * Física de resorte ultra-rápida y fluida para paneles inferiores (60-120 FPS)
 */
export const SPRING_PANEL_CONFIG = {
  stiffness: 750,
  damping: 32,
  mass: 0.5,
  useNativeDriver: true,
} as const

/**
 * Física de resorte para animación de entrada escalonada en pantallas principales
 */
export const SPRING_ENTRANCE_CONFIG = {
  stiffness: 320,
  damping: 24,
  mass: 0.7,
  useNativeDriver: true,
} as const

/**
 * Física de resorte táctil para retroalimentación interactiva (botones, fab, etc.)
 */
export const SPRING_TOUCH_CONFIG = {
  stiffness: 500,
  damping: 20,
  useNativeDriver: true,
} as const

/**
 * Física de resorte críticamente amortiguada (damping ratio ≈ 1.0) para indicadores y barras
 * de deslizamiento horizontal (tabs, segment controls, islas de navegación).
 * Elimina oscilaciones y tartamudeos asegurando 60-120 FPS ultra fluidos.
 */
export const SPRING_SLIDE_INDICATOR = {
  stiffness: 420,
  damping: 32,
  mass: 0.55,
  useNativeDriver: true,
} as const


