'use client'

import React from 'react'
import type { Task } from '@/types/database'
import {
  Check,
  Users,
  User,
  Rocket,
  FileText,
  Lock,
  Paperclip,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { triggerHaptic } from '@/lib/native'
import { motion, AnimatePresence } from 'framer-motion'

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
  const attachmentsCount = task.attachments?.length || 0

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isCompleted) {
      triggerHaptic('success')
      try {
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#ffffff', '#a1a1aa', '#71717a'],
        })
      } catch {}
    } else {
      triggerHaptic('light')
    }
    onToggleStatus(task.id, isCompleted ? 'completed' : 'pending')
  }

  return (
    <motion.div
      onClick={() => onOpenDetail(task)}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`group py-3 px-1.5 transition-colors cursor-pointer select-none flex items-start gap-3 border-b border-zinc-900/80 hover:bg-zinc-900/30 active:bg-zinc-900/50 rounded-xl ${
        isCompleted ? 'opacity-40' : ''
      }`}
    >
      {/* Checkbox minimalista con rebote elástico */}
      <motion.button
        type="button"
        onClick={handleCheck}
        whileTap={{ scale: 0.8 }}
        aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
        className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-colors mt-0.5 ${
          isCompleted
            ? 'bg-zinc-200 border-zinc-200 text-zinc-950'
            : 'border-zinc-600 hover:border-zinc-400 bg-transparent'
        }`}
      >
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Contenido de la tarea */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Título y Fecha en una sola línea superior */}
        <div className="flex items-baseline justify-between gap-2">
          <h3
            className={`text-sm font-medium tracking-tight leading-snug break-words ${
              isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100'
            }`}
          >
            {task.title}
          </h3>

          {dueInfo.text && (
            <span
              className={`text-[11px] font-mono shrink-0 whitespace-nowrap text-right ${dueInfo.colorClass}`}
            >
              {dueInfo.text}
            </span>
          )}
        </div>

        {/* Descripción corta si existe */}
        {task.description && !isCompleted && (
          <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Metadatos en línea: Materia, Tipo, Privada, Adjuntos, Comentarios */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium flex-wrap pt-0.5">
          {task.is_private && (
            <span className="flex items-center gap-1 text-zinc-400">
              <Lock className="w-2.5 h-2.5" />
              <span>Privada</span>
            </span>
          )}

          {task.subject && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: task.subject.color || '#a1a1aa' }}
              />
              <span className="truncate max-w-[140px]">{task.subject.name}</span>
            </div>
          )}

          {task.type === 'grupal' && (
            <span className="flex items-center gap-1 text-zinc-400">
              <Users className="w-2.5 h-2.5" />
              <span>Grupal</span>
            </span>
          )}

          {task.type === 'proyecto' && (
            <span className="flex items-center gap-1 text-zinc-400">
              <Rocket className="w-2.5 h-2.5" />
              <span>Proyecto</span>
            </span>
          )}

          {task.type === 'examen' && (
            <span className="flex items-center gap-1 text-zinc-400">
              <FileText className="w-2.5 h-2.5" />
              <span>Examen</span>
            </span>
          )}

          {attachmentsCount > 0 && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Paperclip className="w-2.5 h-2.5" />
              <span>{attachmentsCount}</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
