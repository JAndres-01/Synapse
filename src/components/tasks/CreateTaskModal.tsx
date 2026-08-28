'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Subject, TaskType } from '@/types/database'
import {
  X,
  Plus,
  Loader2,
  Users,
  User,
  Rocket,
  FileText,
  Calendar,
  Lock,
  School,
} from 'lucide-react'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  subjects: Subject[]
  defaultMode: 'classroom' | 'private'
  isAdmin: boolean
  onSaveTask: (taskData: {
    title: string
    description?: string
    subject_id?: string | null
    type: TaskType
    due_date: string
    is_private: boolean
  }) => Promise<void>
}

export function CreateTaskModal({
  isOpen,
  onClose,
  subjects,
  defaultMode,
  isAdmin,
  onSaveTask,
}: CreateTaskModalProps) {
  const [mode, setMode] = useState<'classroom' | 'private'>(defaultMode)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [type, setType] = useState<TaskType>('individual')

  // Fecha y hora por defecto: Mañana a las 23:59
  const getTomorrowDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const [dueDate, setDueDate] = useState(getTomorrowDate())
  const [dueTime, setDueTime] = useState('23:59')
  const [loading, setLoading] = useState(false)

  // Gestos táctiles
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  useEffect(() => {
    setMode(defaultMode)
    if (subjects.length > 0 && !subjectId) {
      setSubjectId(subjects[0].id)
    }
  }, [defaultMode, subjects, isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('body-scroll-lock')
    } else {
      document.body.classList.remove('body-scroll-lock')
      setDragOffsetY(0)
    }
    return () => {
      document.body.classList.remove('body-scroll-lock')
    }
  }, [isOpen])

  if (!isOpen) return null

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    try {
      setLoading(true)
      const combinedDateTime = `${dueDate}T${dueTime}:00`

      await onSaveTask({
        title: title.trim(),
        description: description.trim() || undefined,
        subject_id: subjectId || null,
        type,
        due_date: combinedDateTime,
        is_private: mode === 'private',
      })

      setTitle('')
      setDescription('')
      onClose()
    } catch (err) {
      console.error('Error guardando tarea:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pt-2 pb-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl transition-transform"
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
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-zinc-700 active:bg-zinc-500 transition-colors" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Nueva Tarea</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {mode === 'private'
                ? 'Pendiente personal (solo visible para ti)'
                : 'Tarea oficial del salón (visible para toda la clase)'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Ámbito (Si es Delegado puede alternar Salón vs Personal) */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            <button
              type="button"
              onClick={() => setMode('classroom')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'classroom'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <School className="w-3.5 h-3.5 text-indigo-400" />
              <span>Del Salón</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('private')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'private'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Mi Pendiente</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Título de la tarea */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Título de la Tarea / Entrega *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Resumen Capítulo 4, Proyecto Final..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Materia Asociada */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Materia Asociada
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 appearance-none"
            >
              <option value="">(Sin materia / General)</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} {sub.code ? `(${sub.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Tarea */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Tipo de Entrega
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setType('individual')}
                className={`py-2 px-1 rounded-xl border text-[10px] font-medium flex flex-col items-center gap-1 transition-all ${
                  type === 'individual'
                    ? 'bg-zinc-800 border-zinc-600 text-white'
                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-500'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Individual</span>
              </button>

              <button
                type="button"
                onClick={() => setType('grupal')}
                className={`py-2 px-1 rounded-xl border text-[10px] font-medium flex flex-col items-center gap-1 transition-all ${
                  type === 'grupal'
                    ? 'bg-sky-950/60 border-sky-600 text-sky-300'
                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-500'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Grupal</span>
              </button>

              <button
                type="button"
                onClick={() => setType('proyecto')}
                className={`py-2 px-1 rounded-xl border text-[10px] font-medium flex flex-col items-center gap-1 transition-all ${
                  type === 'proyecto'
                    ? 'bg-purple-950/60 border-purple-600 text-purple-300'
                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-500'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Proyecto</span>
              </button>

              <button
                type="button"
                onClick={() => setType('examen')}
                className={`py-2 px-1 rounded-xl border text-[10px] font-medium flex flex-col items-center gap-1 transition-all ${
                  type === 'examen'
                    ? 'bg-rose-950/60 border-rose-600 text-rose-300'
                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-500'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Examen</span>
              </button>
            </div>
          </div>

          {/* Fecha y Hora de Entrega */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-500" />
                <span>Fecha Límite</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Hora Límite
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Descripción / Instrucciones adicionales */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Instrucciones / Notas adicionales
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles, enlaces de entrega o pautas de evaluación..."
              rows={3}
              className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
            ) : (
              <span>
                {mode === 'private' ? 'Guardar Mi Pendiente' : 'Publicar Tarea del Salón'}
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
