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

// Convierte "HH:MM" o "HH:MM:SS" a minutos desde las 00:00 de forma segura
export function timeStringToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0
  try {
    const parts = timeStr.split(':').map(Number)
    return (parts[0] || 0) * 60 + (parts[1] || 0)
  } catch {
    return 0
  }
}

// Formatea minutos a horas y minutos legibles (ej: 145 min -> "2 h 25 min", 45 min -> "45 min")
export function formatMinutesHuman(totalMinutes?: number | null): string {
  if (totalMinutes === undefined || totalMinutes === null || totalMinutes <= 0) {
    return 'Ahora'
  }
  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (mins === 0) {
    return `${hours} h`
  }
  return `${hours} h ${mins} min`
}

export function getCurrentClassState(
  schedulesToday: Schedule[] = [],
  now: Date = new Date()
): CurrentClassState {
  if (!schedulesToday || schedulesToday.length === 0) {
    return { status: 'no_classes' }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Filtrar horarios válidos y ordenar por número de bloque
  const sorted = [...schedulesToday]
    .filter((item) => !!item && !!item.start_time && !!item.end_time)
    .sort((a, b) => (a.block_number || 0) - (b.block_number || 0))

  if (sorted.length === 0) {
    return { status: 'no_classes' }
  }

  // 1. Verificar si hay una clase activa en este momento
  for (const item of sorted) {
    const start = timeStringToMinutes(item.start_time)
    const end = timeStringToMinutes(item.end_time)

    if (currentMinutes >= start && currentMinutes < end) {
      const remaining = Math.max(0, end - currentMinutes)

      if (item.is_virtual) {
        return {
          status: 'virtual_free',
          currentSchedule: item,
          minutesRemaining: remaining,
        }
      }

      const totalDuration = Math.max(1, end - start)
      const elapsed = currentMinutes - start
      const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))

      return {
        status: 'active',
        currentSchedule: item,
        minutesRemaining: remaining,
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
      minutesUntilNext: Math.max(0, start - currentMinutes),
    }
  }

  // 3. Si ya pasaron todas las clases del día (después del último bloque)
  return {
    status: 'day_ended',
  }
}
