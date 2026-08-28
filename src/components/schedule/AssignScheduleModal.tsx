'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Schedule, Subject } from '@/types/database'
import { DAYS_OF_WEEK, SCHEDULE_BLOCKS } from '@/lib/utils'
import { Calendar, X, Trash2, Loader2, Video, MapPin } from 'lucide-react'

interface AssignScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  dayOfWeek: number
  blockNumber: number
  existingSchedule?: Schedule
  subjects: Subject[]
  onSaveSchedule: (
    dayOfWeek: number,
    blockNumber: number,
    subjectId: string,
    classroomRoom: string,
    isVirtual: boolean
  ) => Promise<void>
  onDeleteSchedule: (scheduleId: string) => Promise<void>
}

export function AssignScheduleModal({
  isOpen,
  onClose,
  dayOfWeek,
  blockNumber,
  existingSchedule,
  subjects,
  onSaveSchedule,
  onDeleteSchedule,
}: AssignScheduleModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [classroomRoom, setClassroomRoom] = useState<string>('Aula Principal')
  const [isVirtual, setIsVirtual] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  // Gestos táctiles de swipe down
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('body-scroll-lock')
      if (existingSchedule) {
        setSelectedSubjectId(existingSchedule.subject_id)
        setClassroomRoom(existingSchedule.classroom_room || 'Aula Principal')
        setIsVirtual(existingSchedule.is_virtual || false)
      } else {
        setSelectedSubjectId(subjects[0]?.id || '')
        setClassroomRoom('Aula Principal')
        setIsVirtual(false)
      }
    } else {
      document.body.classList.remove('body-scroll-lock')
      setDragOffsetY(0)
    }
    return () => {
      document.body.classList.remove('body-scroll-lock')
    }
  }, [isOpen, existingSchedule, subjects])

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubjectId) return

    try {
      setLoading(true)
      await onSaveSchedule(
        dayOfWeek,
        blockNumber,
        selectedSubjectId,
        classroomRoom.trim(),
        isVirtual
      )
      onClose()
    } catch (err) {
      console.error('Error guardando clase:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!existingSchedule) return
    try {
      setLoading(true)
      await onDeleteSchedule(existingSchedule.id)
      onClose()
    } catch (err) {
      console.error('Error eliminando clase:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const dayName = DAYS_OF_WEEK.find((d) => d.day === dayOfWeek)?.name || 'Día'
  const blockDef = SCHEDULE_BLOCKS.find((b) => b.block === blockNumber)

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-end justify-center animate-fade-in p-0"
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

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Configurar Clase #{blockNumber}</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {dayName} • {blockDef?.startTime} - {blockDef?.endTime}
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

        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Materia Asignada
            </label>
            {subjects.length === 0 ? (
              <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 p-2.5 rounded-xl">
                Debes registrar al menos una materia antes de asignarla a una clase.
              </p>
            ) : (
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Aula / Salón
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                value={classroomRoom}
                onChange={(e) => setClassroomRoom(e.target.value)}
                placeholder="Ej. Aula 302 o Laboratorio 1"
                disabled={isVirtual}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Opción Virtual / Hora Libre */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-indigo-400" />
              <div>
                <h4 className="text-xs font-medium text-zinc-200">Modalidad Virtual / Libre</h4>
                <p className="text-[10px] text-zinc-500">Materia asíncrona o estudio libre</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isVirtual}
              onChange={(e) => setIsVirtual(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {existingSchedule && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900/60 transition-colors"
                title="Desasignar clase"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !selectedSubjectId}
              className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
              ) : (
                <span>Guardar Clase</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
