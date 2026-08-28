'use client'

import React from 'react'
import type { Task } from '@/types/database'
import { Check, Users, User, Rocket, FileText, ChevronRight, CalendarRange } from 'lucide-react'
import Link from 'next/link'
import confetti from 'canvas-confetti'

interface UrgentTasksCarouselProps {
  tasks?: Task[]
  onToggleTaskStatus: (taskId: string, currentStatus: string) => Promise<void>
}

export function UrgentTasksCarousel({
  tasks = [],
  onToggleTaskStatus,
}: UrgentTasksCarouselProps) {
  if (!tasks || tasks.length === 0) {
    return null
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'grupal':
        return <Users className="w-3 h-3 text-sky-400" />
      case 'proyecto':
        return <Rocket className="w-3 h-3 text-purple-400" />
      case 'examen':
        return <FileText className="w-3 h-3 text-rose-400" />
      default:
        return <User className="w-3 h-3 text-zinc-400" />
    }
  }

  const formatDueDate = (dateStr?: string, isCompleted?: boolean) => {
    if (!dateStr) return { text: 'Sin fecha', colorClass: 'text-zinc-500' }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: 'Fecha pendiente', colorClass: 'text-zinc-500' }
      const now = new Date()

      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()

      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const isTomorrow = date.toDateString() === tomorrow.toDateString()

      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isCompleted) {
        return {
          text: isToday ? `Hoy • ${timeStr}` : `Entregada`,
          colorClass: 'text-zinc-500 line-through',
        }
      }

      if (isPast) {
        const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' })
        const day = date.getDate()
        return {
          text: isToday ? `Venció hoy • ${timeStr}` : `Venció • ${weekday} ${day}`,
          colorClass: 'text-red-400 font-bold',
        }
      }

      if (isToday) return { text: `Hoy • ${timeStr}`, colorClass: 'text-amber-400 font-bold' }
      if (isTomorrow) return { text: `Mañana • ${timeStr}`, colorClass: 'text-indigo-300 font-medium' }

      const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' })
      const day = date.getDate()
      return { text: `${weekday} ${day} • ${timeStr}`, colorClass: 'text-zinc-400' }
    } catch {
      return { text: 'Fecha pendiente', colorClass: 'text-zinc-500' }
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <CalendarRange className="w-3.5 h-3.5 text-indigo-400" />
          <span>Tareas para esta semana</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono font-bold">
            {tasks.length}
          </span>
        </h3>
        <Link
          href="/app/tasks"
          className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 transition-colors"
        >
          <span>Ver todas</span>
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
        {tasks.map((task) => {
          const statuses = task.user_status || (task as unknown as { user_task_status?: Array<{ status: string }> }).user_task_status
          const isCompleted = Array.isArray(statuses)
            ? statuses.some((s) => s.status === 'completed')
            : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

          const handleCheck = (e: React.MouseEvent) => {
            e.stopPropagation()
            if (!isCompleted) {
              try {
                confetti({
                  particleCount: 25,
                  spread: 40,
                  origin: { y: 0.8 },
                  colors: ['#6366F1', '#10B981', '#ffffff'],
                })
              } catch {}
            }
            onToggleTaskStatus(task.id, isCompleted ? 'completed' : 'pending')
          }

          return (
            <div
              key={task.id}
              className={`min-w-[240px] max-w-[260px] p-3.5 rounded-2xl border transition-all shrink-0 flex flex-col justify-between ${
                isCompleted
                  ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                  : 'bg-zinc-900/80 border-zinc-800 shadow-md hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/80 text-[10px] font-medium text-zinc-300 capitalize">
                    {getTypeIcon(task.type)}
                    <span>{task.type}</span>
                  </div>

                  {(() => {
                    const dueInfo = formatDueDate(task.due_date, isCompleted)
                    return (
                      <span className={`text-[10px] font-mono whitespace-nowrap ${dueInfo.colorClass}`}>
                        {dueInfo.text}
                      </span>
                    )
                  })()}
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: task.subject?.color || '#3B82F6' }}
                  />
                  <span className="text-[11px] font-medium text-zinc-400 truncate">
                    {task.subject?.name || 'Materia'}
                  </span>
                </div>

                <h4
                  className={`text-xs font-semibold tracking-tight text-zinc-100 line-clamp-2 ${
                    isCompleted ? 'line-through text-zinc-500' : ''
                  }`}
                >
                  {task.title}
                </h4>
              </div>

              <div className="pt-3 mt-2 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">
                  {isCompleted ? 'Entregada' : 'Pendiente'}
                </span>

                <button
                  type="button"
                  onClick={handleCheck}
                  aria-label="Marcar completada"
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                      : 'border-zinc-600 hover:border-zinc-400 bg-zinc-950/90 active:scale-90'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
