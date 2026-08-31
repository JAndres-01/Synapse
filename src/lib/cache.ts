import type { Task, Schedule, Subject, TaskAttachment, TaskComment } from '@/types/database'

export interface TaskDetailsCache {
  attachments: TaskAttachment[]
  comments: TaskComment[]
  lastFetched: number
}

export interface AppMemoryCache {
  tasks: Task[]
  schedules: Schedule[]
  subjects: Subject[]
  pendingTasksCount: number
  lastUpdated: number
  taskDetails: Record<string, TaskDetailsCache>
}

// Función pura para ordenamiento determinista y estable de tareas (0ms layout shifts)
export function sortTasksChronologically(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 1. Tareas con fecha límite primero, ordenadas cronológicamente (más próxima primero)
    if (a.due_date && b.due_date) {
      const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      if (diff !== 0) return diff
    }
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1

    // 2. Si no tienen fecha límite, por fecha de creación más reciente
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
    if (bCreated !== aCreated) return bCreated - aCreated

    // 3. Empate definitivo por ID estable
    return a.id.localeCompare(b.id)
  })
}

// Caché global en memoria compartida para navegación instantánea en 0ms entre pestañas
export const memoryCache: AppMemoryCache = {
  tasks: [],
  schedules: [],
  subjects: [],
  pendingTasksCount: 0,
  lastUpdated: 0,
  taskDetails: {},
}
