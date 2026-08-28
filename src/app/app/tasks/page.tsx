'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import type { Task, Subject, TaskType, Schedule, AttachmentType, TaskAttachment, TaskComment } from '@/types/database'
import { TaskCard } from '@/components/tasks/TaskCard'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'
import { offlineDB } from '@/lib/db'
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

export default function TasksPage() {
  const { user, profile, classroom } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
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
  const isAdmin =
    classroom?.created_by === user?.id ||
    profile?.role === 'admin' ||
    (profile?.role as string) === 'delegate'

  const canCreateInActiveTab = activeTab === 'private' || isAdmin

  // Cargar Tareas, Materias y Horarios
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
      }

      // 2. Cargar Horarios de la semana para el preset
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, subject:subjects(*)')
        .eq('classroom_id', classroom.id)
        .order('block_number', { ascending: true })

      if (scheduleData) {
        setSchedules(scheduleData as unknown as Schedule[])
      }

      // 3. Cargar Tareas con fallback inteligente
      let loadedTasks: Task[] = []

      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .select(`
          *,
          subject:subjects(*),
          attachments:task_attachments(*),
          user_status:user_task_status(*),
          comments:task_comments(*, author:profiles(*))
        `)
        .eq('classroom_id', classroom.id)
        .order('due_date', { ascending: true })

      if (!taskErr && taskData) {
        loadedTasks = taskData as unknown as Task[]
      } else {
        const { data: fallbackData } = await supabase
          .from('tasks')
          .select(`
            *,
            subject:subjects(*),
            attachments:task_attachments(*),
            user_status:user_task_status(*)
          `)
          .eq('classroom_id', classroom.id)
          .order('due_date', { ascending: true })

        if (fallbackData) {
          loadedTasks = fallbackData as unknown as Task[]
        }
      }

      // 4. Limpieza de tareas completadas hace más de 7 días
      const now = Date.now()
      const expiredTaskIds: string[] = []

      const activeTasks = loadedTasks.filter((t) => {
        const isComp = isTaskCompleted(t, user.id)
        if (!isComp) return true
        const compDate = getTaskCompletedDate(t, user.id)
        if (compDate && now - compDate.getTime() > SEVEN_DAYS_MS) {
          expiredTaskIds.push(t.id)
          return false
        }
        return true
      })

      setTasks(activeTasks)

      if (offlineDB && activeTasks.length > 0) {
        const validTasks = activeTasks.filter((t) => !!t && !!t.id)
        if (validTasks.length > 0) {
          await offlineDB.tasks.bulkPut(validTasks as unknown as Task[])
        }
      }

      // Eliminar registros expirados de más de 7 días en segundo plano
      if (expiredTaskIds.length > 0) {
        for (const expId of expiredTaskIds) {
          supabase.from('tasks').delete().eq('id', expId).eq('created_by', user.id).then(() => {})
          supabase.from('user_task_status').delete().eq('task_id', expId).eq('user_id', user.id).then(() => {})
          offlineDB?.tasks.delete(expId)
        }
      }
    } catch (err) {
      console.error('Error cargando tareas:', err)
      if (offlineDB && classroom) {
        const cached = await offlineDB.tasks
          .where('classroom_id')
          .equals(classroom.id)
          .toArray()
        if (cached.length > 0) setTasks(cached)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [classroom, user, supabase])

  useEffect(() => {
    loadTasksData()

    if (!classroom) return

    const channel = supabase
      .channel(`public:tasks_room:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => loadTasksData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments' },
        () => loadTasksData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroom, loadTasksData, supabase])

  useEffect(() => {
    if (selectedTaskForDetail) {
      const updated = tasks.find((t) => t.id === selectedTaskForDetail.id)
      if (updated) setSelectedTaskForDetail(updated)
    }
  }, [tasks, selectedTaskForDetail])

  // Alternar completada / pendiente
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user) return
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    const nowIso = new Date().toISOString()

    // Actualización optimista inmediata
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const currentStatuses = t.user_status || []
          const filtered = currentStatuses.filter((s) => s.user_id !== user.id)
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
    } catch (err) {
      console.error('Error actualizando estado de tarea:', err)
      loadTasksData()
    }
  }

  const handleSaveTask = async (taskData: {
    title: string
    description?: string
    subject_id?: string | null
    type: TaskType
    due_date: string
    is_private: boolean
    attachments?: Array<{ file_name: string; file_url: string; file_type: AttachmentType }>
  }) => {
    if (!classroom || !user) return

    const payload: Record<string, unknown> = {
      classroom_id: classroom.id,
      created_by: user.id,
      title: taskData.title,
      description: taskData.description || null,
      type: taskData.type,
      due_date: taskData.due_date,
      is_private: taskData.is_private,
    }

    if (taskData.subject_id) {
      payload.subject_id = taskData.subject_id
    }

    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('*, subject:subjects(*), attachments:task_attachments(*), user_status:user_task_status(*)')
      .single()

    if (!error && newTask) {
      if (taskData.attachments && taskData.attachments.length > 0) {
        const attachPayload = taskData.attachments.map((att) => ({
          task_id: newTask.id,
          uploaded_by: user.id,
          file_type: att.file_type,
          file_url: att.file_url,
          file_name: att.file_name,
        }))
        const { data: savedAttachments } = await supabase
          .from('task_attachments')
          .insert(attachPayload)
          .select('*')

        if (savedAttachments) {
          ;(newTask as unknown as Task).attachments = savedAttachments as unknown as TaskAttachment[]
        }
      }

      setTasks((prev) => [newTask as unknown as Task, ...prev])
      if (offlineDB) {
        await offlineDB.tasks.put(newTask as unknown as Task)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tasks_updated'))
      }
    } else {
      console.error('Error insertando tarea:', error)
      loadTasksData()
    }
  }

  const handleUpdateTask = async (
    taskId: string,
    taskData: {
      title: string
      description?: string
      subject_id?: string | null
      type: TaskType
      due_date: string
      is_private: boolean
      attachments?: Array<{ file_name: string; file_url: string; file_type: AttachmentType }>
    }
  ) => {
    if (!user) return

    const payload: Record<string, unknown> = {
      title: taskData.title,
      description: taskData.description || null,
      type: taskData.type,
      due_date: taskData.due_date,
      is_private: taskData.is_private,
      subject_id: taskData.subject_id || null,
    }

    const { data: updated, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
      .select('*, subject:subjects(*), attachments:task_attachments(*), user_status:user_task_status(*), comments:task_comments(*, author:profiles(*))')
      .single()

    if (!error && updated) {
      if (taskData.attachments) {
        await supabase.from('task_attachments').delete().eq('task_id', taskId)

        if (taskData.attachments.length > 0) {
          const attachPayload = taskData.attachments.map((att) => ({
            task_id: taskId,
            uploaded_by: user.id,
            file_type: att.file_type,
            file_url: att.file_url,
            file_name: att.file_name,
          }))
          const { data: updatedAttachments } = await supabase
            .from('task_attachments')
            .insert(attachPayload)
            .select('*')

          if (updatedAttachments) {
            ;(updated as unknown as Task).attachments = updatedAttachments as unknown as TaskAttachment[]
          }
        } else {
          ;(updated as unknown as Task).attachments = []
        }
      }

      setTasks((prev) => prev.map((t) => (t.id === taskId ? (updated as unknown as Task) : t)))
      if (selectedTaskForDetail?.id === taskId) {
        setSelectedTaskForDetail(updated as unknown as Task)
      }
      if (offlineDB) {
        await offlineDB.tasks.put(updated as unknown as Task)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tasks_updated'))
      }
    } else {
      console.error('Error actualizando tarea:', error)
      loadTasksData()
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (offlineDB) {
        await offlineDB.tasks.delete(taskId)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tasks_updated'))
      }
    }
  }

  const handleAddComment = async (
    taskId: string,
    content: string,
    parentCommentId?: string | null,
    imageUrl?: string | null,
    fileName?: string | null,
    fileType?: AttachmentType | null
  ) => {
    if (!user) return

    const { data: newComment, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: user.id,
        content: content || '',
        parent_comment_id: parentCommentId || null,
        image_url: imageUrl || null,
      })
      .select('*, author:profiles(*)')
      .single()

    if (!error && newComment) {
      if (fileName) {
        ;(newComment as unknown as TaskComment).file_name = fileName
      }
      if (fileType) {
        ;(newComment as unknown as TaskComment).file_type = fileType
      }
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              comments: [...(t.comments || []), newComment as unknown as TaskComment],
            }
          }
          return t
        })
      )
    } else {
      loadTasksData()
    }
  }

  // Filtrado de Tareas
  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'classroom') {
      if (t.is_private) return false
    } else {
      if (!t.is_private) return false
      if (t.created_by !== user?.id) return false
    }

    const isCompleted = isTaskCompleted(t, user?.id)

    // Regla de 7 días: Si ya pasaron 7 días desde que se completó, no mostrarla
    if (isCompleted) {
      const compDate = getTaskCompletedDate(t, user?.id)
      if (compDate && Date.now() - compDate.getTime() > SEVEN_DAYS_MS) {
        return false
      }
    }

    if (statusFilter === 'pending' && isCompleted) return false
    if (statusFilter === 'completed' && !isCompleted) return false

    if (selectedSubjectId !== 'all' && t.subject_id !== selectedSubjectId) {
      return false
    }

    return true
  })

  // Estadísticas
  const pendingCount = tasks.filter((t) => {
    const isScopeMatch =
      activeTab === 'classroom'
        ? !t.is_private
        : t.is_private && t.created_by === user?.id
    const isComp = isTaskCompleted(t, user?.id)
    return isScopeMatch && !isComp
  }).length

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-4 relative min-h-full pb-20">
      {/* Header Principal */}
      <header className="flex items-center justify-between pt-1">
        <div className="flex-1 min-w-0 pr-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
            <span className="truncate">Tareas & Entregas</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">
            {pendingCount === 0
              ? '¡Estás al día con tus entregas! 🎉'
              : `Tienes ${pendingCount} ${pendingCount === 1 ? 'entrega pendiente' : 'entregas pendientes'}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true)
            loadTasksData()
          }}
          disabled={refreshing}
          aria-label="Actualizar tareas"
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-95 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </header>

      {/* 1. Selector de Panel Principal: "Del Salón" vs "Mis Pendientes" */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('classroom')}
          className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'classroom'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <School className="w-4 h-4 text-indigo-400" />
          <span>Del Salón</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('private')}
          className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'private'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Mis Pendientes</span>
        </button>
      </div>

      {/* 2. Barra Unificada de Filtros: Estados + Dropdown de Materia */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'pending'
                ? 'bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 font-semibold'
                : 'bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pendientes
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'completed'
                ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 font-semibold'
                : 'bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Completadas
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-zinc-800 border border-zinc-700 text-white font-semibold'
                : 'bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todas
          </button>
        </div>

        {subjects.length > 0 && (
          <div className="relative">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="h-8 pl-2.5 pr-7 rounded-xl text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-zinc-600 appearance-none [color-scheme:dark] max-w-[150px] truncate"
            >
              <option value="all">Todas las materias</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* 3. Lista de Tareas */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">
                {activeTab === 'classroom'
                  ? 'No hay tareas del salón con estos filtros'
                  : 'No tienes pendientes personales'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                {activeTab === 'classroom'
                  ? isAdmin
                    ? 'Como delegado, puedes publicar entregas grupales, proyectos o exámenes.'
                    : 'Tus delegados publicarán las tareas grupales y evaluaciones oficiales aquí.'
                  : 'Crea tus propias notas y recordatorios de estudio que solo tú podrás ver.'}
              </p>
            </div>

            {canCreateInActiveTab && (
              <button
                type="button"
                onClick={() => {
                  setTaskToEdit(null)
                  setShowCreateModal(true)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {activeTab === 'classroom'
                    ? 'Publicar Tarea Oficial'
                    : 'Crear mi Primer Pendiente'}
                </span>
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleStatus={handleToggleTaskStatus}
              onOpenDetail={(t) => setSelectedTaskForDetail(t)}
            />
          ))
        )}
      </div>

      {/* 4. Botón Flotante (FAB) para Crear Tarea */}
      {canCreateInActiveTab && (
        <button
          type="button"
          onClick={() => {
            setTaskToEdit(null)
            setShowCreateModal(true)
          }}
          aria-label={activeTab === 'private' ? 'Nuevo Pendiente' : 'Nueva Tarea'}
          className="fixed bottom-[104px] right-5 z-40 px-4 py-3 rounded-2xl bg-white text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-2xl shadow-black/90 hover:bg-zinc-100 active:scale-95 transition-all border border-zinc-200"
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
        }}
        subjects={subjects}
        schedules={schedules}
        defaultMode={activeTab}
        isAdmin={isAdmin}
        initialTask={taskToEdit}
        onSaveTask={handleSaveTask}
        onUpdateTask={handleUpdateTask}
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
        onAddComment={handleAddComment}
      />
    </div>
  )
}
