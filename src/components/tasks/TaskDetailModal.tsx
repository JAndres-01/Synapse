'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Task, TaskComment, Profile, AttachmentType } from '@/types/database'
import {
  X,
  Clock,
  Trash2,
  Send,
  CornerDownRight,
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
  Image as ImageIcon,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { compressImageFile } from '@/lib/utils'

interface TaskDetailModalProps {
  task: Task | null
  onClose: () => void
  currentUser: { id: string; email?: string } | null
  currentProfile: Profile | null
  isAdmin: boolean
  onToggleStatus: (taskId: string, currentStatus: string) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onEditTask?: (task: Task) => void
  onAddComment: (
    taskId: string,
    content: string,
    parentCommentId?: string | null,
    imageUrl?: string | null,
    fileName?: string | null,
    fileType?: AttachmentType | null
  ) => Promise<void>
}

interface CommentAttachment {
  fileUrl: string
  fileName: string
  fileType: AttachmentType
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
  onEditTask,
  onAddComment,
}: TaskDetailModalProps) {
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<TaskComment | null>(null)
  const [commentLoading, setCommentLoading] = useState(false)
  const [selectedImageForLightbox, setSelectedImageForLightbox] = useState<string | null>(null)
  const [previewAttachments, setPreviewAttachments] = useState<CommentAttachment[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (dragOffsetY > 65) {
      document.body.classList.remove('body-scroll-lock')
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

  // Adjuntar múltiples imágenes o documentos en el comentario
  const handleCommentFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (previewAttachments.length + files.length > 5) {
      return
    }

    for (const file of Array.from(files)) {
      try {
        const isImage = file.type.startsWith('image/')
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
        const fileType: AttachmentType = isImage ? 'image' : isPdf ? 'pdf' : 'link'

        const { fileUrl, fileName } = await compressImageFile(file, 2048, 0.85)
        setPreviewAttachments((prev) => [
          ...prev,
          {
            fileUrl,
            fileName,
            fileType,
          },
        ])
      } catch (err) {
        console.error('Error procesando archivo adjunto en comentario:', err)
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removePreviewAttachment = (indexToRemove: number) => {
    setPreviewAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!commentText.trim() && previewAttachments.length === 0) return

    try {
      setCommentLoading(true)

      let serializedImageUrl: string | null = null
      let serializedFileName: string | null = null
      let serializedFileType: AttachmentType | null = null

      if (previewAttachments.length === 1) {
        serializedImageUrl = previewAttachments[0].fileUrl
        serializedFileName = previewAttachments[0].fileName
        serializedFileType = previewAttachments[0].fileType
      } else if (previewAttachments.length > 1) {
        serializedImageUrl = JSON.stringify(previewAttachments)
      }

      await onAddComment(
        task.id,
        commentText.trim(),
        replyingTo ? replyingTo.id : null,
        serializedImageUrl,
        serializedFileName,
        serializedFileType
      )
      setCommentText('')
      setPreviewAttachments([])
      setReplyingTo(null)
    } catch (err) {
      console.error('Error enviando comentario:', err)
    } finally {
      setCommentLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    try {
      setDeleteLoading(true)
      document.body.classList.remove('body-scroll-lock')
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

  const attachments = task.attachments || []

  // Extraer todos los adjuntos de un comentario (soporta adjunto único o múltiples en JSON)
  const parseCommentAttachments = (c: TaskComment): CommentAttachment[] => {
    if (!c.image_url) return []
    if (c.image_url.startsWith('[') && c.image_url.endsWith(']')) {
      try {
        const parsed = JSON.parse(c.image_url)
        if (Array.isArray(parsed)) return parsed
      } catch {}
    }

    const isImage =
      c.file_type === 'image' ||
      (!c.file_type &&
        (c.image_url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp)$/i.test(c.image_url)))

    return [
      {
        fileUrl: c.image_url,
        fileName: c.file_name || (isImage ? 'Foto de apunte' : 'Documento adjunto'),
        fileType: (c.file_type || (isImage ? 'image' : 'pdf')) as AttachmentType,
      },
    ]
  }

  // Renderizar imágenes y documentos de un comentario
  const renderCommentAttachments = (c: TaskComment) => {
    const list = parseCommentAttachments(c)
    if (list.length === 0) return null

    return (
      <div className="flex flex-col gap-1.5 pt-1">
        {list.map((item, idx) => {
          if (item.fileType === 'image') {
            return (
              <div
                key={idx}
                onClick={() => setSelectedImageForLightbox(item.fileUrl)}
                className="relative rounded-xl overflow-hidden border border-zinc-800 max-w-xs cursor-pointer group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.fileUrl}
                  alt={item.fileName}
                  className="w-full h-36 object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-xs text-white bg-black/70 px-2 py-1 rounded-md">
                    Ver en pantalla completa
                  </span>
                </div>
              </div>
            )
          }

          return (
            <a
              key={idx}
              href={item.fileUrl}
              download={item.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 active:scale-[0.98] transition-all max-w-fit"
            >
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate max-w-[180px] text-[11px] font-medium">
                {item.fileName}
              </span>
              <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0 ml-1" />
            </a>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0 overflow-hidden touch-none pt-[calc(env(safe-area-inset-top,44px)+20px)]"
        onClick={() => {
          document.body.classList.remove('body-scroll-lock')
          onClose()
        }}
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
                  <span>Privada</span>
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
              {/* Botón Editar Tarea (Solo si tiene permisos) */}
              {canManageTask && onEditTask && (
                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  title="Editar tarea"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {/* Botón Eliminar Tarea */}
              {canManageTask && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Eliminar tarea"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  document.body.classList.remove('body-scroll-lock')
                  onClose()
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenido scrolleable del Detalle y Comentarios */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar min-h-0 overscroll-contain">
            {/* Tarjeta de Información Principal */}
            <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={handleCheck}
                  aria-label="Marcar completada"
                  className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                      : 'border-zinc-600 hover:border-zinc-400 bg-zinc-950/90 active:scale-90'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                <div className="space-y-1 min-w-0 flex-1">
                  <h2
                    className={`text-base font-bold leading-snug break-words ${
                      isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100'
                    }`}
                  >
                    {task.title}
                  </h2>

                  <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{formatTaskDate(task.due_date)}</span>
                    </span>
                  </div>
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
              {/* MATERIAL Y ARCHIVOS ADJUNTOS DE LA TAREA                                  */}
              {/* ========================================================================= */}
              {attachments.length > 0 && (
                <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
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
                              <span className="text-[10px] text-indigo-400 font-medium">
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
                          <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
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

            {/* ========================================================================= */}
            {/* SECCIÓN DE DISCUSIÓN & APUNTES COLABORATIVOS (Hilos con árbol conectado)   */}
            {/* ========================================================================= */}
            {!task.is_private && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span>Preguntas, Apuntes & Archivos</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                      {comments.length}
                    </span>
                  </h3>
                </div>

                {/* Lista de Comentarios en Árbol */}
                <div className="space-y-3">
                  {rootComments.length === 0 ? (
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/40 text-center text-xs text-zinc-500 italic">
                      No hay comentarios aún. Puedes hacer una pregunta o compartir fotos y archivos de apuntes.
                    </div>
                  ) : (
                    rootComments.map((root) => {
                      const replies = getReplies(root.id)
                      const isAuthorDelegate = root.author?.role === 'admin' || (root.author?.role as string) === 'delegate'

                      return (
                        <div key={root.id} className="space-y-2">
                          {/* Comentario Raíz */}
                          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-2 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                                  {root.author?.full_name?.slice(0, 1) || 'A'}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-zinc-200">
                                    {root.author?.full_name || 'Compañero'}
                                  </span>
                                  {isAuthorDelegate && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-950 text-indigo-400 font-medium border border-indigo-800/50">
                                      Delegado
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="text-[10px] text-zinc-500 font-mono">
                                {formatCommentDate(root.created_at)}
                              </span>
                            </div>

                            {/* Contenido del comentario */}
                            {root.content && (
                              <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pl-1">
                                {root.content}
                              </p>
                            )}

                            {/* Imágenes o Documentos adjuntos */}
                            {renderCommentAttachments(root)}

                            {/* Botón Responder */}
                            <div className="pt-1 flex items-center justify-between border-t border-zinc-900">
                              {replies.length > 0 ? (
                                <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1">
                                  <span>{replies.length} {replies.length === 1 ? 'respuesta' : 'respuestas'}</span>
                                </span>
                              ) : <span />}

                              <button
                                type="button"
                                onClick={() => setReplyingTo(root)}
                                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 py-0.5 px-2 rounded-lg hover:bg-zinc-900 transition-colors"
                              >
                                <CornerDownRight className="w-3 h-3" />
                                <span>Responder</span>
                              </button>
                            </div>
                          </div>

                          {/* Hilos Anidados con Conectores Visuales */}
                          {replies.length > 0 && (
                            <div className="relative pl-6 space-y-2 mt-1 ml-3 border-l-2 border-indigo-800/50">
                              {replies.map((reply) => {
                                const isReplyDelegate =
                                  reply.author?.role === 'admin' ||
                                  (reply.author?.role as string) === 'delegate'

                                return (
                                  <div
                                    key={reply.id}
                                    className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5 relative shadow-sm"
                                  >
                                    {/* Rama conectora curva hacia el hilo principal */}
                                    <div className="absolute -left-6 top-4 w-4 h-3.5 border-b-2 border-l-2 border-indigo-600/70 rounded-bl-lg pointer-events-none" />

                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-300">
                                          {reply.author?.full_name?.slice(0, 1) || 'A'}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-xs font-semibold text-zinc-200">
                                            {reply.author?.full_name || 'Compañero'}
                                          </span>
                                          {isReplyDelegate && (
                                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-400 font-medium border border-indigo-800/40">
                                              Delegado
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <span className="text-[10px] text-zinc-500 font-mono">
                                        {formatCommentDate(reply.created_at)}
                                      </span>
                                    </div>

                                    {reply.content && (
                                      <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pl-0.5">
                                        {reply.content}
                                      </p>
                                    )}

                                    {/* Imágenes o Documentos adjuntos en respuesta */}
                                    {renderCommentAttachments(reply)}

                                    <div className="pt-0.5 flex items-center justify-end">
                                      <button
                                        type="button"
                                        onClick={() => setReplyingTo(root)}
                                        className="text-[10px] text-zinc-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                                      >
                                        <CornerDownRight className="w-2.5 h-2.5" />
                                        <span>Responder al hilo</span>
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BARRA DE ENTRADA PARA NUEVO COMENTARIO CON MULTI-FOTOS Y DOCUMENTOS       */}
          {/* ========================================================================= */}
          {!task.is_private && (
            <div className="pt-2 border-t border-zinc-800 space-y-2 shrink-0">
              {/* Indicador de Respuesta */}
              {replyingTo && (
                <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <CornerDownRight className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      Respondiendo a{' '}
                      <strong className="text-zinc-200">
                        {replyingTo.author?.full_name || 'Compañero'}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Previsualización de Archivos y Fotos antes de enviar */}
              {previewAttachments.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {previewAttachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1.5 rounded-xl border border-zinc-800 text-xs shrink-0"
                    >
                      {att.fileType === 'image' ? (
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="text-[11px] text-zinc-200 max-w-[120px] truncate">
                        {att.fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePreviewAttachment(idx)}
                        className="p-0.5 rounded-full text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCommentFilePick}
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar fotos o documentos al comentario"
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    replyingTo
                      ? `Responde a ${replyingTo.author?.full_name || 'compañero'}...`
                      : 'Escribe una duda o comparte archivos...'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendComment()
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />

                <button
                  type="button"
                  onClick={() => handleSendComment()}
                  disabled={(!commentText.trim() && previewAttachments.length === 0) || commentLoading}
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
      {/* ADVERTENCIA NATIVA ESTILO IOS ACTION SHEET PARA ELIMINAR TAREA            */}
      {/* ========================================================================= */}
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
                Esta acción no se puede deshacer. Se eliminarán sus notas, archivos adjuntos, hilos de discusión y fotos de apuntes.
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

      {/* ========================================================================= */}
      {/* VISOR LIGHTBOX DE PANTALLA COMPLETA PARA FOTOS DE APUNTES & PIZARRAS      */}
      {/* ========================================================================= */}
      {selectedImageForLightbox && (
        <div
          className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-4 animate-fade-in cursor-pointer select-none"
          onClick={() => setSelectedImageForLightbox(null)}
        >
          <div
            className="max-w-full max-h-[85vh] overflow-auto flex items-center justify-center pointer-events-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImageForLightbox}
              alt="Apunte en alta resolución"
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
