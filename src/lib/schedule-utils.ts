import { SCHEDULE_BLOCKS } from './utils';
import type { Schedule } from '@/types/database';

export interface CurrentClassState {
  status: 'active' | 'upcoming' | 'virtual_free' | 'day_ended' | 'no_classes'
  currentSchedule?: Schedule
  nextSchedule?: Schedule
  minutesRemaining?: number
  minutesUntilNext?: number
  progressPercent?: number
}

// Convierte "HH:MM" o "HH:MM:SS" a minutos desde las 00:00
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)
  return parts[0] * 60 + parts[1]
}

export function getCurrentClassState(
  schedulesToday: Schedule[],
  now: Date = new Date()
): CurrentClassState {
  if (!schedulesToday || schedulesToday.length === 0) {
    return { status: 'no_classes' }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Ordenar bloques por block_number
  const sorted = [...schedulesToday].sort((a, b) => a.block_number - b.block_number)

  // 1. Verificar si hay una clase activa en este momento
  for (const item of sorted) {
    const start = timeStringToMinutes(item.start_time)
    const end = timeStringToMinutes(item.end_time)

    if (currentMinutes >= start && currentMinutes < end) {
      if (item.is_virtual) {
        return {
          status: 'virtual_free',
          currentSchedule: item,
          minutesRemaining: end - currentMinutes,
        }
      }

      const totalDuration = end - start
      const elapsed = currentMinutes - start
      const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))

      return {
        status: 'active',
        currentSchedule: item,
        minutesRemaining: end - currentMinutes,
        progressPercent,
      }
    }
  }

  // 2. Verificar si hay una clase próxima más tarde hoy
  const upcoming = sorted.find((item) => timeStringToMinutes(item.start_time) > currentMinutes)

  if (upcoming) {
    const start = timeStringToMinutes(upcoming.start_time)
    return {
      status: 'upcoming',
      nextSchedule: upcoming,
      minutesUntilNext: start - currentMinutes,
    }
  }

  // 3. Si ya pasaron todas las clases del día (después de la 1:00 PM)
  return {
    status: 'day_ended',
  }
}
