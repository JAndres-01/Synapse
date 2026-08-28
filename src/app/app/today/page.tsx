'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import type { Schedule, Task, Subject, TaskType, TaskStatus, AttachmentType, TaskComment } from '@/types/database'
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

      // B. Cargar Tareas
      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .select('*, subject:subjects(*), attachments:task_attachments(*), user_status:user_task_status(*), comments:task_comments(*, author:profiles(*))')
        .eq('classroom_id', classroom.id)
        .order('due_date', { ascending: true })

      if (!taskErr && taskData) {
        const sorted = sortTasksChronologically(taskData as unknown as Task[])
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
      .on('broadcast', { event: 'comment_added' }, () => {
        loadTodayData()
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
        { event: '*', schema: 'public', table: 'task_comments' },
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

    channelRef.current = channel

    // Polling de respaldo cada 5 segundos para garantizar tiempo real
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !showCreateModal) {
        loadTodayData()
      }
    }, 5000)

    return () => {
      clearInterval(interval)
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

    // Actualización optimista en interfaz y en caché
    setUrgentTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            user_status: [{ id: 'temp-' + Date.now(), user_id: user.id, task_id: taskId, status: newStatus, completed_at: nowIso }],
          }
        }
        return t
      })
      memoryCache.tasks = updated
      return updated
    })

    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail((prev) =>
        prev
          ? {
              ...prev,
              user_status: [{ id: 'temp-' + Date.now(), user_id: user.id, task_id: taskId, status: newStatus, completed_at: nowIso }],
            }
          : null
      )
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
    } catch (err) {
      console.error('Error actualizando estado de tarea:', err)
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

  // Comentarios en Today
  const handleAddComment = async (
    taskId: string,
    content: string,
    parentCommentId?: string | null,
    imageUrl?: string | null,
    fileName?: string | null,
    fileType?: AttachmentType | null
  ) => {
    // Obtener sesión activa garantizada de Supabase
    const { data: sessionData } = await supabase.auth.getSession()
    const activeUserId = sessionData?.session?.user?.id || user?.id || (typeof window !== 'undefined' ? (() => {
      try { return JSON.parse(localStorage.getItem('synapse_cached_user') || '{}')?.id } catch { return null }
    })() : null)

    if (!activeUserId) {
      console.error('No se encontró usuario autenticado para comentar')
      return
    }

    const tempId = 'cmt-' + Date.now()
    const nowIso = new Date().toISOString()

    const optimisticComment: TaskComment = {
      id: tempId,
      task_id: taskId,
      author_id: activeUserId,
      parent_comment_id: parentCommentId || null,
      content,
      image_url: imageUrl || null,
      file_name: fileName || null,
      file_type: fileType || null,
      created_at: nowIso,
      author: profile || {
        id: activeUserId,
        email: user?.email || '',
        full_name: (user?.user_metadata?.full_name as string) || 'Tú',
        avatar_url: null,
        role: 'student',
        created_at: nowIso,
        updated_at: nowIso,
      },
    }

    // 1. Renderizado optimista instantáneo (0ms)
    setUrgentTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            comments: [...(t.comments || []), optimisticComment],
          }
        }
        return t
      })
    )

    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail((prev) =>
        prev
          ? {
              ...prev,
              comments: [...(prev.comments || []), optimisticComment],
            }
          : null
      )
    }

    // 2. Persistencia en Supabase
    try {
      const payload: Record<string, unknown> = {
        task_id: taskId,
        author_id: activeUserId,
        content: content || '',
        parent_comment_id: parentCommentId || null,
        image_url: imageUrl || null,
      }
      if (fileName) payload.file_name = fileName
      if (fileType) payload.file_type = fileType

      const { data: insertedComment, error } = await supabase
        .from('task_comments')
        .insert(payload)
        .select('*, author:profiles(*)')
        .single()

      if (error) {
        console.warn('Reintentando inserción simple sin join en task_comments:', error)
        const { error: simpleErr } = await supabase
          .from('task_comments')
          .insert(payload)
        if (simpleErr) throw simpleErr
      } else if (insertedComment) {
        const realComment = insertedComment as unknown as TaskComment
        setUrgentTasks((prev) =>
          prev.map((t) => {
            if (t.id === taskId) {
              return {
                ...t,
                comments: (t.comments || []).map((c) =>
                  c.id === tempId ? realComment : c
                ),
              }
            }
            return t
          })
        )

        setSelectedTaskForDetail((prev) => {
          if (!prev || prev.id !== taskId) return prev
          return {
            ...prev,
            comments: (prev.comments || []).map((c) =>
              c.id === tempId ? realComment : c
            ),
          }
        })

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('tasks_updated'))
        }

        channelRef.current?.send({
          type: 'broadcast',
          event: 'comment_added',
          payload: { taskId },
        })
      }
    } catch (err) {
      console.error('Error insertando comentario en Supabase:', err)
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
        onToggleTaskStatus={handleToggleTaskStatus}
        onOpenDetail={(task) => setSelectedTaskForDetail(task)}
      />

      {/* 3. Cronograma de las 4 Clases de Hoy con Tareas Integradas */}
      <DayScheduleTimeline
        schedulesToday={schedulesToday}
        tasksToday={tasksTodayForTimeline}
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
          setTaskToEdit(t)
          setShowCreateModal(true)
        }}
        onAddComment={handleAddComment}
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
