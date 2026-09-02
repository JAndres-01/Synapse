import { supabase } from './personalSupabase'
import { personalStorage } from './personalStorage'
import { syncAllNotifications } from './personalNotifications'
import type { Subject, Schedule, Task } from '@/types/personal'

export interface SyncResult {
  success: boolean
  offline: boolean
  subjectsCount: number
  schedulesCount: number
  tasksCount: number
  error?: string
}

/**
 * Ejecuta una sincronización completa, limpia y segura entre Supabase y el almacenamiento local
 * Si no hay conexión o falla la red, preserva los datos de almacenamiento local y trabaja offline.
 */
export async function syncUserData(userId?: string | null): Promise<SyncResult> {
  if (!userId) {
    const [subjs, scheds, tasks] = await Promise.all([
      personalStorage.getSubjects(),
      personalStorage.getSchedules(),
      personalStorage.getTasks(),
    ])
    return {
      success: true,
      offline: true,
      subjectsCount: subjs.length,
      schedulesCount: scheds.length,
      tasksCount: tasks.length,
    }
  }

  try {
    // 1. Cargar datos locales como respaldo inmediato
    const [cachedSubjs, cachedScheds, cachedTasks] = await Promise.all([
      personalStorage.getSubjects(),
      personalStorage.getSchedules(),
      personalStorage.getTasks(),
    ])

    // 2. Intentar consultar datos frescos de Supabase
    const [subjRes, schedRes, taskRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('user_id', userId),
      supabase.from('schedules').select('*, subject:subjects(*)').eq('user_id', userId),
      supabase.from('tasks').select('*, subject:subjects(*)').eq('user_id', userId),
    ])

    // Si hubo error de red, nos quedamos en modo offline seguro con la caché local
    if (subjRes.error || schedRes.error || taskRes.error) {
      console.log(
        'Sync offline fallback:',
        subjRes.error?.message || schedRes.error?.message || taskRes.error?.message
      )
      await syncAllNotifications(cachedTasks, cachedScheds)
      return {
        success: true,
        offline: true,
        subjectsCount: cachedSubjs.length,
        schedulesCount: cachedScheds.length,
        tasksCount: cachedTasks.length,
      }
    }

    const remoteSubjs = (subjRes.data as Subject[]) || cachedSubjs
    const rawScheds = (schedRes.data as Schedule[]) || cachedScheds
    const rawTasks = (taskRes.data as Task[]) || cachedTasks

    // Resolver materias asociadas para horarios y tareas
    const resolvedScheds = rawScheds.map((s) => {
      const found = remoteSubjs.find((subj) => subj.id === s.subject_id)
      return {
        ...s,
        subject: found || null,
        subject_id: found ? s.subject_id : null,
      }
    })

    const resolvedTasks = rawTasks.map((t) => {
      const found = remoteSubjs.find((subj) => subj.id === t.subject_id)
      return {
        ...t,
        subject: found || null,
        subject_id: found ? t.subject_id : null,
      }
    })

    // 3. Persistir en almacenamiento local (Offline-First)
    await Promise.all([
      personalStorage.setSubjects(remoteSubjs),
      personalStorage.setSchedules(resolvedScheds),
      personalStorage.setTasks(resolvedTasks),
    ])

    // 4. Actualizar recordatorios y notificaciones en segundo plano
    await syncAllNotifications(resolvedTasks, resolvedScheds)

    return {
      success: true,
      offline: false,
      subjectsCount: remoteSubjs.length,
      schedulesCount: resolvedScheds.length,
      tasksCount: resolvedTasks.length,
    }
  } catch (err: any) {
    console.log('Sync network error fallback:', err?.message || err)
    return {
      success: true,
      offline: true,
      subjectsCount: 0,
      schedulesCount: 0,
      tasksCount: 0,
      error: err?.message,
    }
  }
}
