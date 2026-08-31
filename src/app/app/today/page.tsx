'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import type { Schedule, Task, Subject, TaskType, TaskStatus, AttachmentType } from '@/types/database'
import { LiveClassHeroCard } from '@/components/today/LiveClassHeroCard'
import { UrgentTasksCarousel } from '@/components/today/UrgentTasksCarousel'
import { DayScheduleTimeline } from '@/components/today/DayScheduleTimeline'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { offlineDB } from '@/lib/db'
import { memoryCache, sortTasksChronologically } from '@/lib/cache'
import { Loader2, RefreshCw, Calendar, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function TodayPage() {
  const { user, profile, classroom } = useAuth()
  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>(() => memoryCache.schedules)
  const [urgentTasks, setUrgentTasks] = useState<Task[]>(() => memoryCache.tasks)
  const [subjects, setSubjects] = useState<Subject[]>(() => memoryCache.subjects)
  const [loading, setLoading] = useState(() => memoryCache.tasks.length === 0 && memoryCache.schedules.length === 0)
  const [refreshing, setRefreshing] = useState(false)

  // Modales interactivos directos (Apertura instantánea en 0ms sin saltar de página)
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const supabase = createClient()
  const channelRef = useRef<any>(null)
  const pendingStatusMutationsRef = useRef<Record<string, { status: TaskStatus; timestamp: number }>>({})
  const isAdmin =
    classroom?.created_by === user?.id ||
    profile?.role === 'admin' ||
    (profile?.role as string) === 'delegate'

  // ID de usuario persistente para evitar parpadeos de visibilidad en tareas privadas
  const currentUserId = user?.id || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('synapse_cached_user') || '{}')?.id : null)

  // Obtener día actual (1=Lunes ... 7=Domingo en nuestra BD)
  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day
  }

  // 1. Carga inicial desde Dexie SOLO si memoryCache está vacío (Cold Start)
  useEffect(() => {
    if (!classroom) return

    const loadCachedIfEmpty = async () => {
      if (!offlineDB) return
      try {
        const todayNum = getTodayDayOfWeek()

        if (memoryCache.schedules.length === 0) {
          const cachedSchedules = await offlineDB.schedules
            .where('classroom_id')
            .equals(classroom.id)
            .filter((s) => s.day_of_week === todayNum)
            .toArray()
          if (cachedSchedules.length > 0) {
            setSchedulesToday(cachedSchedules)
            memoryCache.schedules = cachedSchedules
          }
        }

        if (memoryCache.tasks.length === 0) {
          const cachedTasks = await offlineDB.tasks
            .where('classroom_id')
            .equals(classroom.id)
            .toArray()
          if (cachedTasks.length > 0) {
            const sorted = sortTasksChronologically(cachedTasks)
            setUrgentTasks(sorted)
            memoryCache.tasks = sorted
          }
        }

        if (memoryCache.subjects.length === 0) {
          const cachedSubjects = await offlineDB.subjects
            .where('classroom_id')
            .equals(classroom.id)
            .toArray()
          if (cachedSubjects.length > 0) {
            setSubjects(cachedSubjects)
            memoryCache.subjects = cachedSubjects
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Error cargando caché de hoy:', err)
      }
    }

    loadCachedIfEmpty()
  }, [classroom])

  // 2. Carga fresca y revalidación en segundo plano desde Supabase
  const loadTodayData = useCallback(async () => {
    if (!classroom) return

    try {
      const todayNum = getTodayDayOfWeek()

      // A. Cargar Horarios de hoy con información de materias
      const { data: scheduleData, error: schedErr } = await supabase
        .from('schedules')
        .select('*, subject:subjects(*)')
        .eq('classroom_id', classroom.id)
        .eq('day_of_week', todayNum)
        .order('block_number', { ascending: true })

      if (!schedErr && scheduleData) {
        setSchedulesToday(scheduleData as unknown as Schedule[])
        memoryCache.schedules = scheduleData as unknown as Schedule[]
        if (offlineDB && scheduleData.length > 0) {
          const validRecords = scheduleData.filter((s) => !!s && !!s.id)
          if (validRecords.length > 0) {
            await offlineDB.schedules.bulkPut(validRecords as unknown as Schedule[])
          }
        }
      }

      // B. Cargar Tareas (Consulta ligera sin Base64 masivo)
      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .select(`
          id,
          classroom_id,
          created_by,
          title,
          description,
          subject_id,
          type,
          due_date,
          is_private,
          created_at,
          subject:subjects(*),
          user_status:user_task_status(user_id, status, completed_at),
          attachments:task_attachments(id, file_type, file_name)
        `)
        .eq('classroom_id', classroom.id)
        .order('due_date', { ascending: true })

      if (!taskErr && taskData) {
        const mergedTasks = (taskData as unknown as Task[]).map((t) => {
          const pending = pendingStatusMutationsRef.current[t.id]
          if (pending && Date.now() - pending.timestamp < 4000 && user) {
            const filtered = (t.user_status || []).filter((s) => s.user_id !== user.id)
            return {
              ...t,
              user_status: [
                ...filtered,
                {
                  id: 'pending-mut-' + t.id,
                  user_id: user.id,
                  task_id: t.id,
                  status: pending.status,
                  completed_at: pending.status === 'completed' ? new Date().toISOString() : null,
                },
              ],
            }
          }
          return t
        })
        const sorted = sortTasksChronologically(mergedTasks)
        setUrgentTasks(sorted)
        memoryCache.tasks = sorted

        // Sincronizar modal de detalles en tiempo real si está abierto
        setSelectedTaskForDetail((current) => {
          if (!current) return null
          return sorted.find((t) => t.id === current.id) || current
        })

        if (offlineDB && sorted.length > 0) {
          const validTasks = sorted.filter((t) => !!t && !!t.id)
          if (validTasks.length > 0) {
            await offlineDB.tasks.bulkPut(validTasks as unknown as Task[])
          }
        }
      }

      // C. Cargar Materias
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('classroom_id', classroom.id)

      if (subjectsData) {
        setSubjects(subjectsData as Subject[])
        memoryCache.subjects = subjectsData as Subject[]
      }
    } catch (err) {
      console.error('Error sincronizando datos de hoy:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [classroom, supabase])

  useEffect(() => {
    loadTodayData()

    if (!classroom) return

    const channelName = `classroom_room_${classroom.id}`
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { ack: false, self: false },
        },
      })
      .on('broadcast', { event: 'tasks_updated' }, () => {
        loadTodayData()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => loadTodayData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `classroom_id=eq.${classroom.id}` },
        () => loadTodayData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_task_status' },
        () => loadTodayData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments' },
        () => loadTodayData()
      )
      .subscribe()

    // Sincronización inteligente al volver a enfocar la app (con throttle de 60s)
    let lastFocusSync = Date.now()
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFocusSync > 60000) {
        lastFocusSync = Date.now()
        loadTodayData()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [classroom, loadTodayData, supabase])

  // Pull to Refresh manual
  const handleManualRefresh = () => {
    setRefreshing(true)
    loadTodayData()
  }

  // Alternar estado de tarea completada / pendiente
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user) return
    const newStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    const nowIso = new Date().toISOString()

    // Registrar mutación activa en ref para evitar que llamadas de red obsoletas desmarquen la tarea
    pendingStatusMutationsRef.current[taskId] = { status: newStatus, timestamp: Date.now() }

    // Actualización optimista en interfaz y en caché
    setUrgentTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === taskId) {
          const filtered = (t.user_status || []).filter((s) => s.user_id !== user.id)
          return {
            ...t,
            user_status: [
              ...filtered,
              { id: 'temp-' + Date.now(), user_id: user.id, task_id: taskId, status: newStatus, completed_at: nowIso },
            ],
          }
        }
        return t
      })
      memoryCache.tasks = updated
      return updated
    })

    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail((prev) => {
        if (!prev) return null
        const filtered = (prev.user_status || []).filter((s) => s.user_id !== user.id)
        return {
          ...prev,
          user_status: [
            ...filtered,
            { id: 'temp-' + Date.now(), user_id: user.id, task_id: taskId, status: newStatus, completed_at: nowIso },
          ],
        }
      })
    }

    try {
      await supabase.from('user_task_status').upsert(
        {
          user_id: user.id,
          task_id: taskId,
          status: newStatus,
          completed_at: newStatus === 'completed' ? nowIso : null,
        },
        { onConflict: 'user_id,task_id' }
      )
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tasks_updated'))
      }
      // Limpiar bloqueo tras confirmar tiempo de propagación
      setTimeout(() => {
        if (pendingStatusMutationsRef.current[taskId]?.timestamp) {
          delete pendingStatusMutationsRef.current[taskId]
        }
      }, 2500)
    } catch (err) {
      console.error('Error actualizando estado de tarea:', err)
      delete pendingStatusMutationsRef.current[taskId]
      loadTodayData()
    }
  }

  // Eliminar tarea desde Today
  const handleDeleteTask = async (taskId: string) => {
    try {
      setUrgentTasks((prev) => {
        const filtered = prev.filter((t) => t.id !== taskId)
        memoryCache.tasks = filtered
        return filtered
      })
      setSelectedTaskForDetail(null)

      await supabase.from('tasks').delete().eq('id', taskId)
      if (offlineDB) {
        await offlineDB.tasks.delete(taskId)
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tasks_updated'))
      }
    } catch (err) {
      console.error('Error eliminando tarea:', err)
      loadTodayData()
    }
  }

  // Guardar tarea editada con actualización optimista instantánea (0ms)
  const handleUpdateTask = async (
    taskId: string,
    taskData: {
      title: string
      description?: string
      subject_id?: string | null
      type: TaskType
      due_date: string
      attachments?: Array<{ file_name: string; file_url: string; file_type: AttachmentType }>
    }
  ) => {
    if (!user) return

    const selectedSubject = subjects.find((s) => s.id === taskData.subject_id)

    // 1. Actualización Optimista Instantánea (0ms)
    setUrgentTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            title: taskData.title,
            description: taskData.description || null,
            subject_id: taskData.subject_id || null,
            subject: selectedSubject || t.subject,
            type: taskData.type,
            due_date: taskData.due_date || t.due_date,
            attachments: taskData.attachments
              ? taskData.attachments.map((a, i) => ({
                  id: `att-temp-${i}`,
                  task_id: taskId,
                  uploaded_by: user.id,
                  file_type: a.file_type,
                  file_url: a.file_url,
                  file_name: a.file_name,
                  created_at: new Date().toISOString(),
                }))
              : t.attachments,
          }
        }
        return t
      })
      const sorted = sortTasksChronologically(updated)
      memoryCache.tasks = sorted
      return sorted
    })

    setSelectedTaskForDetail((current) => {
      if (!current || current.id !== taskId) return current
      return {
        ...current,
        title: taskData.title,
        description: taskData.description || null,
        subject_id: taskData.subject_id || null,
        subject: selectedSubject || current.subject,
        type: taskData.type,
        due_date: taskData.due_date || current.due_date,
      }
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tasks_updated'))
    }

    // 2. Persistencia en Supabase
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: taskData.title,
          description: taskData.description || null,
          subject_id: taskData.subject_id || null,
          type: taskData.type,
          due_date: taskData.due_date || null,
        })
        .eq('id', taskId)

      if (error) throw error

      if (taskData.attachments && taskData.attachments.length > 0) {
        await supabase.from('task_attachments').delete().eq('task_id', taskId)

        const rowsToInsert = taskData.attachments.map((att) => ({
          task_id: taskId,
          uploaded_by: user.id,
          file_type: att.file_type,
          file_url: att.file_url,
          file_name: att.file_name,
        }))

        await supabase.from('task_attachments').insert(rowsToInsert)
      }

      channelRef.current?.send({
        type: 'broadcast',
        event: 'tasks_updated',
        payload: { taskId },
      })
    } catch (err) {
      console.error('Error actualizando tarea:', err)
      loadTodayData()
      throw err
    }
  }

  const todayDate = useMemo(() => {
    return new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }, [])

  const tasksThisWeek = useMemo(() => {
    const now = new Date()
    const currentDayOfWeek = now.getDay() || 7 // 1=Lun ... 7=Dom

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - (currentDayOfWeek - 1))
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    return urgentTasks.filter((t) => {
      if (t.is_private && (!currentUserId || t.created_by !== currentUserId)) return false
      if (!t.due_date) return false
      const dueDate = new Date(t.due_date)
      return dueDate >= startOfWeek && dueDate <= endOfWeek
    })
  }, [urgentTasks, currentUserId])

  const tasksTodayForTimeline = useMemo(() => {
    const todayStr = new Date().toDateString()
    return urgentTasks.filter((t) => {
      if (t.is_private && (!currentUserId || t.created_by !== currentUserId)) return false
      if (!t.due_date) return false
      return new Date(t.due_date).toDateString() === todayStr
    })
  }, [urgentTasks, currentUserId])

  if (loading && urgentTasks.length === 0 && schedulesToday.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-3.5">
      {/* Header Principal */}
      <header className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 capitalize block">
            {todayDate}
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>¡Hola, {profile?.full_name?.split(' ')[0] || 'Estudiante'}!</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </h1>
          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
            {classroom?.name}
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          aria-label="Actualizar datos"
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </header>

      {/* Banner de Salón Nuevo (si es delegado y aún no tiene clases hoy) */}
      {isAdmin && schedulesToday.length === 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 space-y-2">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Configura el horario de tu salón</span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            Eres delegado de este salón. Ve a la pestaña **Horario** para añadir las materias del semestre y configurar las 4 clases diarias.
          </p>
          <Link
            href="/app/schedule"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 pt-1"
          >
            <span>Configurar Horario ahora</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* 1. Hero Card en Tiempo Real (Las 4 Clases y Clase Activa) */}
      <LiveClassHeroCard schedulesToday={schedulesToday} />

      {/* 2. Carrusel de Tareas para Esta Semana (Lunes a Domingo) */}
      <UrgentTasksCarousel
        tasks={tasksThisWeek}
        currentUserId={currentUserId}
        onToggleTaskStatus={handleToggleTaskStatus}
        onOpenDetail={(task) => setSelectedTaskForDetail(task)}
      />

      {/* 3. Cronograma de las 4 Clases de Hoy con Tareas Integradas */}
      <DayScheduleTimeline
        schedulesToday={schedulesToday}
        tasksToday={tasksTodayForTimeline}
        currentUserId={currentUserId}
        onToggleTaskStatus={handleToggleTaskStatus}
        onOpenDetail={(task) => setSelectedTaskForDetail(task)}
      />

      {/* Modal de Detalle de Tarea (Apertura Instantánea en 0ms en Today) */}
      <TaskDetailModal
        task={selectedTaskForDetail}
        onClose={() => setSelectedTaskForDetail(null)}
        currentUser={user}
        currentProfile={profile}
        isAdmin={isAdmin}
        onToggleStatus={handleToggleTaskStatus}
        onDeleteTask={handleDeleteTask}
        onEditTask={(t) => {
          setSelectedTaskForDetail(null)
          setTaskToEdit(t)
          setShowCreateModal(true)
        }}
      />

      {/* Modal para Editar Tarea si el delegado lo solicita desde Today */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setTaskToEdit(null)
          setSelectedTaskForDetail(null)
        }}
        subjects={subjects}
        schedules={schedulesToday}
        defaultMode="classroom"
        isAdmin={isAdmin}
        initialTask={taskToEdit}
        onSaveTask={async () => {}}
        onUpdateTask={async (taskId, taskData) => {
          await handleUpdateTask(taskId, taskData)
          setShowCreateModal(false)
          setTaskToEdit(null)
          setSelectedTaskForDetail(null)
        }}
      />
    </div>
  )
}
