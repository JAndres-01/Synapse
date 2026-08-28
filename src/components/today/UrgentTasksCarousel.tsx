'use client'

import React from 'react'
import type { Task } from '@/types/database'
import { Check, Users, User, Rocket, FileText, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import confetti from 'canvas-confetti'

interface UrgentTasksCarouselProps {
  tasks: Task[]
  onToggleTaskStatus: (taskId: string, currentStatus: string) => Promise<void>
}

export function UrgentTasksCarousel({
  tasks,
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

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    const hours = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

    if (isToday) return `Hoy • ${hours}`
    return `${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })} • ${hours}`
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <span>Próximas Entregas</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
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
          const isCompleted = task.user_status?.[0]?.status === 'completed'

          const handleCheck = (e: React.MouseEvent) => {
            e.stopPropagation()
            if (!isCompleted) {
              confetti({
                particleCount: 25,
                spread: 40,
                origin: { y: 0.8 },
                colors: ['#6366F1', '#10B981', '#ffffff'],
              })
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

                  <span className="text-[10px] font-mono text-zinc-400">
                    {formatDueDate(task.due_date)}
                  </span>
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
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-zinc-700 hover:border-zinc-400 bg-zinc-900'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
