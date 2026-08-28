import type { Task, Schedule, Subject } from '@/types/database'

export interface AppMemoryCache {
  tasks: Task[]
  schedules: Schedule[]
  subjects: Subject[]
  pendingTasksCount: number
  lastUpdated: number
}

// Caché global en memoria compartida para navegación instantánea en 0ms entre pestañas
export const memoryCache: AppMemoryCache = {
  tasks: [],
  schedules: [],
  subjects: [],
  pendingTasksCount: 0,
  lastUpdated: 0,
}
