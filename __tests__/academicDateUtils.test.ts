import {
  getActiveAcademicWeek,
  formatTaskDueDate,
  isTaskForAcademicDay,
  calculateAcademicVitalStats,
} from '@/lib/academicDateUtils'
import type { Task, Subject } from '@/types/personal'

describe('academicDateUtils', () => {
  test('calcula correctamente la semana académica actual para un miércoles', () => {
    // 2026-09-02 fue miércoles
    const wednesday = new Date(2026, 8, 2, 10, 0, 0)
    const week = getActiveAcademicWeek(wednesday)

    expect(week.isCurrentWeek).toBe(true)
    expect(week.mondayDate.getDate()).toBe(31) // Lunes 31 de Agosto
    expect(week.fridayDate.getDate()).toBe(4)   // Viernes 4 de Septiembre
  })

  test('formatea correctamente fechas límite de tareas', () => {
    const refDate = new Date(2026, 8, 2, 12, 0, 0)
    const todayTask = new Date(2026, 8, 2, 18, 0, 0).toISOString()
    const formattedToday = formatTaskDueDate(todayTask, false, refDate)
    expect(formattedToday).not.toBeNull()
    expect(formattedToday?.isToday).toBe(true)

    // Tarea vencida
    const pastDate = new Date(2026, 7, 30, 10, 0, 0).toISOString()
    const formattedPast = formatTaskDueDate(pastDate, false, refDate)
    expect(formattedPast?.isPast).toBe(true)
  })

  test('calcula estadísticas vitales de tareas correctamente', () => {
    const tasks: Task[] = [
      { id: '1', title: 'T1', status: 'completed' },
      { id: '2', title: 'T2', status: 'pending' },
      { id: '3', title: 'T3', status: 'pending' },
    ]
    const subjects: Subject[] = [
      { id: 's1', name: 'Materia 1', color: '#10B981' },
      { id: 's2', name: 'Materia 2', color: '#3B82F6' },
    ]

    const stats = calculateAcademicVitalStats(tasks, subjects)
    expect(stats.totalTasksCount).toBe(3)
    expect(stats.completedTasksCount).toBe(1)
    expect(stats.pendingTasksCount).toBe(2)
    expect(stats.completionRate).toBe(33)
  })

  test('identifica si una tarea pertenece a un día académico específico', () => {
    const targetDate = new Date('2026-09-02T10:00:00')
    expect(isTaskForAcademicDay('2026-09-02T15:30:00', targetDate)).toBe(true)
    expect(isTaskForAcademicDay('2026-09-03T10:00:00', targetDate)).toBe(false)
    expect(isTaskForAcademicDay(null, targetDate)).toBe(false)
  })
})
