'use client'

import React, { useState } from 'react'
import type { Notice, NoticeCategory } from '@/types/database'
import {
  Megaphone,
  DoorOpen,
  GraduationCap,
  MessageSquare,
  Send,
  Plus,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface DelegateNoticesFeedProps {
  notices: Notice[]
  currentUserId: string
  onAddNotice: (content: string, category: NoticeCategory, isUrgent: boolean) => Promise<void>
  onAddComment: (noticeId: string, content: string) => Promise<void>
}

export function DelegateNoticesFeed({
  notices,
  currentUserId,
  onAddNotice,
  onAddComment,
}: DelegateNoticesFeedProps) {
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Estados del modal de creación
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<NoticeCategory>('aviso_general')
  const [newIsUrgent, setNewIsUrgent] = useState(false)
  const [loading, setLoading] = useState(false)

  const getCategoryBadge = (category: NoticeCategory) => {
    switch (category) {
      case 'cambio_aula':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded-md">
            <DoorOpen className="w-3 h-3" />
            <span>Cambio de Aula</span>
          </span>
        )
      case 'evento_escolar':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-950/50 border border-purple-800/50 px-2 py-0.5 rounded-md">
            <GraduationCap className="w-3 h-3" />
            <span>Evento Escolar</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-md">
            <Megaphone className="w-3 h-3 text-zinc-400" />
            <span>Aviso General</span>
          </span>
        )
    }
  }

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return

    try {
      setLoading(true)
      await onAddNotice(newContent.trim(), newCategory, newIsUrgent)
      setNewContent('')
      setNewCategory('aviso_general')
      setNewIsUrgent(false)
      setShowCreateModal(false)
    } catch (err) {
      console.error('Error publicando aviso:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendComment = async (noticeId: string) => {
    if (!commentText.trim()) return
    try {
      await onAddComment(noticeId, commentText.trim())
      setCommentText('')
    } catch (err) {
      console.error('Error comentando en aviso:', err)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <Megaphone className="w-3.5 h-3.5 text-zinc-400" />
          <span>Avisos del Salón</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
            {notices.length}
          </span>
        </h3>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Publicar</span>
        </button>
      </div>

      {notices.length === 0 ? (
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center text-xs text-zinc-500">
          No hay avisos recientes en el salón.
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => {
            const isExpanded = expandedNoticeId === notice.id
            const commentsCount = notice.comments?.length || 0

            return (
              <div
                key={notice.id}
                className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5 transition-all shadow-sm"
              >
                {/* Header del Aviso */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(notice.category)}
                    {notice.is_urgent && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-800/50 px-1.5 py-0.5 rounded">
                        URGENTE
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(notice.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>

                {/* Contenido */}
                <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {notice.content}
                </p>

                {/* Footer y botón para expandir comentarios */}
                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Por {notice.author?.full_name || 'Compañero'}</span>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedNoticeId(isExpanded ? null : notice.id)
                    }
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

                {/* Hilo de Respuestas Expandible */}
                {isExpanded && (
                  <div className="pt-2.5 space-y-2.5 border-t border-zinc-800 animate-fade-in">
                    {notice.comments && notice.comments.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {notice.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-xs"
                          >
                            <span className="font-semibold text-zinc-300 block text-[10px]">
                              {comment.author?.full_name || 'Compañero'}
                            </span>
                            <p className="text-zinc-300 text-[11px] mt-0.5">
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input de respuesta */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Escribe una respuesta..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendComment(notice.id)
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendComment(notice.id)}
                        disabled={!commentText.trim()}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Bottom Sheet: Publicar Aviso */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto safe-area-bottom">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Publicar Aviso en el Salón</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                  Categoría del Aviso
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory('cambio_aula')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 transition-all ${
                      newCategory === 'cambio_aula'
                        ? 'bg-amber-950/40 border-amber-600 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <DoorOpen className="w-4 h-4" />
                    <span>Cambio Aula</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCategory('aviso_general')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 transition-all ${
                      newCategory === 'aviso_general'
                        ? 'bg-indigo-950/40 border-indigo-600 text-indigo-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>General</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCategory('evento_escolar')}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 transition-all ${
                      newCategory === 'evento_escolar'
                        ? 'bg-purple-950/40 border-purple-600 text-purple-300'
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
                  Mensaje del Aviso
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Ej. El profesor avisó que la clase de hoy se traslada al Aula 304..."
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <div>
                    <h4 className="text-xs font-medium text-zinc-200">Marcar como urgente</h4>
                    <p className="text-[10px] text-zinc-500">Destaca el aviso en la parte superior</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={newIsUrgent}
                  onChange={(e) => setNewIsUrgent(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !newContent.trim()}
                className="w-full py-3 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                ) : (
                  <span>Publicar en el Salón</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
