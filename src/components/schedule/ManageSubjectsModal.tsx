'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Subject } from '@/types/database'
import { SUBJECT_COLORS } from '@/lib/utils'
import { BookOpen, Plus, X, Trash2, Loader2, Check } from 'lucide-react'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/modalManager'

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
      lockBodyScroll()
    } else {
      unlockBodyScroll()
      setDragOffsetY(0)
      setShowAddForm(false)
      setName('')
      setCode('')
      setTeacherName('')
    }
    return () => {
      if (isOpen) {
        unlockBodyScroll()
      }
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
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-end justify-center animate-backdrop-fade p-0 overflow-hidden touch-none overscroll-none pt-[calc(env(safe-area-inset-top,44px)+20px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border-t border-zinc-800/80 rounded-t-3xl px-5 pt-2 pb-6 space-y-3.5 max-h-[calc(100dvh-env(safe-area-inset-top,44px)-20px)] flex flex-col shadow-2xl transition-transform overflow-hidden overscroll-none select-none animate-sheet-up"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zona superior: Handle de arrastre y título (Única zona activa para swipe-to-dismiss) */}
        <div
          className="w-full shrink-0 touch-none select-none space-y-2 pt-1 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag Handle */}
          <div className="w-full py-1 flex items-center justify-center">
            <div className="w-10 h-1.5 rounded-full bg-zinc-700 mx-auto transition-colors" />
          </div>

          {/* Encabezado Simple y Limpio (Sin botón X) */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Materias del Salón
            </h3>
          </div>
        </div>

        {/* Lista de Materias Creadas (Diseño plano y limpio) */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5 no-scrollbar min-h-0">
          {subjects.length === 0 ? (
            <p className="text-center text-xs text-zinc-500 py-4 italic">
              Aún no hay materias registradas.
            </p>
          ) : (
            subjects.map((sub) => (
              <div
                key={sub.id}
                className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between gap-2 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-zinc-700 shadow-xs"
                    style={{ backgroundColor: sub.color }}
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-100 truncate">
                      {sub.name}
                    </h4>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {sub.code ? `${sub.code} • ` : ''}
                      {sub.teacher_name || 'Sin docente asignado'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteSubject(sub.id)}
                  aria-label="Eliminar materia"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors shrink-0"
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
            className="w-full h-11 px-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Añadir Nueva Materia</span>
          </button>
        ) : (
          /* Formulario de creación limpio */
          <form onSubmit={handleCreate} className="space-y-3 pt-3 border-t border-zinc-900/80">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-300">
                Nombre de la Materia *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Algoritmos y Estructuras"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">
                  Código
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CC-401"
                  className="w-full h-11 px-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 uppercase font-mono transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-300">
                  Docente
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Prof. Juan Pérez"
                  className="w-full h-11 px-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
            </div>

            {/* Paleta de Colores Básicos */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Color Distintivo
              </label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {SUBJECT_COLORS.map((c) => {
                  const isWhite = c.toLowerCase() === '#ffffff'
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
                        isWhite ? 'border-2 border-zinc-600' : 'border border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {selectedColor === c && (
                        <Check
                          className={`w-4 h-4 stroke-[3] ${
                            isWhite ? 'text-zinc-950' : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 h-11 rounded-xl bg-white text-zinc-950 text-xs font-bold hover:bg-zinc-100 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                ) : (
                  <span>Guardar Materia</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
