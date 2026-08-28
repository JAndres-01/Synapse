'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Subject } from '@/types/database'
import { SUBJECT_COLORS } from '@/lib/utils'
import { BookOpen, Plus, X, Trash2, Loader2, Check } from 'lucide-react'

interface ManageSubjectsModalProps {
  isOpen: boolean
  onClose: () => void
  subjects: Subject[]
  onSaveSubject: (subject: Partial<Subject>) => Promise<void>
  onDeleteSubject: (subjectId: string) => Promise<void>
}

export function ManageSubjectsModal({
  isOpen,
  onClose,
  subjects,
  onSaveSubject,
  onDeleteSubject,
}: ManageSubjectsModalProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [selectedColor, setSelectedColor] = useState<string>(SUBJECT_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Gestos táctiles de swipe down
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('body-scroll-lock')
    } else {
      document.body.classList.remove('body-scroll-lock')
      setDragOffsetY(0)
      setShowAddForm(false)
      setName('')
      setCode('')
      setTeacherName('')
    }
    return () => {
      document.body.classList.remove('body-scroll-lock')
    }
  }, [isOpen])

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setLoading(true)
      await onSaveSubject({
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : null,
        teacher_name: teacherName.trim() || null,
        color: selectedColor,
      })
      setName('')
      setCode('')
      setTeacherName('')
      setShowAddForm(false)
    } catch (err) {
      console.error('Error guardando materia:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pt-2 pb-6 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl transition-transform"
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

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Materias del Salón</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de Materias Creadas */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {subjects.length === 0 ? (
            <p className="text-center text-xs text-zinc-500 py-3">
              Aún no hay materias registradas.
            </p>
          ) : (
            subjects.map((sub) => (
              <div
                key={sub.id}
                className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: sub.color }}
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-100 truncate">
                      {sub.name}
                    </h4>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {sub.code ? `${sub.code} • ` : ''}
                      {sub.teacher_name || 'Sin profesor asignado'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteSubject(sub.id)}
                  aria-label="Eliminar materia"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Botón para desplegar formulario de nueva materia */}
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Nueva Materia</span>
          </button>
        ) : (
          /* Formulario de creación */
          <form onSubmit={handleCreate} className="space-y-3 pt-2 border-t border-zinc-800">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Nombre de la Materia *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Algoritmos y Estructuras"
                required
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Código (Opcional)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CC-401"
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Docente (Opcional)
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Prof. Juan Pérez"
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Paleta de Colores */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                Color Distintivo
              </label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90"
                    style={{ backgroundColor: c }}
                  >
                    {selectedColor === c && (
                      <Check className="w-4 h-4 text-white stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 text-xs font-semibold hover:bg-white disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                ) : (
                  <span>Guardar</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
