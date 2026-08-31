'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import type { Task, Subject, TaskType, TaskStatus, Schedule, AttachmentType, TaskAttachment } from '@/types/database'
import { TaskCard } from '@/components/tasks/TaskCard'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { TasksSkeleton } from '@/components/tasks/TasksSkeleton'
import { offlineDB } from '@/lib/db'
import { memoryCache, sortTasksChronologically } from '@/lib/cache'
import {
  CheckSquare,
  Plus,
  School,
  Lock,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronDown,
} from 'lucide-react'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Helper para verificar si una tarea está completada por el usuario
const isTaskCompleted = (t: Task, userId?: string): boolean => {
  const statuses = t.user_status || (t as unknown as { user_task_status?: Array<{ status: string; user_id: string }> }).user_task_status
  if (!statuses) return false
  if (Array.isArray(statuses)) {
    return statuses.some((s) => s.status === 'completed' && (!userId || s.user_id === userId))
  }
  return Boolean(statuses && (statuses as { status?: string }).status === 'completed')
}

// Helper para obtener la fecha de completado
const getTaskCompletedDate = (t: Task, userId?: string): Date | null => {
  const statuses = t.user_status || (t as unknown as { user_task_status?: Array<{ status: string; user_id: string; completed_at?: string }> }).user_task_status
  if (!statuses) return null
  if (Array.isArray(statuses)) {
    const match = statuses.find((s) => s.status === 'completed' && (!userId || s.user_id === userId))
    return match?.completed_at ? new Date(match.completed_at) : null
  }
  const statusObj = statuses as { completed_at?: string }
  return statusObj?.completed_at ? new Date(statusObj.completed_at) : null
}

function TasksPageContent() {
  const { user, profile, classroom } = useAuth()
  const [tasks, setTasks] = useState<Task[]>(() => memoryCache.tasks)
  const [subjects, setSubjects] = useState<Subject[]>(() => memoryCache.subjects)
  const [schedules, setSchedules] = useState<Schedule[]>(() => memoryCache.schedules)
  const [loading, setLoading] = useState(() => memoryCache.tasks.length === 0 && memoryCache.subjects.length === 0)
  const [refreshing, setRefreshing] = useState(false)

  // 1. Selector de Panel Principal: "classroom" (Del Salón) vs "private" (Mis Pendientes)
  const [activeTab, setActiveTab] = useState<'classroom' | 'private'>('classroom')

  // 2. Filtros secundarios: Estado y Materia
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')

  // 3. Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  const supabase = createClient()
  const channelRef = useRef<any>(null)
  const pendingStatusMutationsRef = useRef<Record<string, { status: TaskStatus; timestamp: number }>>({})
  const isAdmin =
    classroom?.created_by === user?.id ||
    profile?.role === 'admin' ||
    (profile?.role as string) === 'delegate'

  const canCreateInActiveTab = activeTab === 'private' || isAdmin

  const searchParams = useSearchParams()
  const taskIdParam = searchParams ? searchParams.get('taskId') : null

  // 1. Carga instantánea desde Dexie IndexedDB (0ms) SOLO si memoryCache está vacío
  useEffect(() => {
    if (!classroom) return

    const loadCachedInstantly = async () => {
      if (!offlineDB) return
      try {
        if (memoryCache.tasks.length === 0) {
          const cachedTasks = await offlineDB.tasks.where('classroom_id').equals(classroom.id).toArray()
          if (cachedTasks.length > 0) {
            const sorted = sortTasksChronologically(cachedTasks)
            setTasks(sorted)
            memoryCache.tasks = sorted
          }
        }

        if (memoryCache.subjects.length === 0) {
          const cachedSubjects = await offlineDB.subjects.where('classroom_id').equals(classroom.id).toArray()
          if (cachedSubjects.length > 0) {
            setSubjects(cachedSubjects)
            memoryCache.subjects = cachedSubjects
          }
        }

        if (memoryCache.schedules.length === 0) {
          const cachedSchedules = await offlineDB.schedules.where('classroom_id').equals(classroom.id).toArray()
          if (cachedSchedules.length > 0) {
            setSchedules(cachedSchedules)
            memoryCache.schedules = cachedSchedules
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Error cargando caché de tareas:', err)
      }
    }

    loadCachedInstantly()
  }, [classroom])

  // Abrir automáticamente el modal de detalle si viene taskId en la URL
  useEffect(() => {
    if (taskIdParam && tasks.length > 0) {
      const match = tasks.find((t) => t.id === taskIdParam)
      if (match) {
        setSelectedTaskForDetail(match)
        if (match.is_private) {
          setActiveTab('private')
        } else {
          setActiveTab('classroom')
        }
      }
    }
  }, [taskIdParam, tasks])

  // 2. Cargar Tareas, Materias y Horarios desde Supabase
  const loadTasksData = useCallback(async () => {
    if (!classroom || !user) return

    try {
      // 1. Cargar Materias
      const { data: subjectData } = await supabase
        .from('subjects')
        .select('*')
        .eq('classroom_id', classroom.id)
        .order('name', { ascending: true })

      if (subjectData) {
        setSubjects(subjectData as Subject[])
        if (offlineDB && subjectData.length > 0) {
          await offlineDB.subjects.bulkPut(subjectData as Subject[])
        }
      }

      // 2. Cargar Horarios de la semana para el preset
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, subject:subjects(*)')
        .eq('classroom_id', classroom.id)
        .order('block_number', { ascending: true })

      if (scheduleData) {
        setSchedules(scheduleData as Schedule[])
        if (offlineDB && scheduleData.length > 0) {
          const validScheds = scheduleData.filter((s) => !!s && !!s.id)
          if (validScheds.length > 0) {
            await offlineDB.schedules.bulkPut(validScheds as Schedule[])
          }
        }
      }

      // 3. Cargar Tareas con sus relaciones (Consulta ligera sin Base64 masivo)
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
        setTasks(sorted)
        memoryCache.tasks = sorted

        // Sincronizar modal de detalles en tiempo real (0ms)
        setSelectedTaskForDetail((current) => {
          if (!current) return null
          return sorted.find((t) => t.id === current.id) || current
        })

        if (offlineDB && sorted.length > 0) {
          const validTasks = sorted.filter((t) => !!t && !!t.id)
          if (validTasks.length > 0) {
            await offlineDB.tasks.bulkPut(validTasks)
          }
        }
      }
    } catch (err) {
      console.error('Error sincronizando tareas:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [classroom, user, supabase])

  // Carga inicial y suscripción Realtime en vivo (Broadcast + Postgres Changes + Polling de respaldo)
  useEffect(() => {
    loadTasksData()

    if (!classroom) return

    const channelName = `classroom_room_${classroom.id}`
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { ack: false, self: false },
        },
      })
      .on('broadcast', { event: 'tasks_updated' }, () => {
        loadTasksData()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => loadTasksData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_task_status' },
        () => loadTasksData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments' },
        () => loadTasksData()
      )
      .subscribe()

    // Sincronización inteligente al volver a enfocar la app (con throttle de 60s)
    let lastFocusSync = Date.now()
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFocusSync > 60000) {
        lastFocusSync = Date.now()
        loadTasksData()
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
  }, [classroom, loadTasksData, supabase])

  // Pull to Refresh manual
  const handleManualRefresh = () => {
    setRefreshing(true)
    loadTasksData()
  }

  // Alternar completado / pendiente de una tarea
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user) return
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    const nowIso = new Date().toISOString()

    // Registrar mutación activa en ref para evitar que llamadas de red obsoletas desmarquen la tarea
    pendingStatusMutationsRef.current[taskId] = { status: newStatus, timestamp: Date.now() }

    // Actualización optimista instantánea
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const filtered = (t.user_status || []).filter((s) => s.user_id !== user.id)
          return {
            ...t,
            user_status: [
              ...filtered,
              {
                id: 'temp-' + Date.now(),
                user_id: user.id,
                task_id: taskId,
                status: newStatus,
                completed_at: newStatus === 'completed' ? nowIso : null,
              },
            ],
          }
        }
        return t
      })
    )

    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail((prev) => {
        if (!prev) return null
        const filtered = (prev.user_status || []).filter((s) => s.user_id !== user.id)
        return {
          ...prev,
          user_status: [
            ...filtered,
            {
              id: 'temp-' + Date.now(),
              user_id: user.id,
              task_id: taskId,
              status: newStatus,
              completed_at: newStatus === 'completed' ? nowIso : null,
            },
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
      setTimeout(() => {
        if (pendingStatusMutationsRef.current[taskId]?.timestamp) {
          delete pendingStatusMutationsRef.current[taskId]
        }
      }, 2500)
    } catch (err) {
      console.error('Error actualizando estado:', err)
      delete pendingStatusMutationsRef.current[taskId]
      loadTasksData()
    }
  }

  // Guardar nueva tarea (Del Salón o Mis Pendientes) con renderizado optimista instantáneo (0ms)
  const handleSaveTask = async (taskData: {
    title: string
    description?: string
    subject_id?: string | null
    type: TaskType
    due_date: string
    is_private: boolean
    attachments?: Array<{ file_name: string; file_url: string; file_type: AttachmentType }>
  }) => {
    // Obtener sesión activa y salón garantizados
    const { data: sessionData } = await supabase.auth.getSession()
    const activeUserId = user?.id || sessionData?.session?.user?.id || (typeof window !== 'undefined' ? (() => {
      try { return JSON.parse(localStorage.getItem('synapse_cached_user') || '{}')?.id } catch { return null }
    })() : null)

    const activeClassroomId = classroom?.id || (typeof window !== 'undefined' ? (() => {
      try { return JSON.parse(localStorage.getItem('synapse_active_classroom') || '{}')?.id } catch { return null }
    })() : null)

    if (!activeClassroomId || !activeUserId) {
      throw new Error('No se encontró salón o usuario autenticado para guardar la tarea.')
    }

    const tempId = 'temp-' + Date.now()
    const nowIso = new Date().toISOString()
    const selectedSubject = subjects.find((s) => s.id === taskData.subject_id)

    // 1. Inyección Optimista Instantánea (0ms)
    const optimisticTask: Task = {
      id: tempId,
      classroom_id: activeClassroomId,
      created_by: activeUserId,
      subject_id: taskData.subject_id || null,
      title: taskData.title,
      description: taskData.description || null,
      type: taskData.type,
      due_date: taskData.due_date || nowIso,
      is_private: taskData.is_private,
      created_at: nowIso,
      subject: selectedSubject || undefined,
      attachments: (taskData.attachments || []).map((a, i) => ({
        id: `att-temp-${i}`,
        task_id: tempId,
        uploaded_by: activeUserId,
        file_type: a.file_type,
        file_url: a.file_url,
        file_name: a.file_name,
        created_at: nowIso,
      })),
      user_status: [],
    }

    setTasks((prev) => {
      const updated = sortTasksChronologically([optimisticTask, ...prev])
      memoryCache.tasks = updated
      return updated
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tasks_updated'))
    }

    // 2. Persistencia asíncrona en Supabase
    try {
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          classroom_id: activeClassroomId,
          created_by: activeUserId,
          subject_id: taskData.subject_id || null,
          title: taskData.title,
          description: taskData.description || null,
          type: taskData.type,
          due_date: taskData.due_date || null,
          is_private: taskData.is_private,
        })
        .select('*, subject:subjects(*)')
        .single()

      if (error || !newTask) {
        throw new Error(error?.message || 'No se pudo crear la tarea')
      }

      if (taskData.attachments && taskData.attachments.length > 0) {
        const rowsToInsert = taskData.attachments.map((att) => ({
          task_id: newTask.id,
          uploaded_by: activeUserId,
          file_type: att.file_type,
          file_url: att.file_url,
          file_name: att.file_name,
        }))

        await supabase.from('task_attachments').insert(rowsToInsert)
      }

      if (offlineDB && newTask) {
        await offlineDB.tasks.put(newTask as Task)
      }

      // Reconciliar id temporal con el id real de la base de datos
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? { ...t, ...newTask } : t))
      )

      channelRef.current?.send({
        type: 'broadcast',
        event: 'tasks_updated',
        payload: { taskId: newTask.id },
      })
    } catch (err) {
      console.error('Error creando tarea:', err)
      setTasks((prev) => prev.filter((t) => t.id !== tempId))
      throw err
    }
  }

  // Actualizar tarea existente (Editar) con actualización optimista instantánea (0ms)
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
    const { data: sessionData } = await supabase.auth.getSession()
    const activeUserId = user?.id || sessionData?.session?.user?.id || (typeof window !== 'undefined' ? (() => {
      try { return JSON.parse(localStorage.getItem('synapse_cached_user') || '{}')?.id } catch { return null }
    })() : null)

    if (!activeUserId) return

    const selectedSubject = subjects.find((s) => s.id === taskData.subject_id)

    // 1. Actualización Optimista Instantánea (0ms)
    setTasks((prev) => {
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
                  uploaded_by: activeUserId,
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
          uploaded_by: activeUserId,
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
      loadTasksData()
      throw err
    }
  }

  // Eliminar tarea permanentemente
  const handleDeleteTask = async (taskId: string) => {
    try {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
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
      loadTasksData()
    }
  }

  // Filtrado y Ordenamiento Determinista de Tareas (0ms layout shifts)
  const filteredTasks = React.useMemo(() => {
    const list = tasks.filter((t) => {
      // 1. Filtro por Ámbito
      if (activeTab === 'classroom') {
        if (t.is_private) return false
      } else {
        if (!t.is_private) return false
        if (t.created_by !== user?.id) return false
      }

      // 2. Filtro por Estado y Retención de 7 Días
      const completed = isTaskCompleted(t, user?.id)

      if (completed) {
        const completedDate = getTaskCompletedDate(t, user?.id)
        if (completedDate) {
          const timeDiff = Date.now() - completedDate.getTime()
          if (timeDiff > SEVEN_DAYS_MS) {
            return false
          }
        }
      }

      if (statusFilter === 'pending' && completed) return false
      if (statusFilter === 'completed' && !completed) return false

      // 3. Filtro por Materia
      if (selectedSubjectId !== 'all') {
        if (t.subject_id !== selectedSubjectId) return false
      }

      return true
    })

    return sortTasksChronologically(list)
  }, [tasks, activeTab, user?.id, statusFilter, selectedSubjectId])

  // Contadores para las pestañas principales
  const classroomTasksCount = tasks.filter(
    (t) => !t.is_private && !isTaskCompleted(t, user?.id)
  ).length

  const privateTasksCount = tasks.filter(
    (t) => t.is_private && t.created_by === user?.id && !isTaskCompleted(t, user?.id)
  ).length

  if (loading && tasks.length === 0) {
    return <TasksSkeleton />
  }

  return (
    <div className="flex flex-col space-y-3 pb-24">
      {/* Header Principal */}
      <header className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Tareas</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {activeTab === 'classroom'
              ? 'Entregas y evaluaciones grupales'
              : 'Notas y recordatorios personales'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          aria-label="Actualizar tareas"
          className="w-8 h-8 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-zinc-200' : ''}`} />
        </button>
      </header>

      {/* 1. Selector de Ámbito: Tareas del Salón vs Mis Pendientes con Colores de Acento */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-950 border border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('classroom')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition-all ${
            activeTab === 'classroom'
              ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30 shadow-xs font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 border-transparent bg-transparent'
          }`}
        >
          <School className={`w-3.5 h-3.5 ${activeTab === 'classroom' ? 'text-indigo-400' : 'text-zinc-500'}`} />
          <span>Del Salón</span>
          {classroomTasksCount > 0 && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                activeTab === 'classroom'
                  ? 'bg-indigo-500/25 text-indigo-200 border-indigo-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              {classroomTasksCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('private')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition-all ${
            activeTab === 'private'
              ? 'bg-amber-500/15 text-amber-200 border-amber-500/30 shadow-xs font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 border-transparent bg-transparent'
          }`}
        >
          <Lock className={`w-3.5 h-3.5 ${activeTab === 'private' ? 'text-amber-400' : 'text-zinc-500'}`} />
          <span>Mis Pendientes</span>
          {privateTasksCount > 0 && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                activeTab === 'private'
                  ? 'bg-amber-500/25 text-amber-200 border-amber-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              {privateTasksCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. Filtros: Estados arriba y Materias abajo */}
      <div className="space-y-2 pt-0.5">
        {/* Píldoras de Estado */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
          {(['pending', 'completed', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                statusFilter === st
                  ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {st === 'pending'
                ? 'Pendientes'
                : st === 'completed'
                ? 'Completadas'
                : 'Todas'}
            </button>
          ))}
        </div>

        {/* Dropdown Materias abajo de los filtros de estado */}
        {subjects.length > 0 && (
          <div className="relative w-full">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full appearance-none text-xs py-2 pl-3 pr-8 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-zinc-600 font-medium transition-colors"
            >
              <option value="all">Todas las materias</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        )}
      </div>

      {/* 3. Lista de Tareas Minimalista */}
      <div className="pt-1">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center space-y-2 text-zinc-500">
            <p className="text-xs">
              {statusFilter === 'completed'
                ? 'No hay tareas completadas recientemente'
                : activeTab === 'classroom'
                ? 'No hay tareas del salón pendientes'
                : 'No tienes pendientes personales'}
            </p>
            {canCreateInActiveTab && (
              <button
                type="button"
                onClick={() => {
                  setTaskToEdit(null)
                  setShowCreateModal(true)
                }}
                className="text-xs text-zinc-300 hover:text-white font-medium underline underline-offset-4"
              >
                {activeTab === 'classroom' ? 'Crear tarea' : 'Crear pendiente'}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-900/80">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id}
                onToggleStatus={handleToggleTaskStatus}
                onOpenDetail={(t) => setSelectedTaskForDetail(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Botón Flotante para Crear Tarea / Pendiente (Ubicado encima del island nav bar) */}
      {canCreateInActiveTab && (
        <button
          type="button"
          onClick={() => {
            setTaskToEdit(null)
            setShowCreateModal(true)
          }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] right-4 z-30 py-2.5 px-4 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 font-semibold text-xs flex items-center gap-1.5 shadow-xl shadow-black/50 border border-zinc-200 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{activeTab === 'private' ? 'Nuevo Pendiente' : 'Nueva Tarea'}</span>
        </button>
      )}

      {/* 5. Modal para Crear o Editar Tarea */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setTaskToEdit(null)
          setSelectedTaskForDetail(null)
        }}
        subjects={subjects}
        schedules={schedules}
        defaultMode={activeTab}
        isAdmin={isAdmin}
        initialTask={taskToEdit}
        onSaveTask={handleSaveTask}
        onUpdateTask={async (taskId, taskData) => {
          await handleUpdateTask(taskId, taskData)
          setShowCreateModal(false)
          setTaskToEdit(null)
          setSelectedTaskForDetail(null)
        }}
      />

      {/* 6. Modal de Detalle de Tarea con Hilos & Fotos de Apuntes */}
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
    </div>
  )
}

export default function TasksPage() {
  return (
    <React.Suspense fallback={<TasksSkeleton />}>
      <TasksPageContent />
    </React.Suspense>
  )
}
