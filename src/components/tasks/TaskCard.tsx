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
  Paperclip,
} from 'lucide-react'
import confetti from 'canvas-confetti'

interface TaskCardProps {
  task: Task
  onToggleStatus: (taskId: string, currentStatus: string) => Promise<void>
  onOpenDetail: (task: Task) => void
}

export function TaskCard({ task, onToggleStatus, onOpenDetail }: TaskCardProps) {
  const statuses = task.user_status || (task as unknown as { user_task_status?: Array<{ status: string }> }).user_task_status
  const isCompleted = Array.isArray(statuses)
    ? statuses.some((s) => s.status === 'completed')
    : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

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

      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isToday) return { text: `Hoy • ${timeStr}`, isUrgent: true }
      if (isTomorrow) return { text: `Mañana • ${timeStr}`, isUrgent: false }

      const formattedDate = date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      })
      return { text: `${formattedDate} • ${timeStr}`, isUrgent: false }
    } catch {
      return { text: 'Fecha pendiente', isUrgent: false }
    }
  }

  const dueInfo = formatDueDate(task.due_date)
  const commentsCount = task.comments?.length || 0
  const photosCount = (task.comments || []).filter((c) => !!c.image_url).length
  const attachmentsCount = task.attachments?.length || 0

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
      className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none space-y-2 relative shadow-sm ${
        isCompleted
          ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 active:scale-[0.99]'
      }`}
    >
      {/* Header: Tipo, Materia (izq) y Fecha Límite Antidesborde (der) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {task.is_private ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-800/50 text-[10px] font-semibold text-amber-400 shrink-0">
              <Lock className="w-2.5 h-2.5" />
              <span>Privada</span>
            </span>
          ) : (
            getTypeBadge(task.type)
          )}

          {task.subject ? (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-300 min-w-0 flex-1">
              <span
                className="w-2 h-2 rounded-full shrink-0 border border-zinc-700"
                style={{ backgroundColor: task.subject.color || '#FFFFFF' }}
              />
              <span className="truncate">{task.subject.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-500 italic shrink-0">General</span>
          )}
        </div>

        {/* Fecha Límite en una sola línea protegida */}
        <span
          className={`text-[10px] font-mono font-medium shrink-0 whitespace-nowrap text-right pl-1 ${
            dueInfo.isUrgent ? 'text-amber-400 font-bold' : 'text-zinc-400'
          }`}
        >
          {dueInfo.text}
        </span>
      </div>

      {/* Contenido Principal: Checkbox y Título */}
      <div className="flex items-start gap-3 pt-0.5">
        <button
          type="button"
          onClick={handleCheck}
          aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
          className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
              : 'border-zinc-600 hover:border-zinc-400 bg-zinc-950/90 active:scale-90'
          }`}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-semibold tracking-tight leading-snug break-words ${
              isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100'
            }`}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer: Adjuntos, Respuestas y Fotos de Apuntes */}
      {(attachmentsCount > 0 || (!task.is_private && (commentsCount > 0 || photosCount > 0))) && (
        <div className="flex items-center gap-3 pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-400 font-medium flex-wrap">
          {attachmentsCount > 0 && (
            <div className="flex items-center gap-1 text-indigo-300 font-medium">
              <Paperclip className="w-3 h-3 text-indigo-400" />
              <span>{attachmentsCount} {attachmentsCount === 1 ? 'adjunto' : 'adjuntos'}</span>
            </div>
          )}

          {!task.is_private && commentsCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-zinc-500" />
              <span>{commentsCount} {commentsCount === 1 ? 'respuesta' : 'respuestas'}</span>
            </div>
          )}

          {!task.is_private && photosCount > 0 && (
            <div className="flex items-center gap-1 text-emerald-400">
              <ImageIcon className="w-3 h-3" />
              <span>{photosCount} {photosCount === 1 ? 'apunte' : 'apuntes'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
