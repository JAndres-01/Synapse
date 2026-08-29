'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Subject, Schedule, TaskType, Task, AttachmentType } from '@/types/database'
import { compressImageFile } from '@/lib/utils'
import {
  X,
  Plus,
  Loader2,
  Calendar,
  BookOpen,
  User,
  Users,
  Rocket,
  FileText,
  School,
  Lock,
  Paperclip,
  Image as ImageIcon,
  AlertCircle,
  Check,
  CalendarCheck,
  ChevronDown,
  Tag,
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

// Helper para calcular la próxima fecha exacta de una clase (1=Lun ... 5=Vie)
function getNextClassOccurrence(targetDay: number, timeStr?: string): { dateStr: string; label: string } {
  const now = new Date()
  const currentDayOfWeek = now.getDay() || 7 // 1=Lun ... 7=Dom

  let daysToAdd = targetDay - currentDayOfWeek
  if (daysToAdd < 0) {
    daysToAdd += 7
  } else if (daysToAdd === 0 && timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    const classMinutes = h * 60 + (m || 0)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    if (currentMinutes >= classMinutes) {
      daysToAdd = 7
    }
  }

  const target = new Date(now)
  target.setDate(now.getDate() + daysToAdd)

  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const label = `${dayNames[target.getDay()]} ${target.getDate()} de ${monthNames[target.getMonth()]}`

  return { dateStr: `${y}-${m}-${d}`, label }
}

const getTomorrowDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return 'Elegir fecha'
  try {
    const parts = dateStr.split('-').map(Number)
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return dateStr
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const mName = monthNames[parts[1] - 1] || ''
    return `${parts[2]} ${mName} ${parts[0]}`
  } catch {
    return dateStr
  }
}

function formatDisplayTime(timeStr: string) {
  if (!timeStr) return 'Elegir hora'
  try {
    const [hStr, mStr] = timeStr.split(':')
    const h = Number(hStr)
    const m = Number(mStr)
    if (isNaN(h)) return timeStr
    const period = h >= 12 ? 'p.m.' : 'a.m.'
    const displayH = h % 12 === 0 ? 12 : h % 12
    const displayM = String(isNaN(m) ? 0 : m).padStart(2, '0')
    return `${displayH}:${displayM} ${period}`
  } catch {
    return timeStr
  }
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

  // Modo de programación: 'schedule' (Mini calendario de clases) vs 'manual' (Fecha manual)
  const [scheduleMode, setScheduleMode] = useState<'schedule' | 'manual'>('schedule')
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
    id: string
    subjectName: string
    time: string
    dateLabel: string
  } | null>(null)

  const [dueDate, setDueDate] = useState(getTomorrowDate())
  const [dueTime, setDueTime] = useState('23:59')
  const [loading, setLoading] = useState(false)

  // Gestos táctiles
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)
  const prevIsOpenRef = useRef(false)
  const prevTaskIdRef = useRef<string | null | undefined>(undefined)

  // Matriz de clases por día para el mini calendario semanal
  const weeklyScheduleDays = React.useMemo(() => {
    const dayDefs = [
      { day: 1, name: 'Lunes', short: 'LUN' },
      { day: 2, name: 'Martes', short: 'MAR' },
      { day: 3, name: 'Miércoles', short: 'MIÉ' },
      { day: 4, name: 'Jueves', short: 'JUE' },
      { day: 5, name: 'Viernes', short: 'VIE' },
    ]

    return dayDefs.map((d) => {
      const dayClasses = schedules
        .filter((s) => s.day_of_week === d.day && s.subject)
        .sort((a, b) => (a.block_number || 0) - (b.block_number || 0))
      return {
        ...d,
        classes: dayClasses,
      }
    })
  }, [schedules])

  // Inicializar al abrir o cambiar de tarea
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false
      prevTaskIdRef.current = undefined
      return
    }

    const isOpening = !prevIsOpenRef.current
    const isTaskChanged = initialTask ? initialTask.id !== prevTaskIdRef.current : prevTaskIdRef.current !== null

    if (isOpening || isTaskChanged) {
      prevIsOpenRef.current = true
      prevTaskIdRef.current = initialTask?.id || null

      if (initialTask) {
        setTitle(initialTask.title || '')
        setDescription(initialTask.description || '')
        setSubjectId(initialTask.subject_id || (subjects[0]?.id ?? ''))
        setType(initialTask.type || 'individual')
        setMode(initialTask.is_private ? 'private' : 'classroom')
        setScheduleMode('manual')
        setSelectedSlotInfo(null)
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
        setScheduleMode(schedules.length > 0 ? 'schedule' : 'manual')
        setSelectedSlotInfo(null)
        setDueDate(getTomorrowDate())
        setDueTime('23:59')
        if (subjects.length > 0) {
          setSubjectId(subjects[0].id)
        }
      }
    }
  }, [isOpen, initialTask, defaultMode, isAdmin, subjects, schedules])

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

  // Seleccionar una clase del mini calendario semanal
  const handleSelectClassSlot = (sched: Schedule) => {
    const time = sched.start_time ? sched.start_time.slice(0, 5) : '08:00'
    const { dateStr, label } = getNextClassOccurrence(sched.day_of_week, time)

    setDueDate(dateStr)
    setDueTime(time)
    if (sched.subject_id) {
      setSubjectId(sched.subject_id)
    }

    setSelectedSlotInfo({
      id: sched.id,
      subjectName: sched.subject?.name || 'Materia',
      time,
      dateLabel: label,
    })
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setFileError(null)

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setFileError(`Puedes adjuntar hasta ${MAX_ATTACHMENTS} archivos.`)
      return
    }

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError(`"${file.name}" supera ${MAX_FILE_SIZE_MB}MB.`)
        continue
      }

      try {
        const isImage = file.type.startsWith('image/')
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
        const fileType: AttachmentType = isImage ? 'image' : isPdf ? 'pdf' : 'link'
        const { fileUrl, fileName } = await compressImageFile(file, 2048, 0.85)

        setAttachments((prev) => [
          ...prev,
          { file_name: fileName, file_url: fileUrl, file_type: fileType },
        ])
      } catch (err) {
        console.error('Error procesando archivo:', err)
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
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
      setFileError(null)

      let combinedDateTime = new Date().toISOString()
      if (dueDate) {
        try {
          const parts = dueDate.split('-').map(Number)
          const timeParts = (dueTime || '23:59').split(':').map(Number)
          if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            const h = timeParts.length >= 2 && !isNaN(timeParts[0]) ? timeParts[0] : 23
            const m = timeParts.length >= 2 && !isNaN(timeParts[1]) ? timeParts[1] : 59
            const localDate = new Date(parts[0], parts[1] - 1, parts[2], h, m, 0)
            combinedDateTime = localDate.toISOString()
          }
        } catch {
          combinedDateTime = new Date().toISOString()
        }
      }

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
    } catch (err: any) {
      console.error('Error guardando tarea:', err)
      setFileError(err?.message || 'Ocurrió un error al guardar la tarea.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-end justify-center animate-fade-in p-0 overflow-hidden touch-none pt-[calc(env(safe-area-inset-top,44px)+20px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border-t border-zinc-800/80 rounded-t-3xl px-5 pt-2.5 pb-6 space-y-3.5 max-h-[calc(100dvh-env(safe-area-inset-top,44px)-20px)] flex flex-col shadow-2xl transition-transform overflow-hidden"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle de arrastre */}
        <div
          className="w-full pt-1 pb-0.5 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-9 h-1 rounded-full bg-zinc-800 mx-auto" />
        </div>

        {/* Encabezado Simple y Limpio */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                mode === 'classroom' ? 'bg-indigo-400' : 'bg-amber-400'
              }`}
            />
            <h2 className="text-sm font-semibold text-white tracking-tight">
              {initialTask
                ? initialTask.is_private
                  ? 'Editar Pendiente'
                  : 'Editar Tarea'
                : mode === 'classroom'
                ? 'Nueva Tarea del Salón'
                : 'Nuevo pendiente'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-900/60 border border-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Selector de Ámbito (Salón vs Privado) */}
        {!initialTask && isAdmin && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shrink-0">
            <button
              type="button"
              onClick={() => setMode('classroom')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                mode === 'classroom'
                  ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent bg-transparent'
              }`}
            >
              <School className={`w-3 h-3 ${mode === 'classroom' ? 'text-indigo-400' : 'text-zinc-500'}`} />
              <span>Del Salón</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('private')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                mode === 'private'
                  ? 'bg-amber-500/15 text-amber-200 border-amber-500/30 shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent bg-transparent'
              }`}
            >
              <Lock className={`w-3 h-3 ${mode === 'private' ? 'text-amber-400' : 'text-zinc-500'}`} />
              <span>Mis Pendientes</span>
            </button>
          </div>
        )}

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 pr-0.5 no-scrollbar min-h-0 overscroll-contain"
        >
          {/* 1. Título del Pendiente / Tarea */}
          <div className="space-y-1">
            <input
              id="task-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              placeholder={
                mode === 'classroom'
                  ? 'Título de la tarea o entrega...'
                  : 'Actividad o pendiente personal por realizar...'
              }
              className="w-full px-3.5 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {/* 2. Programación de Entrega: Mini Calendario Semanal vs Fecha Manual */}
          <div className="space-y-2 pt-1 border-t border-zinc-900/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Programación de Entrega</span>
              </div>

              {/* Selector de Modo */}
              <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setScheduleMode('schedule')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    scheduleMode === 'schedule'
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Clase
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('manual')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    scheduleMode === 'manual'
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Fecha manual
                </button>
              </div>
            </div>

            {/* A. MINI CALENDARIO SEMANAL DE CLASES */}
            {scheduleMode === 'schedule' && (
              <div className="space-y-2">
                {schedules.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic text-center py-2 bg-zinc-900/30 rounded-xl border border-zinc-800/60">
                    No hay clases registradas. Usa la opción de <strong>Fecha manual</strong>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* 5 Columnas Semanales (Lun - Vie) */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {weeklyScheduleDays.map((d) => {
                        const todayDay = new Date().getDay() || 7 // 1=Lun ... 7=Dom
                        const isToday = d.day === todayDay

                        return (
                          <div
                            key={d.day}
                            className={`p-1 rounded-xl flex flex-col gap-1 border transition-all ${
                              isToday
                                ? 'bg-indigo-950/20 border-indigo-500/40'
                                : 'bg-zinc-900/30 border-zinc-800/50'
                            }`}
                          >
                            <span
                              className={`text-[9px] font-bold text-center tracking-wider ${
                                isToday ? 'text-indigo-400 font-extrabold' : 'text-zinc-400'
                              }`}
                            >
                              {d.short}
                            </span>

                            <div className="space-y-1">
                              {d.classes.length === 0 ? (
                                <div className="h-6 flex items-center justify-center text-[10px] text-zinc-700">
                                  -
                                </div>
                              ) : (
                                d.classes.map((sched) => {
                                  const isSelected = selectedSlotInfo?.id === sched.id
                                  return (
                                    <button
                                      key={sched.id}
                                      type="button"
                                      onClick={() => handleSelectClassSlot(sched)}
                                      title={`${sched.subject?.name} (${sched.start_time?.slice(0, 5)})`}
                                      className={`w-full py-1 px-1 rounded-md text-[9px] font-medium transition-all text-center truncate border ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-white font-semibold shadow-xs scale-[1.02]'
                                          : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-zinc-800 active:scale-95'
                                      }`}
                                      style={{
                                        borderLeftColor: isSelected
                                          ? '#ffffff'
                                          : sched.subject?.color || '#6366f1',
                                        borderLeftWidth: '2.5px',
                                      }}
                                    >
                                      <span className="truncate block font-semibold">
                                        {sched.subject?.name?.slice(0, 5) || 'Clase'}
                                      </span>
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Confirmación Visual de la Clase Seleccionada */}
                    {selectedSlotInfo && (
                      <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between text-xs animate-fade-in">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CalendarCheck className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="text-zinc-200 font-medium truncate">
                            {selectedSlotInfo.dateLabel} • {selectedSlotInfo.time}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-semibold truncate shrink-0 ml-1">
                          {selectedSlotInfo.subjectName}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* B. FECHA MANUAL (Centrado perfecto garantizado en iOS) */}
            {scheduleMode === 'manual' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-medium block text-center">Fecha límite</span>
                  <div className="relative flex items-center justify-center bg-zinc-900/60 border border-zinc-800 rounded-xl h-11 px-2.5 focus-within:border-zinc-500 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform">
                    <span className="text-xs font-semibold text-zinc-100 select-none text-center truncate">
                      {formatDisplayDate(dueDate)}
                    </span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-medium block text-center">Hora límite</span>
                  <div className="relative flex items-center justify-center bg-zinc-900/60 border border-zinc-800 rounded-xl h-11 px-2.5 focus-within:border-zinc-500 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform">
                    <span className="text-xs font-semibold text-zinc-100 select-none text-center truncate">
                      {formatDisplayTime(dueTime)}
                    </span>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Materia Asociada (Solo visible en modo Fecha Manual) */}
          {scheduleMode === 'manual' && subjects.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-zinc-900/80">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <BookOpen className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Materia</span>
              </div>
              <div className="relative w-full">
                <select
                  id="task-subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full appearance-none text-xs py-2.5 pl-3 pr-8 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-zinc-600 font-medium transition-colors"
                >
                  <option value="">(Sin materia / General)</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          {/* 4. Tipo de Evaluación */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-900/80">
            <div className="flex items-center gap-1.5 text-xs text-zinc-300">
              <Tag className="w-3.5 h-3.5 text-white" />
              <span className="font-medium">Tipo</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/60">
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
                    className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 5. Notas opcionales */}
          <div className="space-y-1 pt-1 border-t border-zinc-900/80">
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESC_LENGTH}
              rows={2}
              placeholder="Instrucciones o notas adicionales (opcional)..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none transition-colors"
            />
          </div>

          {/* 6. Adjuntos & Fotos */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-900/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <Paperclip className="w-3.5 h-3.5 text-white" />
                <span>Adjuntos ({attachments.length}/{MAX_ATTACHMENTS})</span>
              </div>

              {attachments.length < MAX_ATTACHMENTS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-zinc-300 hover:text-white font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  <span>Añadir</span>
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
              <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/30 p-2 rounded-xl border border-amber-800/40">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 shrink-0"
                  >
                    {att.file_type === 'image' ? (
                      <ImageIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                    ) : (
                      <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
                    )}
                    <span className="max-w-[100px] truncate">{att.file_name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-zinc-500 hover:text-red-400 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. Botón Guardar Principal */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !title.trim() || title.length > MAX_TITLE_LENGTH}
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
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
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Publicar Tarea</span>
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
