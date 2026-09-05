import type { Task } from '@/types/personal'

/**
 * Ordena tareas colocando las fechas de entrega más próximas al principio.
 *
 * Criterios de ordenación:
 * 1. Estado: Si la lista mezcla estados ('all'), las tareas 'pending' se muestran antes que 'completed'.
 * 2. Fecha de entrega (due_date):
 *    - La fecha más próxima (menor timestamp) se ubica al principio.
 *    - Las tareas con fecha tienen prioridad sobre tareas sin fecha asignada.
 * 3. Fallback: Si ambas tienen la misma fecha (o ninguna), la más recientemente creada va primero.
 */
export function sortTasksByDueDate(tasks: Task[]): Task[] {
  if (!Array.isArray(tasks) || tasks.length <= 1) {
    return tasks ? [...tasks] : []
  }

  return [...tasks].sort((a, b) => {
    // 1. Si tienen diferente estado (e.g. en la pestaña 'todas'), pendientes primero
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1
    }

    // 2. Ambas tienen fecha de entrega
    if (a.due_date && b.due_date) {
      const timeA = new Date(a.due_date).getTime()
      const timeB = new Date(b.due_date).getTime()
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB
      }
    }

    // 3. Tareas con fecha de entrega van antes que tareas sin fecha
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1

    // 4. Fallback por fecha de creación (más reciente arriba)
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    return createdB - createdA
  })
}
