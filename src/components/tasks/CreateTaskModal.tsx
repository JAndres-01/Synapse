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
  ChevronDown,
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

function getNextClassOccurrence(targetDay: number, timeStr?: string): { dateStr: string; label: string } {
  const now = new Date()
  const currentDayOfWeek = now.getDay() || 7

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
  const label = `${dayNames[target.getDay()]} ${target.getDate()} ${monthNames[target.getMonth()]}`

  return { dateStr: `${y}-${m}-${d}`, label }
}

const getTodayDate = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getTomorrowDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

  const [datePreset, setDatePreset] = useState<'tomorrow' | 'today' | 'class' | 'custom'>('tomorrow')
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  const [dueDate, setDueDate] = useState(getTomorrowDate())
  const [dueTime, setDueTime] = useState('23:59')
  const [loading, setLoading] = useState(false)

  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)
  const prevIsOpenRef = useRef(false)
  const prevTaskIdRef = useRef<string | null | undefined>(undefined)

  const availableClassSlots = React.useMemo(() => {
    const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    return schedules
      .filter((s) => !!s && !!s.subject)
      .map((s) => {
        const time = s.start_time ? s.start_time.slice(0, 5) : '08:00'
        const { dateStr, label } = getNextClassOccurrence(s.day_of_week, time)
        return {
          id: s.id,
          subjectId: s.subject_id,
          subjectName: s.subject?.name || 'Materia',
          dayName: dayNames[s.day_of_week] || '',
          time,
          dateStr,
          dateLabel: label,
        }
      })
  }, [schedules])

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
        setDatePreset('custom')
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
        setDatePreset('tomorrow')
        setDueDate(getTomorrowDate())
        setDueTime('23:59')
        if (subjects.length > 0) {
          setSubjectId(subjects[0].id)
        }
      }
    }
  }, [isOpen, initialTask, defaultMode, isAdmin, subjects])

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

  const handleSelectPreset = (preset: 'tomorrow' | 'today' | 'class' | 'custom') => {
    setDatePreset(preset)
    if (preset === 'today') {
      setDueDate(getTodayDate())
      setDueTime('23:59')
    } else if (preset === 'tomorrow') {
      setDueDate(getTomorrowDate())
      setDueTime('23:59')
    } else if (preset === 'class') {
      if (availableClassSlots.length > 0) {
        const firstSlot = availableClassSlots[0]
        setSelectedScheduleId(firstSlot.id)
        setDueDate(firstSlot.dateStr)
        setDueTime(firstSlot.time)
        if (firstSlot.subjectId) setSubjectId(firstSlot.subjectId)
      }
    }
  }

  const handleSelectClassSlot = (slotId: string) => {
    setSelectedScheduleId(slotId)
    const slot = availableClassSlots.find((s) => s.id === slotId)
    if (slot) {
      setDueDate(slot.dateStr)
      setDueTime(slot.time)
      if (slot.subjectId) setSubjectId(slot.subjectId)
    }
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
        <div
          className="w-full pt-1 pb-0.5 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-9 h-1 rounded-full bg-zinc-800 mx-auto" />
        </div>

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
                : 'Nuevo Pendiente Personal'}
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

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-3 pr-0.5 no-scrollbar min-h-0 overscroll-contain"
        >
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
                  : '¿Qué necesitas recordar o hacer?...'
              }
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-medium text-zinc-300">Fecha de Entrega</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSelectPreset('tomorrow')}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition-all ${
                  datePreset === 'tomorrow'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 border-zinc-800/60'
                }`}
              >
                Mañana
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('today')}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition-all ${
                  datePreset === 'today'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 border-zinc-800/60'
                }`}
              >
                Hoy
              </button>

              {availableClassSlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectPreset('class')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition-all ${
                    datePreset === 'class'
                      ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 border-zinc-800/60'
                  }`}
                >
                  Próx. Clase
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition-all ${
                  datePreset === 'custom'
                    ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 border-zinc-800/60'
                }`}
              >
                Otra fecha...
              </button>
            </div>

            {datePreset === 'class' && availableClassSlots.length > 0 && (
              <div className="relative w-full pt-1">
                <select
                  value={selectedScheduleId}
                  onChange={(e) => handleSelectClassSlot(e.target.value)}
                  className="w-full appearance-none text-xs py-2 pl-3 pr-8 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-zinc-600 font-medium"
                >
                  {availableClassSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.dayName} • {slot.subjectName} ({slot.time}) — {slot.dateLabel}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            )}

            {datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 [color-scheme:dark]"
                />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 [color-scheme:dark]"
                />
              </div>
            )}
          </div>

          {subjects.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-medium text-zinc-300">Materia</span>
              </div>
              <div className="relative w-full">
                <select
                  id="task-subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full appearance-none text-xs py-2 pl-3 pr-8 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-zinc-600 font-medium transition-colors"
                >
                  <option value="">(Sin materia / General)</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-300 block">Tipo</span>
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
                    className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${
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

          <div className="space-y-1">
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESC_LENGTH}
              rows={2}
              placeholder="Instrucciones o notas adicionales (opcional)..."
              className="w-full px-3 py-2 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <Paperclip className="w-3 h-3" />
                <span>Adjuntos ({attachments.length}/{MAX_ATTACHMENTS})</span>
              </div>

              {attachments.length < MAX_ATTACHMENTS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-zinc-300 hover:text-white font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
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
