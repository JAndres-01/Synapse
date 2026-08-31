'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { FloatingIslandBar } from '@/components/navigation/FloatingIslandBar'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { memoryCache } from '@/lib/cache'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, classroom, loading } = useAuth()
  const [pendingTasksCount, setPendingTasksCount] = useState<number>(() => memoryCache.pendingTasksCount)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth')
      } else if (!classroom && pathname !== '/join') {
        router.push('/join')
      }
    }
  }, [user, classroom, loading, router, pathname])

  // Contar tareas pendientes (Suma tareas oficiales del salón + tareas personales del alumno)
  const fetchPendingCount = useCallback(async () => {
    if (!classroom || !user) return

    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          created_by,
          is_private,
          user_status:user_task_status(user_id, status)
        `)
        .eq('classroom_id', classroom.id)

      if (!error && tasks) {
        const pending = tasks.filter((t) => {
          // 1. Ámbito: Visible si es del salón o si es su propio pendiente personal
          const isVisibleToUser = !t.is_private || t.created_by === user.id
          if (!isVisibleToUser) return false

          // 2. Estado: Verificar si el usuario actual ya la marcó como completada
          const userStatusList = t.user_status || (t as unknown as { user_task_status?: Array<{ user_id: string; status: string }> }).user_task_status
          const isCompleted = Array.isArray(userStatusList)
            ? userStatusList.some((s) => s.user_id === user.id && s.status === 'completed')
            : Boolean(userStatusList && (userStatusList as { status?: string; user_id?: string }).status === 'completed' && (userStatusList as { user_id?: string }).user_id === user.id)

          return !isCompleted
        }).length

        setPendingTasksCount(pending)
        memoryCache.pendingTasksCount = pending
      }
    } catch (err) {
      console.error('Error cargando conteo de tareas:', err)
    }
  }, [classroom, user, supabase])

  // Carga inicial y suscripción Realtime en vivo (SIN dependencia en pathname para evitar reconexiones al cambiar pestañas)
  useEffect(() => {
    if (!classroom || !user) return

    fetchPendingCount()

    // 1. Canal Realtime para cambios en tareas
    const tasksChannel = supabase
      .channel(`public:app_layout_tasks:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchPendingCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_task_status' },
        () => fetchPendingCount()
      )
      .subscribe()

    // 2. Evento interno para sincronización local instantánea
    const handleLocalUpdate = () => fetchPendingCount()
    window.addEventListener('tasks_updated', handleLocalUpdate)

    return () => {
      supabase.removeChannel(tasksChannel)
      window.removeEventListener('tasks_updated', handleLocalUpdate)
    }
  }, [classroom, user, supabase, fetchPendingCount])

  // Estabilización anti-descuadre de pantalla cuando se abre el teclado en iOS
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleViewportShift = () => {
      if (window.scrollX !== 0) {
        window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' })
      }
    }

    const handleBlur = () => {
      setTimeout(() => {
        window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' })
      }, 50)
    }

    window.visualViewport?.addEventListener('resize', handleViewportShift)
    window.visualViewport?.addEventListener('scroll', handleViewportShift)
    window.addEventListener('scroll', handleViewportShift)
    document.addEventListener('focusout', handleBlur)

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportShift)
      window.visualViewport?.removeEventListener('scroll', handleViewportShift)
      window.removeEventListener('scroll', handleViewportShift)
      document.removeEventListener('focusout', handleBlur)
    }
  }, [])

  if (loading && !classroom && !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-full bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800 relative overflow-x-hidden">
      {/* Contenedor Principal Centrado Mobile First con despeje seguro para Dynamic Island / Notch y margen inferior amplio */}
      <main className="w-full max-w-md mx-auto px-4 pt-[calc(env(safe-area-inset-top,44px)+16px)] pb-36 flex-1 flex flex-col overflow-x-hidden">
        {children}
      </main>

      {/* Floating Island Navigation Bar */}
      <FloatingIslandBar pendingTasksCount={pendingTasksCount} />
    </div>
  )
}
