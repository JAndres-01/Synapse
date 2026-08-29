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
  currentUserId?: string | null
  onToggleStatus: (taskId: string, currentStatus: string) => Promise<void>
  onOpenDetail: (task: Task) => void
}

export function TaskCard({ task, currentUserId, onToggleStatus, onOpenDetail }: TaskCardProps) {
  const statuses = task.user_status || (task as unknown as { user_task_status?: Array<{ status: string; user_id?: string }> }).user_task_status
  const isCompleted = Array.isArray(statuses)
    ? statuses.some((s) => (!currentUserId || s.user_id === currentUserId) && s.status === 'completed')
    : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'grupal':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300 shrink-0">
            <Users className="w-2.5 h-2.5 text-zinc-400" />
            <span>Grupal</span>
          </span>
        )
      case 'proyecto':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300 shrink-0">
            <Rocket className="w-2.5 h-2.5 text-zinc-400" />
            <span>Proyecto</span>
          </span>
        )
      case 'examen':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300 shrink-0">
            <FileText className="w-2.5 h-2.5 text-zinc-400" />
            <span>Examen</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300 shrink-0">
            <User className="w-2.5 h-2.5 text-zinc-400" />
            <span>Individual</span>
          </span>
        )
    }
  }

  // Formateo y Colores de Prioridad para Fechas de Entrega
  const formatDueDate = (dateStr?: string) => {
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

      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const isYesterday = date.toDateString() === yesterday.toDateString()

      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isCompleted) {
        const formattedDate = isToday
          ? `Hoy • ${timeStr}`
          : `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • ${timeStr}`
        return { text: formattedDate, colorClass: 'text-zinc-500 line-through' }
      }

      // 1. Fecha Vencida
      if (isPast) {
        if (isToday) {
          return { text: `Venció hoy • ${timeStr}`, colorClass: 'text-red-400 font-medium' }
        }
        if (isYesterday) {
          return { text: `Venció ayer • ${timeStr}`, colorClass: 'text-red-400 font-medium' }
        }
        const formattedDate = date.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
        })
        return { text: `Venció • ${formattedDate}`, colorClass: 'text-red-400 font-medium' }
      }

      // 2. Entrega para Hoy
      if (isToday) {
        return { text: `Hoy • ${timeStr}`, colorClass: 'text-zinc-200 font-medium' }
      }

      // 3. Entrega para Mañana
      if (isTomorrow) {
        return { text: `Mañana • ${timeStr}`, colorClass: 'text-zinc-300 font-normal' }
      }

      // 4. Fechas futuras normales
      const formattedDate = date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      })
      return { text: `${formattedDate} • ${timeStr}`, colorClass: 'text-zinc-400 font-normal' }
    } catch {
      return { text: 'Fecha pendiente', colorClass: 'text-zinc-500' }
    }
  }

  const dueInfo = formatDueDate(task.due_date)
  const commentsCount = task.comments?.length || 0
  const photosCount = (task.comments || []).reduce((acc, c) => {
    if (!c.image_url) return acc
    if (c.image_url.startsWith('[') && c.image_url.endsWith(']')) {
      try {
        const arr = JSON.parse(c.image_url)
        if (Array.isArray(arr)) {
          return (
            acc +
            arr.filter(
              (item: { fileType?: string; file_type?: string }) =>
                item.fileType === 'image' || item.file_type === 'image'
            ).length
          )
        }
      } catch {}
    }
    const isImage =
      c.file_type === 'image' ||
      (!c.file_type &&
        (c.image_url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp)$/i.test(c.image_url)))
    return acc + (isImage ? 1 : 0)
  }, 0)
  const attachmentsCount = task.attachments?.length || 0

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isCompleted) {
      try {
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#ffffff', '#a1a1aa', '#71717a'],
        })
      } catch {}
    }
    onToggleStatus(task.id, isCompleted ? 'completed' : 'pending')
  }

  return (
    <div
      onClick={() => onOpenDetail(task)}
      className={`p-3 rounded-2xl border transition-all cursor-pointer select-none space-y-2 relative ${
        isCompleted
          ? 'bg-zinc-950/40 border-zinc-900 opacity-50'
          : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-900/70 active:scale-[0.99]'
      }`}
    >
      {/* Header: Tipo, Materia (izq) y Fecha Límite (der) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {task.is_private ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300 shrink-0">
              <Lock className="w-2.5 h-2.5 text-zinc-400" />
              <span>Privada</span>
            </span>
          ) : (
            getTypeBadge(task.type)
          )}

          {task.subject ? (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 min-w-0 flex-1">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 border border-zinc-700"
                style={{ backgroundColor: task.subject.color || '#FFFFFF' }}
              />
              <span className="truncate">{task.subject.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-500 italic shrink-0">General</span>
          )}
        </div>

        {/* Fecha Límite */}
        <span
          className={`text-[10px] font-mono shrink-0 whitespace-nowrap text-right pl-1 ${dueInfo.colorClass}`}
        >
          {dueInfo.text}
        </span>
      </div>

      {/* Contenido Principal: Checkbox y Título */}
      <div className="flex items-start gap-2.5 pt-0.5">
        <button
          type="button"
          onClick={handleCheck}
          aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
          className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-all mt-0.5 ${
            isCompleted
              ? 'bg-zinc-100 border-zinc-100 text-zinc-950'
              : 'border-zinc-600 hover:border-zinc-400 bg-zinc-950/60 active:scale-90'
          }`}
        >
          {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
        </button>

        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-medium tracking-tight leading-snug break-words ${
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

      {/* Footer: Adjuntos, Imágenes, Respuestas en tono minimalista */}
      {(attachmentsCount > 0 || (!task.is_private && (photosCount > 0 || commentsCount > 0))) && (
        <div className="flex items-center gap-3 pt-1 border-t border-zinc-800/40 text-[10px] text-zinc-500 font-medium flex-wrap">
          {attachmentsCount > 0 && (
            <div className="flex items-center gap-1 text-zinc-400">
              <Paperclip className="w-3 h-3 text-zinc-500" />
              <span>{attachmentsCount} {attachmentsCount === 1 ? 'adjunto' : 'adjuntos'}</span>
            </div>
          )}

          {!task.is_private && photosCount > 0 && (
            <div className="flex items-center gap-1 text-zinc-400">
              <ImageIcon className="w-3 h-3 text-zinc-500" />
              <span>{photosCount} {photosCount === 1 ? 'foto' : 'fotos'}</span>
            </div>
          )}

          {!task.is_private && commentsCount > 0 && (
            <div className="flex items-center gap-1 text-zinc-400">
              <MessageSquare className="w-3 h-3 text-zinc-500" />
              <span>{commentsCount} {commentsCount === 1 ? 'comentario' : 'comentarios'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
