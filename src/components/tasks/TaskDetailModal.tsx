'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Task, TaskComment, Profile } from '@/types/database'
import {
  X,
  Send,
  Loader2,
  Check,
  Calendar,
  User,
  Users,
  Rocket,
  FileText,
  Lock,
  CornerDownRight,
  Camera,
  Trash2,
  Maximize2,
} from 'lucide-react'
import confetti from 'canvas-confetti'

interface TaskDetailModalProps {
  task: Task | null
  onClose: () => void
  currentUser: { id: string } | null
  currentProfile: Profile | null
  isAdmin: boolean
  onToggleStatus: (taskId: string, currentStatus: string) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onAddComment: (
    taskId: string,
    content: string,
    parentCommentId?: string | null,
    imageUrl?: string | null
  ) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
}

function formatDetailDate(dateStr?: string) {
  if (!dateStr) return 'Sin fecha'
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

function formatCommentDate(dateStr?: string) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const timeStr = d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    if (isToday) return `Hoy, ${timeStr}`
    return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, ${timeStr}`
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
  onAddComment,
}: TaskDetailModalProps) {
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<TaskComment | null>(null)
  const [commentLoading, setCommentLoading] = useState(false)
  const [selectedImageForLightbox, setSelectedImageForLightbox] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Gestos táctiles
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  const isCompleted =
    Array.isArray(task?.user_status) &&
    task.user_status.length > 0 &&
    task.user_status[0]?.status === 'completed'

  const canManageTask =
    isAdmin || (task && currentUser && task.created_by === currentUser.id)

  useEffect(() => {
    if (task) {
      document.body.classList.add('body-scroll-lock')
    } else {
      document.body.classList.remove('body-scroll-lock')
      setDragOffsetY(0)
    }
    return () => {
      document.body.classList.remove('body-scroll-lock')
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
    if (deltaY > 0) setDragOffsetY(deltaY)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (dragOffsetY > 75) {
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

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Previsualización y lectura en Base64
    const reader = new FileReader()
    reader.onload = (event) => {
      setPreviewImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!commentText.trim() && !previewImage) return

    try {
      setCommentLoading(true)
      await onAddComment(
        task.id,
        commentText.trim(),
        replyingTo ? replyingTo.id : null,
        previewImage
      )
      setCommentText('')
      setPreviewImage(null)
      setReplyingTo(null)
    } catch (err) {
      console.error('Error enviando comentario:', err)
    } finally {
      setCommentLoading(false)
    }
  }

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

  // Agrupar comentarios en estructura de árbol (Padres e Hijos)
  const comments = task.comments || []
  const rootComments = comments.filter((c) => !c.parent_comment_id)
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_comment_id === parentId)

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0 overflow-hidden touch-none pt-[calc(env(safe-area-inset-top,44px)+20px)]"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl px-5 pt-3 pb-6 space-y-3.5 max-h-[calc(100dvh-env(safe-area-inset-top,44px)-24px)] flex flex-col shadow-2xl transition-transform overflow-hidden"
          style={{
            transform: `translateY(${dragOffsetY}px)`,
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag Handle & Header Top Area */}
          <div
            className="w-full pt-1 pb-1 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-12 h-1.5 rounded-full bg-zinc-700 active:bg-zinc-500 mx-auto transition-colors mb-2.5" />
          </div>

          {/* Header del Modal */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {task.is_private ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-800/50 text-[10px] font-semibold text-amber-400">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Pendiente Personal</span>
                </span>
              ) : (
                getTypeBadge(task.type)
              )}

              {task.subject && (
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full border border-zinc-700"
                    style={{ backgroundColor: task.subject.color || '#FFFFFF' }}
                  />
                  <span>{task.subject.name}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {canManageTask && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Deseas eliminar esta tarea?')) {
                      onDeleteTask(task.id)
                      onClose()
                    }
                  }}
                  title="Eliminar tarea"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenido scrolleable del Detalle y Comentarios */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
            {/* Tarjeta de Información Principal */}
            <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={handleCheck}
                  aria-label="Marcar completada"
                  className={`w-6 h-6 rounded-full border shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-zinc-700 hover:border-zinc-400 bg-zinc-900 active:scale-90'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                </button>

                <div className="flex-1 min-w-0">
                  <h2
                    className={`text-base font-bold tracking-tight leading-snug ${
                      isCompleted ? 'line-through text-zinc-400' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </h2>
                  <span
                    className={`text-[11px] font-medium block mt-0.5 ${
                      isCompleted ? 'text-emerald-400' : 'text-amber-400 font-semibold'
                    }`}
                  >
                    {isCompleted ? 'Completada por ti' : 'Pendiente de entrega'}
                  </span>
                </div>
              </div>

              {task.description && (
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap pl-9">
                  {task.description}
                </p>
              )}

              <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Entrega: {formatDetailDate(task.due_date)}</span>
                </span>
              </div>
            </div>

            {/* Sección de Discusión Colaborativa & Fotos de Apuntes (Solo en tareas del salón) */}
            {!task.is_private && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between px-0.5">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Discusión & Apuntes</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                      {comments.length}
                    </span>
                  </h4>
                  <span className="text-[10px] text-zinc-500">
                    Preguntas y fotos de pizarras
                  </span>
                </div>

                {rootComments.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-850 text-center text-xs text-zinc-500 space-y-1">
                    <p>No hay preguntas ni fotos de apuntes aún.</p>
                    <p className="text-[10px] text-zinc-600">
                      Sé el primero en compartir una foto de la pizarra o resolver dudas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rootComments.map((root) => {
                      const replies = getReplies(root.id)

                      return (
                        <div key={root.id} className="space-y-2">
                          {/* Comentario Padre */}
                          <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 text-xs space-y-2 relative group">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-zinc-200">
                                {root.author?.full_name || 'Compañero'}
                              </span>
                              <span className="text-zinc-500 font-mono">
                                {formatCommentDate(root.created_at)}
                              </span>
                            </div>

                            {root.content && (
                              <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">
                                {root.content}
                              </p>
                            )}

                            {/* Foto de Apunte / Pizarra Adjunta */}
                            {root.image_url && (
                              <div className="relative rounded-xl overflow-hidden border border-zinc-800 mt-2 max-h-48 group/img">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={root.image_url}
                                  alt="Foto de apunte"
                                  onClick={() => setSelectedImageForLightbox(root.image_url!)}
                                  className="w-full h-auto object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => setSelectedImageForLightbox(root.image_url!)}
                                  className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-black/70 text-white backdrop-blur-sm opacity-90 hover:opacity-100 transition-opacity"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Botón Responder */}
                            <div className="pt-1 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(root)
                                  setCommentText(`@${root.author?.full_name?.split(' ')[0] || 'Compañero'} `)
                                }}
                                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                              >
                                <CornerDownRight className="w-3 h-3" />
                                <span>Responder</span>
                              </button>
                            </div>
                          </div>

                          {/* Hilo Anidado de Respuestas Conectadas Visualmente */}
                          {replies.length > 0 && (
                            <div className="pl-4 ml-3 border-l-2 border-zinc-800 space-y-2 relative">
                              {replies.map((reply) => (
                                <div
                                  key={reply.id}
                                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs space-y-1.5 relative"
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-zinc-300">
                                        {reply.author?.full_name || 'Compañero'}
                                      </span>
                                      <span className="text-zinc-600">•</span>
                                      <span className="text-[10px] text-zinc-500">
                                        en respuesta
                                      </span>
                                    </div>
                                    <span className="text-zinc-500 font-mono">
                                      {formatCommentDate(reply.created_at)}
                                    </span>
                                  </div>

                                  {reply.content && (
                                    <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">
                                      {reply.content}
                                    </p>
                                  )}

                                  {reply.image_url && (
                                    <div className="relative rounded-xl overflow-hidden border border-zinc-800 mt-2 max-h-40">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={reply.image_url}
                                        alt="Foto de apunte"
                                        onClick={() => setSelectedImageForLightbox(reply.image_url!)}
                                        className="w-full h-auto object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                      />
                                    </div>
                                  )}

                                  <div className="pt-0.5 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingTo(root)
                                        setCommentText(`@${reply.author?.full_name?.split(' ')[0] || 'Compañero'} `)
                                      }}
                                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                                    >
                                      <CornerDownRight className="w-2.5 h-2.5" />
                                      <span>Responder</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formulario para Comentar / Adjuntar Foto (Solo en tareas del salón) */}
          {!task.is_private && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-2 shrink-0">
              {/* Indicador de Respondiendo a */}
              {replyingTo && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400">
                  <span className="truncate flex items-center gap-1">
                    <CornerDownRight className="w-3 h-3 text-indigo-400" />
                    <span>Respondiendo a @{replyingTo.author?.full_name || 'Compañero'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Previsualización de Imagen Adjunta */}
              {previewImage && (
                <div className="relative inline-block border border-zinc-700 rounded-xl overflow-hidden bg-zinc-950 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewImage}
                    alt="Previsualización de apunte"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewImage(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/80 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImagePick}
                  className="hidden"
                />

                {/* Botón de Cámara / Galería */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Subir foto de apunte o pizarra"
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  <Camera className="w-4 h-4 text-indigo-400" />
                </button>

                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    replyingTo
                      ? `Responde a ${replyingTo.author?.full_name?.split(' ')[0]}...`
                      : 'Pregunta o comparte apuntes del salón...'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendComment()
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />

                <button
                  type="button"
                  onClick={() => handleSendComment()}
                  disabled={(!commentText.trim() && !previewImage) || commentLoading}
                  className="p-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold disabled:opacity-40 transition-colors"
                >
                  {commentLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISOR LIGHTBOX DE PANTALLA COMPLETA PARA FOTOS DE APUNTES & PIZARRAS      */}
      {/* ========================================================================= */}
      {selectedImageForLightbox && (
        <div
          className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedImageForLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedImageForLightbox(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-zinc-800/80 text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="max-w-full max-h-[85vh] overflow-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImageForLightbox}
              alt="Apunte en alta resolución"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
          <p className="text-xs text-zinc-400 mt-3 font-mono">
            Toca en cualquier parte para cerrar
          </p>
        </div>
      )}
    </>
  )
}
