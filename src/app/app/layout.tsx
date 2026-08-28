'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { FloatingIslandBar } from '@/components/navigation/FloatingIslandBar'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, classroom, loading } = useAuth()
  const [pendingTasksCount, setPendingTasksCount] = useState(0)
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

  // Contar tareas pendientes para el badge de la barra de navegación
  useEffect(() => {
    if (!classroom || !user) return

    const fetchPendingCount = async () => {
      try {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, user_task_status(status)')
          .eq('classroom_id', classroom.id)

        if (tasks) {
          const pending = tasks.filter((t) => {
            const status = t.user_task_status?.[0]?.status
            return status !== 'completed'
          }).length
          setPendingTasksCount(pending)
        }
      } catch (err) {
        console.error('Error cargando conteo de tareas:', err)
      }
    }

    fetchPendingCount()
  }, [classroom, user, supabase])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!user || !classroom) {
    return null
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative overflow-hidden bg-zinc-950">
      {/* Contenedor scrolleable con margen superior seguro para Dynamic Island/Notch y despeje inferior */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 pt-8 pb-24 no-scrollbar">
        {children}
      </div>
      {/* Barra de navegación anclada fija sobre el marco */}
      <FloatingIslandBar pendingTasksCount={pendingTasksCount} />
    </div>
  )
}
