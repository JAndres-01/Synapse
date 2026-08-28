'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Subject, Schedule, TaskType } from '@/types/database'
import { DAYS_OF_WEEK, SCHEDULE_BLOCKS } from '@/lib/utils'
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
  Clock,
  Sparkles,
  CalendarCheck,
  Check,
} from 'lucide-react'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  subjects: Subject[]
  schedules?: Schedule[]
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

const MAX_TITLE_LENGTH = 100
const MAX_DESC_LENGTH = 300

// Calcular la fecha exacta de la próxima ocurrencia de un día de la semana (1=Lun ... 5=Vie)
function getNextOccurrenceOfWeekday(targetDay: number, classTimeStr?: string): { dateStr: string; label: string } {
  const now = new Date()
  const currentDayOfWeek = now.getDay() || 7 // 1=Lun ... 7=Dom

  let daysToAdd = targetDay - currentDayOfWeek
  if (daysToAdd < 0) {
    daysToAdd += 7
  } else if (daysToAdd === 0) {
    // Si es hoy, verificar si la hora de la clase ya pasó
    if (classTimeStr) {
      const [h, m] = classTimeStr.split(':').map(Number)
      const classMinutes = h * 60 + m
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      if (currentMinutes >= classMinutes) {
        daysToAdd = 7 // Ya pasó la clase de hoy, programar para la próxima semana
      }
    }
  }

  const target = new Date(now)
  target.setDate(now.getDate() + daysToAdd)

  const dateStr = target.toISOString().split('T')[0]
  const label = target.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return { dateStr, label }
}

export function CreateTaskModal({
  isOpen,
  onClose,
  subjects,
  schedules = [],
  defaultMode,
  isAdmin,
  onSaveTask,
}: CreateTaskModalProps) {
  const [mode, setMode] = useState<'classroom' | 'private'>(defaultMode)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [type, setType] = useState<TaskType>('individual')

  // Modo de selección de fecha: 'preset' (Horario Semanal) vs 'manual' (Fecha y Hora manual)
  const [scheduleMode, setScheduleMode] = useState<'preset' | 'manual'>('preset')
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState<{
    day: number
    block: number
    subjectName: string
    time: string
    dateLabel: string
  } | null>(null)

  const getTomorrowDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const [dueDate, setDueDate] = useState(getTomorrowDate())
  const [dueTime, setDueTime] = useState('23:59')
  const [loading, setLoading] = useState(false)

  // Gestos táctiles EXCLUSIVOS para el encabezado superior
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  useEffect(() => {
    if (!isAdmin) {
      setMode('private')
    } else {
      setMode(defaultMode)
    }

    if (subjects.length > 0 && !subjectId) {
      setSubjectId(subjects[0].id)
    }
  }, [defaultMode, subjects, isOpen, isAdmin, subjectId])

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
    if (dragOffsetY > 65) {
      onClose()
    } else {
      setDragOffsetY(0)
    }
  }

  // Preset: Seleccionar una clase del horario semanal
  const handleSelectSchedulePreset = (schedule: Schedule, blockDef: { block: number; startTime: string }) => {
    const { dateStr, label } = getNextOccurrenceOfWeekday(schedule.day_of_week, blockDef.startTime)
    const timeFormatted = schedule.start_time ? schedule.start_time.slice(0, 5) : blockDef.startTime

    setDueDate(dateStr)
    setDueTime(timeFormatted)
    if (schedule.subject_id) {
      setSubjectId(schedule.subject_id)
    }

    const dayObj = DAYS_OF_WEEK.find((d) => d.day === schedule.day_of_week)
    setSelectedScheduleSlot({
      day: schedule.day_of_week,
      block: blockDef.block,
      subjectName: schedule.subject?.name || 'Materia',
      time: timeFormatted,
      dateLabel: `${dayObj?.name || ''}, ${label}`,
    })
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
      setSelectedScheduleSlot(null)
      onClose()
    } catch (err) {
      console.error('Error guardando tarea:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0 overflow-hidden touch-none pt-[calc(env(safe-area-inset-top,44px)+20px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl px-5 pt-3 pb-6 space-y-3.5 max-h-[calc(100dvh-env(safe-area-inset-top,44px)-24px)] overflow-hidden flex flex-col shadow-2xl transition-transform"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* ÁREA DE ARRASTRE SUPERIOR EXCLUSIVA (TOTALMENTE DESPEJADA DE NOTCH)       */}
        {/* ========================================================================= */}
        <div
          className="w-full pt-1 pb-1 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag Handle */}
          <div className="w-12 h-1.5 rounded-full bg-zinc-700 active:bg-zinc-500 mx-auto transition-colors mb-2.5" />

          {/* Header del Modal */}
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
        </div>

        {/* ========================================================================= */}
        {/* CUERPO DEL FORMULARIO                                                     */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3.5 pr-0.5 overscroll-contain">
          {/* Indicador / Selector de Ámbito */}
          {isAdmin ? (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800 w-full">
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
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 w-full">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-950/50 border border-amber-800/50 text-amber-400">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Mis Pendientes
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    Privado • Solo tú podrás ver y gestionar esta tarea
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-800/40">
                Personal
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 w-full">
            {/* Título de la tarea con contador */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-zinc-400">
                  Título de la Tarea / Entrega *
                </label>
                <span className="text-[10px] font-mono text-zinc-500">
                  {title.length}/{MAX_TITLE_LENGTH}
                </span>
              </div>
              <input
                type="text"
                value={title}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Resumen Capítulo 4, Proyecto Final..."
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 box-border"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 appearance-none [color-scheme:dark] box-border"
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
              <div className="grid grid-cols-4 gap-1.5 w-full">
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

            {/* ========================================================================= */}
            {/* PRESET DE ASIGNACIÓN POR HORARIO SEMANAL vs FECHA MANUAL                   */}
            {/* ========================================================================= */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Programación de Entrega</span>
                </label>

                {/* Alternador Preset Horario vs Manual */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setScheduleMode('preset')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      scheduleMode === 'preset'
                        ? 'bg-zinc-800 text-indigo-300 font-semibold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Por Horario
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleMode('manual')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      scheduleMode === 'manual'
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {scheduleMode === 'preset' ? (
                /* PRESET 1: MATRIZ SEMANAL DE CLASES (5 DÍAS) */
                <div className="space-y-2.5 p-3 rounded-2xl bg-zinc-950 border border-zinc-800/90">
                  <span className="text-[10px] text-zinc-400 block">
                    Toca la clase en la que se entregará esta tarea:
                  </span>

                  {schedules.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2 text-center">
                      Aún no hay clases configuradas en el horario semanal.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 no-scrollbar">
                      {DAYS_OF_WEEK.map((d) => {
                        const daySchedules = schedules.filter((s) => s.day_of_week === d.day)
                        if (daySchedules.length === 0) return null

                        return (
                          <div key={d.day} className="space-y-1">
                            <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 px-1">
                              {d.name}
                            </span>

                            <div className="grid grid-cols-2 gap-1.5">
                              {daySchedules.map((sched) => {
                                const blockDef = SCHEDULE_BLOCKS.find((b) => b.block === sched.block_number) || {
                                  block: sched.block_number,
                                  startTime: sched.start_time?.slice(0, 5) || '07:00',
                                }
                                const isSelected =
                                  selectedScheduleSlot?.day === sched.day_of_week &&
                                  selectedScheduleSlot?.block === sched.block_number

                                return (
                                  <button
                                    key={sched.id}
                                    type="button"
                                    onClick={() => handleSelectSchedulePreset(sched, blockDef)}
                                    className={`p-2 rounded-xl border text-left transition-all relative ${
                                      isSelected
                                        ? 'bg-indigo-950/80 border-indigo-500 shadow-sm'
                                        : 'bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                                      <span className="font-mono">Clase {sched.block_number}</span>
                                      <span className="font-mono">{blockDef.startTime}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0 border border-zinc-700"
                                        style={{ backgroundColor: sched.subject?.color || '#FFFFFF' }}
                                      />
                                      <span className="text-xs font-semibold text-zinc-100 truncate">
                                        {sched.subject?.name || 'Materia'}
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Resumen del Preset Seleccionado */}
                  {selectedScheduleSlot && (
                    <div className="mt-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between text-xs animate-fade-in">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <div>
                          <span className="text-[11px] text-indigo-200 block font-semibold">
                            {selectedScheduleSlot.subjectName}
                          </span>
                          <span className="text-[10px] text-indigo-400 font-mono">
                            {selectedScheduleSlot.dateLabel} • {selectedScheduleSlot.time}
                          </span>
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                  )}
                </div>
              ) : (
                /* PRESET 2: FECHA Y HORA MANUAL */
                <div className="space-y-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800/90">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Fecha Límite de Entrega</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 [color-scheme:dark] block box-border"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Hora Límite</span>
                    </label>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 [color-scheme:dark] block box-border"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Descripción / Notas adicionales con Límite de Caracteres */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-zinc-400">
                  Notas / Instrucciones adicionales
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    description.length >= MAX_DESC_LENGTH
                      ? 'text-red-400 font-bold'
                      : 'text-zinc-500'
                  }`}
                >
                  {description.length}/{MAX_DESC_LENGTH}
                </span>
              </div>
              <textarea
                value={description}
                maxLength={MAX_DESC_LENGTH}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles, enlaces de entrega o notas de estudio..."
                rows={3}
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none box-border"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
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
    </div>
  )
}
