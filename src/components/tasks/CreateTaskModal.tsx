'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Subject, Schedule, TaskType, Task, AttachmentType } from '@/types/database'
import { DAYS_OF_WEEK, SCHEDULE_BLOCKS, compressImageFile } from '@/lib/utils'
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
  Pencil,
  Paperclip,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'

export interface AttachedFileItem {
  id?: string
  file_name: string
  file_url: string
  file_type: AttachmentType
}

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  subjects: Subject[]
  schedules?: Schedule[]
  defaultMode: 'classroom' | 'private'
  isAdmin: boolean
  initialTask?: Task | null
  onSaveTask: (taskData: {
    title: string
    description?: string
    subject_id?: string | null
    type: TaskType
    due_date: string
    is_private: boolean
    attachments?: AttachedFileItem[]
  }) => Promise<void>
  onUpdateTask?: (
    taskId: string,
    taskData: {
      title: string
      description?: string
      subject_id?: string | null
      type: TaskType
      due_date: string
      is_private: boolean
      attachments?: AttachedFileItem[]
    }
  ) => Promise<void>
}

const MAX_TITLE_LENGTH = 100
const MAX_DESC_LENGTH = 300
const MAX_ATTACHMENTS = 5
const MAX_FILE_SIZE_MB = 15
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// Calcular la fecha exacta de la próxima ocurrencia de un día de la semana (1=Lun ... 5=Vie) sin desfase UTC
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

  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`

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
  initialTask,
  onSaveTask,
  onUpdateTask,
}: CreateTaskModalProps) {
  const [mode, setMode] = useState<'classroom' | 'private'>(defaultMode)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [type, setType] = useState<TaskType>('individual')
  const [attachments, setAttachments] = useState<AttachedFileItem[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const [dueDate, setDueDate] = useState(getTomorrowDate())
  const [dueTime, setDueTime] = useState('23:59')
  const [loading, setLoading] = useState(false)

  // Gestos táctiles EXCLUSIVOS para el encabezado superior
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)

  // Inicializar o rellenar formulario para creación o edición
  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '')
      setDescription(initialTask.description || '')
      setSubjectId(initialTask.subject_id || (subjects[0]?.id ?? ''))
      setType(initialTask.type || 'individual')
      setMode(initialTask.is_private ? 'private' : 'classroom')
      setScheduleMode('manual')
      setSelectedScheduleSlot(null)
      setFileError(null)

      if (initialTask.attachments && initialTask.attachments.length > 0) {
        setAttachments(
          initialTask.attachments.map((a) => ({
            id: a.id,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
          }))
        )
      } else {
        setAttachments([])
      }

      if (initialTask.due_date) {
        try {
          const d = new Date(initialTask.due_date)
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          setDueDate(`${y}-${m}-${day}`)
          const h = String(d.getHours()).padStart(2, '0')
          const min = String(d.getMinutes()).padStart(2, '0')
          setDueTime(`${h}:${min}`)
        } catch {
          setDueDate(getTomorrowDate())
          setDueTime('23:59')
        }
      }
    } else {
      // Modo creación nuevo
      if (!isAdmin) {
        setMode('private')
      } else {
        setMode(defaultMode)
      }
      setTitle('')
      setDescription('')
      setType('individual')
      setAttachments([])
      setFileError(null)
      setScheduleMode('preset')
      setSelectedScheduleSlot(null)
      setDueDate(getTomorrowDate())
      setDueTime('23:59')
      if (subjects.length > 0 && !subjectId) {
        setSubjectId(subjects[0].id)
      }
    }
  }, [initialTask, defaultMode, subjects, isOpen, isAdmin])

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

  // Manejar adjuntar archivos con compresión automática
  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setFileError(null)

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setFileError(`Puedes adjuntar un máximo de ${MAX_ATTACHMENTS} archivos.`)
      return
    }

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError(`El archivo "${file.name}" supera el límite de ${MAX_FILE_SIZE_MB}MB.`)
        continue
      }

      try {
        const isImage = file.type.startsWith('image/')
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
        const fileType: AttachmentType = isImage ? 'image' : isPdf ? 'pdf' : 'link'

        // Compresión GPU instantánea (<60ms) para fotos de iPhone
        const { fileUrl, fileName } = await compressImageFile(file, 2048, 0.85)

        setAttachments((prev) => [
          ...prev,
          {
            file_name: fileName,
            file_url: fileUrl,
            file_type: fileType,
          },
        ])
      } catch (err) {
        console.error('Error procesando archivo:', err)
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove))
    setFileError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    try {
      setLoading(true)

      // Convertir fecha y hora local exactamente a ISO UTC para la base de datos
      const [year, month, day] = dueDate.split('-').map(Number)
      const [hour, minute] = dueTime.split(':').map(Number)
      const localDate = new Date(year, month - 1, day, hour, minute, 0)
      const combinedDateTime = localDate.toISOString()

      const taskPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        subject_id: subjectId || null,
        type,
        due_date: combinedDateTime,
        is_private: mode === 'private',
        attachments,
      }

      if (initialTask && onUpdateTask) {
        await onUpdateTask(initialTask.id, taskPayload)
      } else {
        await onSaveTask(taskPayload)
      }

      setTitle('')
      setDescription('')
      setAttachments([])
      onClose()
    } catch (err) {
      console.error('Error guardando tarea:', err)
    } finally {
      setLoading(false)
    }
  }

  // Agrupar horarios por día y bloque para el selector visual
  const scheduleMatrix = DAYS_OF_WEEK.map((d) => {
    const daySchedules = schedules.filter((s) => s.day_of_week === d.day)
    return {
      day: d.day,
      name: d.name,
      short: d.short,
      schedules: daySchedules,
    }
  })

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center animate-fade-in p-0 overflow-hidden touch-none pt-[calc(env(safe-area-inset-top,44px)+20px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl px-5 pt-3 pb-6 space-y-4 max-h-[calc(100dvh-env(safe-area-inset-top,44px)-24px)] flex flex-col shadow-2xl transition-transform overflow-hidden"
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

        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {initialTask ? (
              <div className="w-8 h-8 rounded-xl bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
                <Pencil className="w-4 h-4" />
              </div>
            ) : mode === 'classroom' ? (
              <div className="w-8 h-8 rounded-xl bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
                <School className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-800/80 flex items-center justify-center text-amber-400">
                <Lock className="w-4 h-4" />
              </div>
            )}

            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {initialTask
                  ? initialTask.is_private
                    ? 'Editar Pendiente'
                    : 'Editar Tarea Oficial'
                  : mode === 'classroom'
                  ? 'Nueva Tarea Oficial'
                  : 'Nuevo Pendiente Personal'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {initialTask
                  ? 'Modifica los datos, adjuntos y horario de entrega'
                  : mode === 'classroom'
                  ? 'Visible para todos los alumnos del salón'
                  : 'Solo visible para ti (notas y pendientes privados)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Ámbito (Solo para delegado en creación nueva) */}
        {!initialTask && isAdmin && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={() => setMode('classroom')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'classroom'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <School className="w-3.5 h-3.5 text-indigo-400" />
              <span>Del Salón (Oficial)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('private')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'private'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Mis Pendientes</span>
            </button>
          </div>
        )}

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar min-h-0 overscroll-contain"
        >
          {/* Título de la Tarea */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <label htmlFor="task-title" className="font-semibold text-zinc-200">
                Título de la entrega / tarea *
              </label>
              <span
                className={`text-[10px] font-mono ${
                  title.length > MAX_TITLE_LENGTH ? 'text-red-400' : 'text-zinc-500'
                }`}
              >
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="task-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              placeholder={
                mode === 'classroom'
                  ? 'Ej: Ensayo de Historia, Ejercicios Guía 3...'
                  : 'Ej: Repasar apuntes de Cálculo, Comprar cartulina...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {/* ========================================================================= */}
          {/* SELECCIÓN DE ENTREGA: PRESET HORARIO (1-TAP) VS MANUAL                     */}
          {/* ========================================================================= */}
          <div className="space-y-2 pt-1 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Programación de Entrega *</span>
              </label>

              {/* Selector de Modo */}
              <div className="flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setScheduleMode('preset')}
                  className={`px-2 py-1 rounded-md font-medium transition-all ${
                    scheduleMode === 'preset'
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Por Horario
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('manual')}
                  className={`px-2 py-1 rounded-md font-medium transition-all ${
                    scheduleMode === 'manual'
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {/* A. MODO PRESET: Matriz Semanal de Clases */}
            {scheduleMode === 'preset' && (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Toca la clase del horario semanal en la que se entregará esta tarea:
                </p>

                {schedules.length === 0 ? (
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-center text-xs text-zinc-500">
                    No hay clases registradas en el horario aún. Usa el modo <strong>Manual</strong>.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Lista de Días con sus Clases */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {scheduleMatrix.map((dayData) => {
                        const hasClasses = dayData.schedules.length > 0

                        return (
                          <div
                            key={dayData.day}
                            className={`p-1.5 rounded-xl border flex flex-col items-center gap-1.5 min-h-[140px] ${
                              hasClasses
                                ? 'bg-zinc-950/80 border-zinc-800/90'
                                : 'bg-zinc-950/30 border-zinc-900 opacity-40'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-zinc-300 uppercase">
                              {dayData.short}
                            </span>

                            {/* 4 Bloques diarios */}
                            <div className="w-full space-y-1 flex-1 flex flex-col justify-start">
                              {SCHEDULE_BLOCKS.map((blockDef) => {
                                const sched = dayData.schedules.find(
                                  (s) => s.block_number === blockDef.block
                                )
                                if (!sched) {
                                  return (
                                    <div
                                      key={blockDef.block}
                                      className="h-6 rounded-md bg-zinc-900/40 border border-dashed border-zinc-800/40"
                                    />
                                  )
                                }

                                const isSelected =
                                  selectedScheduleSlot?.day === dayData.day &&
                                  selectedScheduleSlot?.block === blockDef.block

                                return (
                                  <button
                                    key={blockDef.block}
                                    type="button"
                                    onClick={() => handleSelectSchedulePreset(sched, blockDef)}
                                    title={`${sched.subject?.name || 'Clase'} (${blockDef.startTime})`}
                                    className={`w-full h-7 px-1 rounded-md text-[9px] font-semibold flex items-center justify-center transition-all border text-left truncate ${
                                      isSelected
                                        ? 'bg-indigo-600 border-white text-white shadow-md scale-[1.02]'
                                        : 'hover:border-zinc-500 bg-zinc-900/90 text-zinc-200 border-zinc-800 active:scale-95'
                                    }`}
                                    style={{
                                      borderLeftColor: isSelected
                                        ? '#FFFFFF'
                                        : sched.subject?.color || '#6366F1',
                                      borderLeftWidth: '3px',
                                    }}
                                  >
                                    <span className="truncate">
                                      {sched.subject?.name?.slice(0, 5) || `B${blockDef.block}`}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Resumen del Preset Seleccionado */}
                    {selectedScheduleSlot && (
                      <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CalendarCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">
                              {selectedScheduleSlot.subjectName}
                            </p>
                            <p className="text-[10px] text-indigo-300 capitalize">
                              {selectedScheduleSlot.dateLabel} • {selectedScheduleSlot.time}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-indigo-900/80 text-indigo-200 px-2 py-0.5 rounded font-mono shrink-0">
                          Bloque {selectedScheduleSlot.block}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* B. MODO MANUAL: Selectores de Fecha y Hora Nativos */}
            {scheduleMode === 'manual' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label htmlFor="task-due-date" className="text-[11px] text-zinc-400 font-medium">
                    Fecha límite
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="task-due-time" className="text-[11px] text-zinc-400 font-medium">
                    Hora límite
                  </label>
                  <input
                    id="task-due-time"
                    type="time"
                    required
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Selector de Materia Asociada (Solo visible en modo Manual) */}
          {scheduleMode === 'manual' && (
            <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
              <label htmlFor="task-subject" className="text-xs font-semibold text-zinc-200 block">
                Materia Asociada
              </label>
              {subjects.length > 0 ? (
                <select
                  id="task-subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
                >
                  <option value="">(Ninguna / General)</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-zinc-500 italic">No hay materias registradas.</p>
              )}
            </div>
          )}

          {/* Tipo de Tarea (Solo para tareas grupales del salón) */}
          {mode === 'classroom' && (
            <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
              <label className="text-xs font-semibold text-zinc-200 block">
                Tipo de Evaluación / Tarea
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'individual', label: 'Individual', icon: User },
                  { id: 'grupal', label: 'Grupal', icon: Users },
                  { id: 'proyecto', label: 'Proyecto', icon: Rocket },
                  { id: 'examen', label: 'Examen', icon: FileText },
                ].map((item) => {
                  const Icon = item.icon
                  const isSelected = type === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id as TaskType)}
                      className={`p-2 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Descripción / Notas */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <label htmlFor="task-description" className="font-semibold text-zinc-200">
                Instrucciones / Notas adicionales (Opcional)
              </label>
              <span
                className={`text-[10px] font-mono ${
                  description.length > MAX_DESC_LENGTH ? 'text-red-400' : 'text-zinc-500'
                }`}
              >
                {description.length}/{MAX_DESC_LENGTH}
              </span>
            </div>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESC_LENGTH}
              rows={2}
              placeholder="Escribe detalles del formato de entrega, rúbrica o recordatorios..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none transition-colors"
            />
          </div>

          {/* ========================================================================= */}
          {/* SECCIÓN DE ARCHIVOS E IMÁGENES ADJUNTAS                                   */}
          {/* ========================================================================= */}
          <div className="space-y-2 pt-1 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                <span>Archivos y Fotos Adjuntas ({attachments.length}/{MAX_ATTACHMENTS})</span>
              </label>

              {attachments.length < MAX_ATTACHMENTS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>Adjuntar</span>
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFilePick}
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
            />

            {fileError && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-950/40 p-2 rounded-xl border border-amber-800/50">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {attachments.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 shrink-0 group"
                  >
                    {att.file_type === 'image' ? (
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="max-w-[120px] truncate text-[11px] font-medium">
                      {att.file_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      title="Eliminar archivo"
                      className="text-zinc-500 hover:text-red-400 transition-colors p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 italic">
                Puedes adjuntar guías PDF, rúbricas o fotos de pizarrones (hasta 5MB c/u).
              </p>
            )}
          </div>

          {/* Botón Guardar / Publicar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !title.trim() || title.length > MAX_TITLE_LENGTH}
              className="w-full py-3 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 active:scale-[0.98] font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
              ) : initialTask ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Guardar Cambios</span>
                </>
              ) : mode === 'classroom' ? (
                <>
                  <School className="w-4 h-4" />
                  <span>Publicar Tarea Oficial</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Guardar Pendiente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
