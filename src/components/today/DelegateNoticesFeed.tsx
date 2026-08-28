'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Notice, NoticeCategory } from '@/types/database'
import {
  Megaphone,
  School,
  GraduationCap,
  MessageSquare,
  Send,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Pin,
  MoreVertical,
  Edit3,
  Trash2,
} from 'lucide-react'

interface DelegateNoticesFeedProps {
  notices: Notice[]
  currentUserId: string
  isAdmin: boolean
  onAddNotice: (content: string, category: NoticeCategory, isUrgent: boolean, isPinned: boolean) => Promise<void>
  onEditNotice: (noticeId: string, content: string, category: NoticeCategory, isUrgent: boolean, isPinned: boolean) => Promise<void>
  onDeleteNotice: (noticeId: string) => Promise<void>
  onTogglePinNotice: (noticeId: string, currentPinned: boolean) => Promise<void>
  onAddComment: (noticeId: string, content: string) => Promise<void>
}

// Formateador de fecha con hora exacta (ej. "Hoy, 08:30 AM" o "27 ago, 07:45 PM")
function formatNoticeDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const timeStr = d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

    if (isToday) return `Hoy, ${timeStr}`
    if (isYesterday) return `Ayer, ${timeStr}`

    const dateFormatted = d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })

    return `${dateFormatted}, ${timeStr}`
  } catch {
    return dateStr
  }
}

export function DelegateNoticesFeed({
  notices,
  currentUserId,
  isAdmin,
  onAddNotice,
  onEditNotice,
  onDeleteNotice,
  onTogglePinNotice,
  onAddComment,
}: DelegateNoticesFeedProps) {
  // Modal de Detalle de Aviso (para ver texto completo y respuestas)
  const [selectedNoticeForDetail, setSelectedNoticeForDetail] = useState<Notice | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentingLoading, setCommentingLoading] = useState(false)

  // Modal de Creación
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<NoticeCategory>('cambio_aula')
  const [newIsUrgent, setNewIsUrgent] = useState(false)
  const [newIsPinned, setNewIsPinned] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  // Modal de Edición
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState<NoticeCategory>('cambio_aula')
  const [editIsUrgent, setEditIsUrgent] = useState(false)
  const [editIsPinned, setEditIsPinned] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  // Menú de opciones de tarjeta activa
  const [activeMenuNoticeId, setActiveMenuNoticeId] = useState<string | null>(null)

  // Gestos táctiles de swipe down para modales
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  const isAnyModalOpen = !!selectedNoticeForDetail || showCreateModal || !!editingNotice

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.classList.add('body-scroll-lock')
    } else {
      document.body.classList.remove('body-scroll-lock')
      setDragOffsetY(0)
    }
    return () => {
      document.body.classList.remove('body-scroll-lock')
    }
  }, [isAnyModalOpen])

  // Mantener actualizado el aviso en detalle si cambian los comentarios
  useEffect(() => {
    if (selectedNoticeForDetail) {
      const fresh = notices.find((n) => n.id === selectedNoticeForDetail.id)
      if (fresh) setSelectedNoticeForDetail(fresh)
    }
  }, [notices, selectedNoticeForDetail])

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaY = e.touches[0].clientY - dragStartYRef.current
    if (deltaY > 0) setDragOffsetY(deltaY)
  }

  const handleTouchEnd = (closeCallback: () => void) => {
    setIsDragging(false)
    if (dragOffsetY > 75) {
      closeCallback()
    } else {
      setDragOffsetY(0)
    }
  }

  const getCategoryBadge = (category: NoticeCategory) => {
    switch (category) {
      case 'cambio_aula':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded-md">
            <School className="w-3 h-3" />
            <span>Salón</span>
          </span>
        )
      case 'evento_escolar':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-950/50 border border-purple-800/50 px-2 py-0.5 rounded-md">
            <GraduationCap className="w-3 h-3" />
            <span>Evento</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-md">
            <Megaphone className="w-3 h-3 text-zinc-400" />
            <span>General</span>
          </span>
        )
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return

    try {
      setCreateLoading(true)
      await onAddNotice(newContent.trim(), newCategory, newIsUrgent, newIsPinned)
      setNewContent('')
      setNewCategory('cambio_aula')
      setNewIsUrgent(false)
      setNewIsPinned(false)
      setShowCreateModal(false)
    } catch (err) {
      console.error('Error publicando aviso:', err)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleStartEdit = (notice: Notice) => {
    setEditingNotice(notice)
    setEditContent(notice.content)
    setEditCategory(notice.category)
    setEditIsUrgent(notice.is_urgent)
    setEditIsPinned(!!notice.is_pinned)
    setActiveMenuNoticeId(null)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingNotice || !editContent.trim()) return

    try {
      setEditLoading(true)
      await onEditNotice(
        editingNotice.id,
        editContent.trim(),
        editCategory,
        editIsUrgent,
        editIsPinned
      )
      setEditingNotice(null)
    } catch (err) {
      console.error('Error editando aviso:', err)
    } finally {
      setEditLoading(false)
    }
  }

  const handleSendComment = async (noticeId: string) => {
    if (!commentText.trim()) return
    try {
      setCommentingLoading(true)
      await onAddComment(noticeId, commentText.trim())
      setCommentText('')
    } catch (err) {
      console.error('Error comentando en aviso:', err)
    } finally {
      setCommentingLoading(false)
    }
  }

  // Ordenar avisos: primero los fijados (is_pinned = true), luego por fecha reciente
  const sortedNotices = [...notices].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="space-y-3">
      {/* Header del Canal de Avisos */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <Megaphone className="w-3.5 h-3.5 text-zinc-400" />
          <span>Avisos del Salón</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
            {notices.length}
          </span>
        </h3>

        {/* Solo delegados y administradores pueden publicar avisos */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publicar</span>
          </button>
        )}
      </div>

      {sortedNotices.length === 0 ? (
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center text-xs text-zinc-500">
          No hay avisos publicados en el salón.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotices.map((notice) => {
            const commentsCount = notice.comments?.length || 0
            const isLongText = notice.content.length > 130
            const canManage = isAdmin || notice.author_id === currentUserId
            const isMenuOpen = activeMenuNoticeId === notice.id

            return (
              <div
                key={notice.id}
                className={`p-4 rounded-2xl border space-y-2.5 transition-all shadow-sm relative ${
                  notice.is_pinned
                    ? 'bg-zinc-900/90 border-indigo-500/40 shadow-indigo-950/20'
                    : 'bg-zinc-900/70 border-zinc-800'
                }`}
              >
                {/* Header del Aviso: Categoría, Fijado, Urgente, Fecha con Hora y Menú */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {notice.is_pinned && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 px-1.5 py-0.5 rounded">
                        <Pin className="w-2.5 h-2.5" />
                        <span>Fijado</span>
                      </span>
                    )}

                    {getCategoryBadge(notice.category)}

                    {notice.is_urgent && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-800/50 px-1.5 py-0.5 rounded">
                        URGENTE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {formatNoticeDate(notice.created_at)}
                    </span>

                    {/* Menú de opciones para delegados */}
                    {canManage && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuNoticeId(isMenuOpen ? null : notice.id)
                          }
                          aria-label="Opciones de aviso"
                          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-6 w-32 bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-2xl z-20 space-y-0.5 animate-fade-in">
                            <button
                              type="button"
                              onClick={() => {
                                onTogglePinNotice(notice.id, !!notice.is_pinned)
                                setActiveMenuNoticeId(null)
                              }}
                              className="w-full px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:bg-zinc-900 rounded-lg flex items-center gap-1.5"
                            >
                              <Pin className="w-3 h-3" />
                              <span>{notice.is_pinned ? 'Desfijar' : 'Fijar'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(notice)}
                              className="w-full px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:bg-zinc-900 rounded-lg flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onDeleteNotice(notice.id)
                                setActiveMenuNoticeId(null)
                              }}
                              className="w-full px-2 py-1.5 text-left text-[11px] text-red-400 hover:bg-red-950/40 rounded-lg flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contenido (Click abre el modal de detalle) */}
                <div
                  onClick={() => setSelectedNoticeForDetail(notice)}
                  className="cursor-pointer space-y-1.5"
                >
                  <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap line-clamp-3">
                    {notice.content}
                  </p>

                  {isLongText && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 inline-block"
                    >
                      Ver más...
                    </button>
                  )}
                </div>

                {/* Footer del Aviso */}
                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Por {notice.author?.full_name || 'Compañero'}</span>

                  <button
                    type="button"
                    onClick={() => setSelectedNoticeForDetail(notice)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>
                      {commentsCount > 0
                        ? `${commentsCount} ${commentsCount === 1 ? 'respuesta' : 'respuestas'}`
                        : 'Responder'}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MODAL DETALLE DE AVISO (Lectura completa y Sección de Respuestas)       */}
      {/* ========================================================================= */}
      {selectedNoticeForDetail && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0"
          onClick={() => setSelectedNoticeForDetail(null)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pt-2 pb-6 space-y-4 max-h-[90vh] flex flex-col shadow-2xl transition-transform"
            style={{
              transform: `translateY(${dragOffsetY}px)`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div
              className="w-full py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(() => setSelectedNoticeForDetail(null))}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700 active:bg-zinc-500 transition-colors" />
            </div>

            {/* Header del Modal */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {selectedNoticeForDetail.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 px-1.5 py-0.5 rounded">
                    <Pin className="w-2.5 h-2.5" />
                    <span>Fijado</span>
                  </span>
                )}
                {getCategoryBadge(selectedNoticeForDetail.category)}
                {selectedNoticeForDetail.is_urgent && (
                  <span className="text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-800/50 px-1.5 py-0.5 rounded">
                    URGENTE
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedNoticeForDetail(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido scrolleable del aviso y comentarios */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
              {/* Contenido Completo del Aviso */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-100 leading-relaxed whitespace-pre-wrap">
                  {selectedNoticeForDetail.content}
                </p>
                <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Publicado por {selectedNoticeForDetail.author?.full_name || 'Compañero'}</span>
                  <span className="font-mono">{formatNoticeDate(selectedNoticeForDetail.created_at)}</span>
                </div>
              </div>

              {/* Hilo de Respuestas (Visible únicamente en este modal) */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Respuestas ({selectedNoticeForDetail.comments?.length || 0})</span>
                </h4>

                {selectedNoticeForDetail.comments && selectedNoticeForDetail.comments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNoticeForDetail.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-zinc-300">
                            {comment.author?.full_name || 'Compañero'}
                          </span>
                          <span className="text-zinc-500 font-mono">
                            {formatNoticeDate(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-zinc-200 text-xs leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-zinc-600 py-3 italic">
                    Aún no hay respuestas en este aviso. Sé el primero en responder.
                  </p>
                )}
              </div>
            </div>

            {/* Input para responder */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escribe una respuesta para el salón..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendComment(selectedNoticeForDetail.id)
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={() => handleSendComment(selectedNoticeForDetail.id)}
                disabled={!commentText.trim() || commentingLoading}
                className="p-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold disabled:opacity-40 transition-colors"
              >
                {commentingLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL CREAR AVISO (Solo para delegados/admins)                          */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pt-2 pb-5 space-y-3.5 max-h-[88vh] overflow-y-auto shadow-2xl transition-transform"
            style={{
              transform: `translateY(${dragOffsetY}px)`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div
              className="w-full py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(() => setShowCreateModal(false))}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700 active:bg-zinc-500 transition-colors" />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <School className="w-4 h-4 text-indigo-400" />
                <span>Publicar Aviso en el Salón</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                  Tipo de Aviso
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory('cambio_aula')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1.5 transition-all ${
                      newCategory === 'cambio_aula'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <School className="w-4 h-4" />
                    <span>Salón</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCategory('aviso_general')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1.5 transition-all ${
                      newCategory === 'aviso_general'
                        ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>General</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCategory('evento_escolar')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1.5 transition-all ${
                      newCategory === 'evento_escolar'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Evento</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Mensaje
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Escribe lo que ocurre en el salón (ej. retraso de docente, cambios, avisos de clase...)"
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              {/* Opciones: Urgente y Fijar */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-zinc-200">Urgente</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newIsUrgent}
                    onChange={(e) => setNewIsUrgent(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs text-zinc-200">Fijar arriba</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newIsPinned}
                    onChange={(e) => setNewIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createLoading || !newContent.trim()}
                className="w-full py-3 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {createLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                ) : (
                  <span>Publicar en el Salón</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL EDITAR AVISO (Editar contenido, categoría, urgente y fijado)     */}
      {/* ========================================================================= */}
      {editingNotice && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0"
          onClick={() => setEditingNotice(null)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pt-2 pb-5 space-y-3.5 max-h-[88vh] overflow-y-auto shadow-2xl transition-transform"
            style={{
              transform: `translateY(${dragOffsetY}px)`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div
              className="w-full py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(() => setEditingNotice(null))}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700 active:bg-zinc-500 transition-colors" />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Editar Aviso</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingNotice(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                  Tipo de Aviso
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditCategory('cambio_aula')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1.5 transition-all ${
                      editCategory === 'cambio_aula'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <School className="w-4 h-4" />
                    <span>Salón</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditCategory('aviso_general')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1.5 transition-all ${
                      editCategory === 'aviso_general'
                        ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>General</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditCategory('evento_escolar')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1.5 transition-all ${
                      editCategory === 'evento_escolar'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Evento</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Mensaje
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              {/* Opciones: Urgente y Fijar */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-zinc-200">Urgente</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsUrgent}
                    onChange={(e) => setEditIsUrgent(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs text-zinc-200">Fijar arriba</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsPinned}
                    onChange={(e) => setEditIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteNotice(editingNotice.id)
                    setEditingNotice(null)
                  }}
                  className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900/60 transition-colors"
                  title="Eliminar aviso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="submit"
                  disabled={editLoading || !editContent.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {editLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                  ) : (
                    <span>Guardar Cambios</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
