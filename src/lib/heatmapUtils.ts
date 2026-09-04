import type { Task } from '@/types/personal'

export interface HeatmapDay {
  date: Date
  dateStr: string // 'YYYY-MM-DD'
  dayOfWeek: number // 0: Dom, 1: Lun, ... 6: Sáb
  dayOfMonth: number
  monthIndex: number
  monthNameShort: string
  isInRange: boolean
  isToday: boolean
  isFuture: boolean
  count: number
  intensity: 0 | 1 | 2 | 3
  formattedLabel: string
}

export interface HeatmapMonthLabel {
  monthName: string
  colIndex: number
}

export interface HeatmapGridData {
  weeks: HeatmapDay[][]
  monthLabels: HeatmapMonthLabel[]
  totalCompletions: number
  daysInRange: number
}

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function extractDateKeyFromTask(task: Task): string | null {
  // 1. Prioridad: due_date (fecha académica de entrega de la tarea)
  // 2. Si no tiene due_date: updated_at (momento en que se completó) o created_at
  const candidate = task.due_date || task.updated_at || task.created_at
  if (!candidate) return null

  if (typeof candidate === 'string') {
    // Si ya es formato directo YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      return candidate
    }

    // Si es formato ISO con T (ej. 2026-09-15T...)
    if (candidate.includes('T')) {
      const datePart = candidate.split('T')[0]
      try {
        const d = new Date(candidate)
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }
      } catch {
        // fallback to datePart
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart
      }
    }

    try {
      const d = new Date(candidate)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }
    } catch {
      // ignore
    }
  }
  return null
}

export function generateHeatmapGrid(
  tasks: Task[],
  startDateStr: string,
  endDateStr: string,
  referenceDate: Date = new Date()
): HeatmapGridData {
  const [sY, sM, sD] = startDateStr.split('-').map((n) => parseInt(n, 10))
  const [eY, eM, eD] = endDateStr.split('-').map((n) => parseInt(n, 10))

  // Usar las 12:00 (mediodía) para evitar cualquier salto por cambios de huso horario (DST)
  const startDate = new Date(sY, sM - 1, sD, 12, 0, 0, 0)
  const endDate = new Date(eY, eM - 1, eD, 12, 0, 0, 0)

  const todayKey = formatDateKey(referenceDate)

  const completionsMap = new Map<string, number>()
  tasks.forEach((t) => {
    const isCompleted = t.status === 'completed'
    if (isCompleted) {
      const key = extractDateKeyFromTask(t)
      if (key) {
        completionsMap.set(key, (completionsMap.get(key) || 0) + 1)
      }
    }
  })

  // Calcular el primer domingo de la primera columna
  const firstSunday = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate() - startDate.getDay(),
    12,
    0,
    0,
    0
  )

  // Calcular el último sábado de la última columna
  const daysToSaturday = (6 - endDate.getDay() + 7) % 7
  const lastSaturday = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate() + daysToSaturday,
    12,
    0,
    0,
    0
  )

  const weeks: HeatmapDay[][] = []
  const monthLabels: HeatmapMonthLabel[] = []
  let lastSeenMonth = -1
  let totalCompletions = 0
  let daysInRange = 0

  let currDate = new Date(firstSunday)
  let currentWeek: HeatmapDay[] = []
  let colIndex = 0

  // Recorrer día a día desde el primer domingo hasta el último sábado
  while (currDate.getTime() <= lastSaturday.getTime()) {
    const dayOfWeek = currDate.getDay()
    const dateKey = formatDateKey(currDate)
    // Comparación lexicográfica exacta de fecha YYYY-MM-DD
    const isInRange = dateKey >= startDateStr && dateKey <= endDateStr
    const isToday = dateKey === todayKey
    const isFuture = dateKey > todayKey

    const count = isInRange ? completionsMap.get(dateKey) || 0 : 0
    if (isInRange) {
      daysInRange++
      totalCompletions += count
    }

    let intensity: 0 | 1 | 2 | 3 = 0
    if (count === 1) intensity = 1
    else if (count === 2) intensity = 2
    else if (count >= 3) intensity = 3

    const monthIndex = currDate.getMonth()
    const monthNameShort = MONTHS_SHORT[monthIndex]
    const dayName = DAYS_SHORT[dayOfWeek]
    const dayOfMonth = currDate.getDate()
    const year = currDate.getFullYear()

    if (isInRange && monthIndex !== lastSeenMonth) {
      monthLabels.push({
        monthName: monthNameShort,
        colIndex,
      })
      lastSeenMonth = monthIndex
    }

    const dayObj: HeatmapDay = {
      date: new Date(currDate),
      dateStr: dateKey,
      dayOfWeek,
      dayOfMonth,
      monthIndex,
      monthNameShort,
      isInRange,
      isToday,
      isFuture,
      count,
      intensity,
      formattedLabel: `${dayName} ${dayOfMonth} ${monthNameShort} ${year}`,
    }

    currentWeek.push(dayObj)

    if (dayOfWeek === 6) {
      weeks.push(currentWeek)
      currentWeek = []
      colIndex++
    }

    currDate.setDate(currDate.getDate() + 1)
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  return {
    weeks,
    monthLabels,
    totalCompletions,
    daysInRange,
  }
}