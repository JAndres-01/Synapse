'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import type { Schedule, Task, Notice, NoticeCategory } from '@/types/database'
import { LiveClassHeroCard } from '@/components/today/LiveClassHeroCard'
import { UrgentTasksCarousel } from '@/components/today/UrgentTasksCarousel'
import { DayScheduleTimeline } from '@/components/today/DayScheduleTimeline'
import { DelegateNoticesFeed } from '@/components/today/DelegateNoticesFeed'
import { offlineDB } from '@/lib/db'
import { Loader2, RefreshCw, Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function TodayPage() {
  const { user, profile, classroom } = useAuth()
  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>([])
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const supabase = createClient()

  // Obtener día actual (1=Lunes ... 7=Domingo en nuestra BD)
  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day // Si es domingo, mapear a 7
  }

  // Cargar datos de la jornada
  const loadTodayData = useCallback(async () => {
    if (!classroom) return

    try {
      const todayNum = getTodayDayOfWeek()

      // 1. Cargar Horarios de hoy con información de materias
      const { data: scheduleData, error: schedErr } = await supabase
        .from('schedules')
        .select('*, subject:subjects(*)')
        .eq('classroom_id', classroom.id)
        .eq('day_of_week', todayNum)
        .order('block_number', { ascending: true })

      if (!schedErr && scheduleData) {
        setSchedulesToday(scheduleData as unknown as Schedule[])
        // Guardar en caché offline si hay registros válidos
        if (offlineDB && scheduleData.length > 0) {
          const validRecords = scheduleData.filter((s) => !!s && !!s.id)
          if (validRecords.length > 0) {
            await offlineDB.schedules.bulkPut(validRecords as unknown as Schedule[])
          }
        }
      }

      // 2. Cargar Tareas próximas
      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .select('*, subject:subjects(*), user_status:user_task_status(*)')
        .eq('classroom_id', classroom.id)
        .order('due_date', { ascending: true })
        .limit(10)

      if (!taskErr && taskData) {
        setUrgentTasks(taskData as unknown as Task[])
        if (offlineDB && taskData.length > 0) {
          const validTasks = taskData.filter((t) => !!t && !!t.id)
          if (validTasks.length > 0) {
            await offlineDB.tasks.bulkPut(validTasks as unknown as Task[])
          }
        }
      }

      // 3. Cargar Avisos con comentarios y autor
      const { data: noticeData, error: noticeErr } = await supabase
        .from('notices')
        .select('*, author:profiles(*), comments:notice_comments(*, author:profiles(*))')
        .eq('classroom_id', classroom.id)
        .order('created_at', { ascending: false })
        .limit(15)

      if (!noticeErr && noticeData) {
        setNotices(noticeData as unknown as Notice[])
        if (offlineDB && noticeData.length > 0) {
          const validNotices = noticeData.filter((n) => !!n && !!n.id)
          if (validNotices.length > 0) {
            await offlineDB.notices.bulkPut(validNotices as unknown as Notice[])
          }
        }
      }
    } catch (err) {
      console.error('Error cargando datos de hoy:', err)
      // Cargar desde caché offline si falla la red
      if (offlineDB && classroom) {
        const todayNum = getTodayDayOfWeek()
        const cachedSchedules = await offlineDB.schedules
          .where('classroom_id')
          .equals(classroom.id)
          .filter((s) => s.day_of_week === todayNum)
          .toArray()
        if (cachedSchedules.length > 0) setSchedulesToday(cachedSchedules)

        const cachedTasks = await offlineDB.tasks
          .where('classroom_id')
          .equals(classroom.id)
          .toArray()
        if (cachedTasks.length > 0) setUrgentTasks(cachedTasks)

        const cachedNotices = await offlineDB.notices
          .where('classroom_id')
          .equals(classroom.id)
          .toArray()
        if (cachedNotices.length > 0) setNotices(cachedNotices)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [classroom, supabase])

  useEffect(() => {
    loadTodayData()

    // Suscripción Realtime a nuevos avisos y tareas
    if (!classroom) return

    const channel = supabase
      .channel(`public:classroom_today:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notices', filter: `classroom_id=eq.${classroom.id}` },
        () => loadTodayData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => loadTodayData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    // Actualización optimista en interfaz
    setUrgentTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            user_status: [{ id: 'temp', user_id: user.id, task_id: taskId, status: newStatus, completed_at: new Date().toISOString() }],
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
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id,task_id' }
      )
    } catch (err) {
      console.error('Error actualizando estado de tarea:', err)
      loadTodayData()
    }
  }

  // Publicar un nuevo aviso
  const handleAddNotice = async (content: string, category: NoticeCategory, isUrgent: boolean) => {
    if (!classroom || !user) return

    const { error } = await supabase.from('notices').insert({
      classroom_id: classroom.id,
      author_id: user.id,
      content,
      category,
      is_urgent: isUrgent,
    })

    if (!error) {
      loadTodayData()
    }
  }

  // Comentar en un aviso
  const handleAddComment = async (noticeId: string, content: string) => {
    if (!user) return

    const { error } = await supabase.from('notice_comments').insert({
      notice_id: noticeId,
      author_id: user.id,
      content,
    })

    if (!error) {
      loadTodayData()
    }
  }

  const todayDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Buscar si hay aviso urgente de cambio de aula para mostrar en el Hero Card
  const urgentClassNotice = notices.find((n) => n.is_urgent && n.category === 'cambio_aula')

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-5">
      {/* Header Principal */}
      <header className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 capitalize block">
            {todayDate}
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mt-0.5">
            <span>Hola, {profile?.full_name?.split(' ')[0] || 'Compañero'}</span>
            <span className="text-base">👋</span>
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

      {/* Banner de Salón Nuevo (si es delegado y aún no tiene materias) */}
      {profile?.role === 'admin' && schedulesToday.length === 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 space-y-2">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Configura el horario de tu salón</span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            Eres delegado de este salón. Ve a la pestaña **Horario** para añadir las materias del semestre y configurar los 4 bloques diarios.
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

      {/* 1. Hero Card en Tiempo Real (Los 4 Bloques y Clase Activa) */}
      <LiveClassHeroCard
        schedulesToday={schedulesToday}
        urgentNotice={urgentClassNotice}
      />

      {/* 2. Carrusel de Tareas Próximas */}
      <UrgentTasksCarousel
        tasks={urgentTasks}
        onToggleTaskStatus={handleToggleTaskStatus}
      />

      {/* 3. Cronograma de los 4 Bloques de Hoy */}
      <DayScheduleTimeline schedulesToday={schedulesToday} />

      {/* 4. Canal Oficial de Avisos de Delegados */}
      <DelegateNoticesFeed
        notices={notices}
        currentUserId={user?.id || ''}
        onAddNotice={handleAddNotice}
        onAddComment={handleAddComment}
      />
    </div>
  )
}
