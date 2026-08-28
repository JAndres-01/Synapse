'use client'

import React from 'react'
import type { Task } from '@/types/database'
import {
  Check,
  Users,
  User,
  Rocket,
  FileText,
  MessageSquare,
  Image as ImageIcon,
  Lock,
} from 'lucide-react'
import confetti from 'canvas-confetti'

interface TaskCardProps {
  task: Task
  onToggleStatus: (taskId: string, currentStatus: string) => Promise<void>
  onOpenDetail: (task: Task) => void
}

export function TaskCard({ task, onToggleStatus, onOpenDetail }: TaskCardProps) {
  const isCompleted =
    Array.isArray(task.user_status) &&
    task.user_status.length > 0 &&
    task.user_status[0]?.status === 'completed'

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'grupal':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-800/50 text-[10px] font-semibold text-sky-400">
            <Users className="w-2.5 h-2.5" />
            <span>Grupal</span>
          </span>
        )
      case 'proyecto':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/50 text-[10px] font-semibold text-purple-400">
            <Rocket className="w-2.5 h-2.5" />
            <span>Proyecto</span>
          </span>
        )
      case 'examen':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/50 text-[10px] font-semibold text-rose-400">
            <FileText className="w-2.5 h-2.5" />
            <span>Examen</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-300">
            <User className="w-2.5 h-2.5 text-zinc-400" />
            <span>Individual</span>
          </span>
        )
    }
  }

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return { text: 'Sin fecha', isUrgent: false }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: 'Fecha pendiente', isUrgent: false }
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()

      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const isTomorrow = date.toDateString() === tomorrow.toDateString()

      const timeStr = date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

      if (isToday) return { text: `Hoy • ${timeStr}`, isUrgent: true }
      if (isTomorrow) return { text: `Mañana • ${timeStr}`, isUrgent: false }

      const formatted = date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      })
      return { text: `${formatted} • ${timeStr}`, isUrgent: false }
    } catch {
      return { text: 'Fecha pendiente', isUrgent: false }
    }
  }

  const dueInfo = formatDueDate(task.due_date)
  const commentsCount = task.comments?.length || 0
  const photosCount = (task.comments || []).filter((c) => !!c.image_url).length

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isCompleted) {
      try {
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#6366F1', '#10B981', '#ffffff'],
        })
      } catch {}
    }
    onToggleStatus(task.id, isCompleted ? 'completed' : 'pending')
  }

  return (
    <div
      onClick={() => onOpenDetail(task)}
      className={`p-4 rounded-2xl border transition-all cursor-pointer select-none space-y-2.5 relative shadow-sm ${
        isCompleted
          ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 active:scale-[0.99]'
      }`}
    >
      {/* Header: Tipo, Materia, Fecha */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.is_private ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-800/50 text-[10px] font-semibold text-amber-400">
              <Lock className="w-2.5 h-2.5" />
              <span>Privada</span>
            </span>
          ) : (
            getTypeBadge(task.type)
          )}

          {task.subject ? (
            <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-300 pl-1">
              <span
                className="w-2 h-2 rounded-full shrink-0 border border-zinc-700"
                style={{ backgroundColor: task.subject.color || '#FFFFFF' }}
              />
              <span className="truncate max-w-[120px]">{task.subject.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-500 italic pl-1">General</span>
          )}
        </div>

        {/* Fecha Límite */}
        <span
          className={`text-[10px] font-mono font-medium ${
            dueInfo.isUrgent ? 'text-amber-400 font-bold' : 'text-zinc-400'
          }`}
        >
          {dueInfo.text}
        </span>
      </div>

      {/* Contenido Principal: Checkbox y Título */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleCheck}
          aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
          className={`w-6 h-6 rounded-full border shrink-0 flex items-center justify-center transition-all mt-0.5 ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-zinc-700 hover:border-zinc-400 bg-zinc-950/80 active:scale-90'
          }`}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-semibold tracking-tight leading-snug line-clamp-2 ${
              isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100'
            }`}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="text-xs text-zinc-400 line-clamp-1 mt-1 leading-normal">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer: Contador de respuestas y fotos de apuntes */}
      {!task.is_private && (commentsCount > 0 || photosCount > 0) && (
        <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-3 text-[11px] text-zinc-400">
          {commentsCount > 0 && (
            <span className="flex items-center gap-1 hover:text-zinc-200">
              <MessageSquare className="w-3 h-3 text-zinc-500" />
              <span>{commentsCount} {commentsCount === 1 ? 'respuesta' : 'respuestas'}</span>
            </span>
          )}

          {photosCount > 0 && (
            <span className="flex items-center gap-1 text-indigo-400">
              <ImageIcon className="w-3 h-3" />
              <span>{photosCount} {photosCount === 1 ? 'apunte' : 'apuntes'}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
