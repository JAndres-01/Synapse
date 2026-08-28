'use client'

import React from 'react'
import type { Task } from '@/types/database'
import {
  Check,
  Users,
  User,
  Rocket,
  FileText,
  ChevronRight,
  CalendarRange,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'

interface UrgentTasksCarouselProps {
  tasks?: Task[]
  onToggleTaskStatus: (taskId: string, currentStatus: string) => Promise<void>
  onOpenDetail?: (task: Task) => void
}

export function UrgentTasksCarousel({
  tasks = [],
  onToggleTaskStatus,
  onOpenDetail,
}: UrgentTasksCarouselProps) {
  const router = useRouter()

  if (!tasks || tasks.length === 0) {
    return null
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'grupal':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-800/50 text-[10px] font-semibold text-sky-400 shrink-0">
            <Users className="w-2.5 h-2.5" />
            <span>Grupal</span>
          </span>
        )
      case 'proyecto':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/50 text-[10px] font-semibold text-purple-400 shrink-0">
            <Rocket className="w-2.5 h-2.5" />
            <span>Proyecto</span>
          </span>
        )
      case 'examen':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/50 text-[10px] font-semibold text-rose-400 shrink-0">
            <FileText className="w-2.5 h-2.5" />
            <span>Examen</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-300 shrink-0">
            <User className="w-2.5 h-2.5 text-zinc-400" />
            <span>Individual</span>
          </span>
        )
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
      return { text: `${weekday} ${day} • ${timeStr}`, colorClass: 'text-zinc-400 font-medium' }
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

      <div className="flex gap-2.5 items-start overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
        {tasks.map((task) => {
          const statuses = task.user_status || (task as unknown as { user_task_status?: Array<{ status: string }> }).user_task_status
          const isCompleted = Array.isArray(statuses)
            ? statuses.some((s) => s.status === 'completed')
            : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

          const dueInfo = formatDueDate(task.due_date, isCompleted)

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

          const handleCardClick = () => {
            if (onOpenDetail) {
              onOpenDetail(task)
            } else {
              router.push(`/app/tasks?taskId=${task.id}`)
            }
          }

          return (
            <div
              key={task.id}
              onClick={handleCardClick}
              className={`w-[220px] p-3 rounded-2xl border transition-all shrink-0 flex flex-col cursor-pointer select-none gap-2 relative shadow-sm ${
                isCompleted
                  ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                  : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 active:scale-[0.99]'
              }`}
            >
              {/* Header: Tipo / Privada y Fecha con Pill destacada */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {task.is_private ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-800/50 text-[10px] font-semibold text-amber-400 shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Privada</span>
                    </span>
                  ) : (
                    getTypeBadge(task.type)
                  )}
                </div>

                <span
                  className={`text-[10px] font-mono shrink-0 px-2 py-0.5 rounded-md bg-zinc-950/90 border border-zinc-800/80 ${dueInfo.colorClass}`}
                >
                  {dueInfo.text}
                </span>
              </div>

              {/* Contenido: Materia ARRIBA y Checkbox + Título debajo */}
              <div className="space-y-1">
                {/* Materia con punto de color ARRIBA del nombre */}
                {task.subject ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 border border-zinc-700"
                      style={{ backgroundColor: task.subject.color || '#FFFFFF' }}
                    />
                    <span className="truncate">{task.subject.name}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-500 italic">General</span>
                )}

                {/* Checkbox y Nombre de la tarea */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleCheck}
                    aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'border-zinc-600 hover:border-zinc-400 bg-zinc-950/90 active:scale-90'
                    }`}
                  >
                    {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <h4
                    className={`text-xs font-bold tracking-tight leading-snug line-clamp-1 flex-1 min-w-0 ${
                      isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100'
                    }`}
                  >
                    {task.title}
                  </h4>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
