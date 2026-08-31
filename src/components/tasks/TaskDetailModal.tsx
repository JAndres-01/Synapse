'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Task, Profile, TaskAttachment } from '@/types/database'
import {
  Clock,
  Trash2,
  Check,
  Users,
  User,
  Rocket,
  FileText,
  Lock,
  Loader2,
  AlertTriangle,
  Pencil,
  Paperclip,
  ExternalLink,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { createClient } from '@/lib/supabase/client'
import { memoryCache } from '@/lib/cache'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/modalManager'

interface TaskDetailModalProps {
  task: Task | null
  onClose: () => void
  currentUser: { id: string; email?: string } | null
  currentProfile: Profile | null
  isAdmin: boolean
  onToggleStatus: (taskId: string, currentStatus: string) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onEditTask?: (task: Task) => void
}

function formatTaskDate(dateStr?: string) {
  if (!dateStr) return 'Sin fecha límite'
  try {
    const d = new Date(dateStr)
    const timeStr = d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    const dateFormatted = d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })
    return `${dateFormatted} a las ${timeStr}`
  } catch {
    return dateStr
  }
}

export function TaskDetailModal({
  task,
  onClose,
  currentUser,
  currentProfile,
  isAdmin,
  onToggleStatus,
  onDeleteTask,
  onEditTask,
}: TaskDetailModalProps) {
  const [selectedImageForLightbox, setSelectedImageForLightbox] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Gestos táctiles
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  const statuses = task?.user_status || (task as unknown as { user_task_status?: Array<{ status: string; user_id: string }> })?.user_task_status
  const isCompleted = Array.isArray(statuses)
    ? statuses.some((s) => s.status === 'completed' && (!currentUser || s.user_id === currentUser.id))
    : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

  // Regla de Permisos de Edición y Eliminación:
  // - Si es privada: Solo el autor que la creó
  // - Si es del salón: Solo el delegado / administrador
  const canManageTask =
    task &&
    ((task.is_private && currentUser && task.created_by === currentUser.id) ||
      (!task.is_private && isAdmin))

  const [loadedAttachments, setLoadedAttachments] = useState<TaskAttachment[]>(() => {
    if (task?.id && memoryCache.taskDetails[task.id]) {
      return memoryCache.taskDetails[task.id].attachments
    }
    return (task?.attachments as TaskAttachment[]) || []
  })
  const supabase = createClient()

  const loadTaskDetails = React.useCallback(async () => {
    if (!task?.id) return
    try {
      const { data: attData } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', task.id)

      const freshAttachments = (attData as TaskAttachment[]) || []

      // Guardar en caché en memoria para apertura instantánea (0ms)
      memoryCache.taskDetails[task.id] = {
        attachments: freshAttachments,
        lastFetched: Date.now(),
      }

      setLoadedAttachments(freshAttachments)
    } catch (err) {
      console.error('Error cargando adjuntos bajo demanda:', err)
    }
  }, [task?.id, supabase])

  // Carga bajo demanda instantánea con caché (SWR: Stale-While-Revalidate)
  useEffect(() => {
    if (!task?.id) {
      setLoadedAttachments([])
      return
    }

    const cached = memoryCache.taskDetails[task.id]
    if (cached) {
      setLoadedAttachments(cached.attachments)
    }

    loadTaskDetails()

    const channel = supabase
      .channel(`modal_task_att_${task.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments', filter: `task_id=eq.${task.id}` },
        () => loadTaskDetails()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [task?.id, supabase, loadTaskDetails])

  useEffect(() => {
    if (task) {
      lockBodyScroll()
    } else {
      unlockBodyScroll()
      setDragOffsetY(0)
    }
    return () => {
      if (task) {
        unlockBodyScroll()
      }
    }
  }, [task])

  if (!task) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaY = e.touches[0].clientY - dragStartYRef.current
    if (deltaY > 0) {
      setDragOffsetY(deltaY)
    } else {
      setDragOffsetY(0)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (dragOffsetY > 45) {
      onClose()
    } else {
      setDragOffsetY(0)
    }
  }

  const handleCheck = () => {
    if (!isCompleted) {
      try {
        confetti({
          particleCount: 35,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#6366F1', '#10B981', '#ffffff'],
        })
      } catch {}
    }
    onToggleStatus(task.id, isCompleted ? 'completed' : 'pending')
  }

  const handleConfirmDelete = async () => {
    try {
      setDeleteLoading(true)
      setShowDeleteConfirm(false)
      await onDeleteTask(task.id)
      onClose()
    } catch (err) {
      console.error('Error eliminando tarea:', err)
    } finally {
      setDeleteLoading(false)
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'grupal':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300">
            <Users className="w-2.5 h-2.5 text-zinc-400" />
            <span>Grupal</span>
          </span>
        )
      case 'proyecto':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300">
            <Rocket className="w-2.5 h-2.5 text-zinc-400" />
            <span>Proyecto</span>
          </span>
        )
      case 'examen':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300">
            <FileText className="w-2.5 h-2.5 text-zinc-400" />
            <span>Examen</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-medium text-zinc-300">
            <User className="w-2.5 h-2.5 text-zinc-400" />
            <span>Individual</span>
          </span>
        )
    }
  }

  const attachments = loadedAttachments.length > 0 ? loadedAttachments : (task.attachments || [])

  return (
    <>
      <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-md animate-backdrop-fade overscroll-none touch-none">
        {/* Backdrop táctil para cerrar */}
        <div
          className="absolute inset-0 z-0 cursor-pointer touch-none overscroll-none"
          onClick={onClose}
        />

        {/* Contenedor Modal */}
        <div
          style={{
            transform: `translateY(${dragOffsetY}px)`,
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative z-10 w-full max-w-lg mx-auto bg-zinc-950 border-t border-zinc-800 rounded-t-[28px] p-5 pb-8 shadow-2xl flex flex-col max-h-[85vh] transition-transform select-none overscroll-none animate-sheet-up"
        >
          {/* Header del Modal con área táctil para cerrar por gesto */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full flex flex-col items-center pt-1 pb-3 cursor-grab active:cursor-grabbing touch-none select-none"
          >
            <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full mb-3" />
            <h2 className="text-sm font-semibold text-zinc-200 tracking-tight">Detalles de la Tarea</h2>
          </div>

          {/* Cuerpo Desplazable del Modal */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 overscroll-none touch-pan-y">
            <div className="space-y-3.5">
              {/* Materia, Tipo de Tarea y Botón Completar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {task.subject ? (
                    <span
                      className="px-2 py-0.5 rounded-lg text-xs font-semibold border shrink-0"
                      style={{
                        backgroundColor: `${task.subject.color}15`,
                        color: task.subject.color,
                        borderColor: `${task.subject.color}35`,
                      }}
                    >
                      {task.subject.name}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                      General
                    </span>
                  )}

                  {getTypeBadge(task.type)}

                  {task.is_private && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] font-medium text-amber-300">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>Privada</span>
                    </span>
                  )}
                </div>

                {/* Botón Circular para Marcar Completada */}
                <button
                  type="button"
                  onClick={handleCheck}
                  aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-white text-zinc-950 font-bold shadow-md shadow-white/20'
                      : 'border-2 border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
                  }`}
                >
                  {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                </button>
              </div>

              {/* Título de la Tarea */}
              <div>
                <h3
                  className={`text-base font-bold text-white leading-snug ${
                    isCompleted ? 'line-through text-zinc-500' : ''
                  }`}
                >
                  {task.title}
                </h3>

                {/* Fecha Límite */}
                <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{formatTaskDate(task.due_date)}</span>
                  </span>
                </div>
              </div>

              {/* Descripción / Notas */}
              {task.description ? (
                <div className="pt-2.5 border-t border-zinc-800/80">
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                </div>
              ) : (
                <div className="pt-2.5 border-t border-zinc-800/80">
                  <p className="text-xs text-zinc-600 italic">Sin notas adicionales.</p>
                </div>
              )}

              {/* ========================================================================= */}
              {/* MATERIAL Y ARCHIVOS ADJUNTOS DE LA TAREA (Subidos por el delegado/creador) */}
              {/* ========================================================================= */}
              {attachments.length > 0 && (
                <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Archivos y Recursos Adjuntos ({attachments.length})</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {attachments.map((att, idx) => {
                      if (att.file_type === 'image') {
                        return (
                          <div
                            key={att.id || idx}
                            onClick={() => setSelectedImageForLightbox(att.file_url)}
                            className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/90 flex items-center gap-2.5 cursor-pointer hover:border-zinc-700 transition-colors active:scale-[0.99]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={att.file_url}
                              alt={att.file_name}
                              className="w-10 h-10 object-cover rounded-lg shrink-0 border border-zinc-800"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-zinc-200 truncate">
                                {att.file_name}
                              </p>
                              <span className="text-[10px] text-zinc-400 font-medium">
                                Ver en pantalla completa
                              </span>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <a
                          key={att.id || idx}
                          href={att.file_url}
                          download={att.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/90 flex items-center gap-2.5 hover:border-zinc-700 transition-colors active:scale-[0.99]"
                        >
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-200 truncate">
                              {att.file_name}
                            </p>
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                              Descargar / Abrir documento
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botones de Gestión (Editar / Eliminar para Administrador o Creador) */}
          {canManageTask && (
            <div className="pt-3 mt-2 border-t border-zinc-800/80 flex items-center gap-2">
              {onEditTask && (
                <button
                  type="button"
                  onClick={() => {
                    onEditTask(task)
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Editar</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-red-400 hover:bg-red-950/40 hover:border-red-800/60 font-medium text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación para Eliminar Tarea */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-center space-y-4 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">¿Eliminar esta tarea?</h4>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Esta acción no se puede deshacer. Se eliminarán sus notas y archivos adjuntos oficiales.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-semibold text-xs transition-all shadow-md shadow-red-950/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <span>Eliminar Tarea</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 active:scale-[0.98] text-zinc-300 font-medium text-xs transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor Lightbox de Pantalla Completa para Fotos Adjuntas */}
      {selectedImageForLightbox && (
        <div
          className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-4 animate-fade-in cursor-pointer select-none"
          onClick={() => setSelectedImageForLightbox(null)}
        >
          <div className="max-w-full max-h-[85vh] overflow-auto flex items-center justify-center pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImageForLightbox}
              alt="Recurso adjunto"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
          <p className="text-xs text-zinc-400 mt-4 font-mono font-medium">
            Toca en cualquier parte para cerrar
          </p>
        </div>
      )}
    </>
  )
}
