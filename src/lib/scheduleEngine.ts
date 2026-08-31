import type { Schedule } from '@/types/personal'

export interface BlockDefinition {
  block: number
  startTime: string // "07:00"
  endTime: string   // "08:30"
  label: string
}

export const PERSONAL_SCHEDULE_BLOCKS: BlockDefinition[] = [
  { block: 1, startTime: '07:00', endTime: '08:30', label: 'Clase 1' },
  { block: 2, startTime: '08:30', endTime: '10:00', label: 'Clase 2' },
  { block: 3, startTime: '10:30', endTime: '11:45', label: 'Clase 3' },
  { block: 4, startTime: '11:45', endTime: '13:00', label: 'Clase 4' },
]

export const BREAK_BLOCK = {
  startTime: '10:00',
  endTime: '10:30',
  label: 'Receso',
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export type LiveClassStatus =
  | 'active'
  | 'break'
  | 'before_school'
  | 'after_school'
  | 'weekend'
  | 'free'

export interface LiveStatusResult {
  status: LiveClassStatus
  activeSchedule: Schedule | null
  nextSchedule: Schedule | null
  minutesRemaining: number
  progressPercentage: number
  badgeText: string
  headline: string
  subheadline: string
}

export function calculateLiveClassStatus(schedulesToday: Schedule[]): LiveStatusResult {
  const now = new Date()
  const day = now.getDay() // 0: Dom, 1: Lun ... 6: SÃ¡b

  // Fin de semana
  if (day === 0 || day === 6) {
    return {
      status: 'weekend',
      activeSchedule: null,
      nextSchedule: null,
      minutesRemaining: 0,
      progressPercentage: 0,
      badgeText: 'Fin de Semana',
      headline: 'DÃ­as de Descanso',
      subheadline: 'PrepÃ¡rate para las clases del lunes',
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const schoolStart = timeToMinutes('07:00')
  const schoolEnd = timeToMinutes('13:00')

  // Antes de las 7:00 AM
  if (currentMinutes < schoolStart) {
    const firstSched = schedulesToday.find((s) => s.block_number === 1)
    const minsToStart = schoolStart - currentMinutes

    return {
      status: 'before_school',
      activeSchedule: null,
      nextSchedule: firstSched || null,
      minutesRemaining: minsToStart,
      progressPercentage: 0,
      badgeText: 'PrÃ³xima Jornada',
      headline: firstSched?.subject ? firstSched.subject.name : 'Inicio de Clases',
      subheadline: `Comienza a las 7:00 AM (${minsToStart} min restantes)`,
    }
  }

  // DespuÃ©s de la 1:00 PM
  if (currentMinutes >= schoolEnd) {
    return {
      status: 'after_school',
      activeSchedule: null,
      nextSchedule: null,
      minutesRemaining: 0,
      progressPercentage: 100,
      badgeText: 'Jornada Finalizada',
      headline: 'Clases del DÃ­a Completadas',
      subheadline: 'Revisa tus tareas y pendientes para maÃ±ana',
    }
  }

  // En Receso (10:00 - 10:30)
  const breakStart = timeToMinutes(BREAK_BLOCK.startTime)
  const breakEnd = timeToMinutes(BREAK_BLOCK.endTime)
  if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
    const nextSched = schedulesToday.find((s) => s.block_number === 3)
    const minsLeftInBreak = breakEnd - currentMinutes
    const breakProgress = ((currentMinutes - breakStart) / (breakEnd - breakStart)) * 100

    return {
      status: 'break',
      activeSchedule: null,
      nextSchedule: nextSched || null,
      minutesRemaining: minsLeftInBreak,
      progressPercentage: Math.min(100, Math.max(0, breakProgress)),
      badgeText: 'En Receso',
      headline: 'Tiempo de Descanso',
      subheadline: nextSched?.subject
        ? `Siguiente: ${nextSched.subject.name} a las 10:30 AM (${minsLeftInBreak} min)`
        : `Siguiente bloque a las 10:30 AM (${minsLeftInBreak} min)`,
    }
  }

  // Buscar bloque activo
  for (const blockDef of PERSONAL_SCHEDULE_BLOCKS) {
    const startMins = timeToMinutes(blockDef.startTime)
    const endMins = timeToMinutes(blockDef.endTime)

    if (currentMinutes >= startMins && currentMinutes < endMins) {
      const sched = schedulesToday.find((s) => s.block_number === blockDef.block)
      const nextSched = schedulesToday.find((s) => s.block_number === blockDef.block + 1)
      const minutesRemaining = endMins - currentMinutes
      const totalBlockMins = endMins - startMins
      const progress = ((currentMinutes - startMins) / totalBlockMins) * 100

      if (sched?.subject) {
        return {
          status: 'active',
          activeSchedule: sched,
          nextSchedule: nextSched || null,
          minutesRemaining,
          progressPercentage: Math.min(100, Math.max(0, progress)),
          badgeText: 'Clase en Vivo',
          headline: sched.subject.name,
          subheadline: `Quedan ${minutesRemaining} min â€¢ Termina a las ${blockDef.endTime}`,
        }
      } else {
        return {
          status: 'free',
          activeSchedule: null,
          nextSchedule: nextSched || null,
          minutesRemaining,
          progressPercentage: Math.min(100, Math.max(0, progress)),
          badgeText: 'Bloque Libre',
          headline: 'Autoestudio / Sin Clase',
          subheadline: `Termina a las ${blockDef.endTime} (${minutesRemaining} min restantes)`,
        }
      }
    }
  }

  return {
    status: 'free',
    activeSchedule: null,
    nextSchedule: null,
    minutesRemaining: 0,
    progressPercentage: 0,
    badgeText: 'Sin Clase',
    headline: 'Horario Libre',
    subheadline: 'No hay clases programadas en este momento',
  }
}
