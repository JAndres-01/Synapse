'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { offlineDB } from '@/lib/db'
import type { Schedule, Subject } from '@/types/database'
import { DayViewSchedule } from '@/components/schedule/DayViewSchedule'
import { WeeklyMatrixSchedule } from '@/components/schedule/WeeklyMatrixSchedule'
import { ManageSubjectsModal } from '@/components/schedule/ManageSubjectsModal'
import { AssignScheduleModal } from '@/components/schedule/AssignScheduleModal'
import {
  Calendar as CalendarIcon,
  LayoutGrid,
  CalendarDays,
  BookOpen,
  Loader2,
} from 'lucide-react'

export default function SchedulePage() {
  const { user, classroom, profile } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'day' | 'week'>('day')

  // Día seleccionado por defecto: día de la semana actual (1..5) o Lunes (1) si es fin de semana
  const currentDay = new Date().getDay() // 0=Dom, 1=Lun ... 6=Sáb
  const initialDay = currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  const [selectedDay, setSelectedDay] = useState<number>(initialDay)

  // Modales de administración (Delegado)
  const [showSubjectsModal, setShowSubjectsModal] = useState(false)
  const [assignModalData, setAssignModalData] = useState<{
    isOpen: boolean
    day: number
    block: number
    existingSchedule?: Schedule
  }>({
    isOpen: false,
    day: 1,
    block: 1,
  })

  const supabase = createClient()
  const isAdmin = classroom?.created_by === user?.id || profile?.role === 'delegate' || profile?.role === 'admin'

  const loadData = useCallback(async () => {
    if (!classroom) return

    try {
      // 1. Intentar cargar desde caché local Dexie (Offline-First)
      if (offlineDB) {
        const [cachedSubjects, cachedSchedules] = await Promise.all([
          offlineDB.subjects.where('classroom_id').equals(classroom.id).toArray(),
          offlineDB.schedules.where('classroom_id').equals(classroom.id).toArray(),
        ])

        if (cachedSubjects.length > 0) setSubjects(cachedSubjects)
        if (cachedSchedules.length > 0) setSchedules(cachedSchedules)
      }

      // 2. Fetch fresco desde Supabase
      const [subjectsRes, schedulesRes] = await Promise.all([
        supabase
          .from('subjects')
          .select('*')
          .eq('classroom_id', classroom.id)
          .order('name', { ascending: true }),
        supabase
          .from('schedules')
          .select('*, subject:subjects(*)')
          .eq('classroom_id', classroom.id)
          .order('block_number', { ascending: true }),
      ])

      if (subjectsRes.data) {
        setSubjects(subjectsRes.data)
        if (offlineDB) {
          await offlineDB.subjects.bulkPut(subjectsRes.data)
        }
      }

      if (schedulesRes.data) {
        setSchedules(schedulesRes.data)
        if (offlineDB) {
          await offlineDB.schedules.bulkPut(schedulesRes.data)
        }
      }
    } catch (err) {
      console.error('Error cargando horarios:', err)
    } finally {
      setLoading(false)
    }
  }, [classroom, supabase])

  useEffect(() => {
    loadData()

    if (!classroom) return

    // Suscripción en tiempo real a cambios de horario y materias
    const channel = supabase
      .channel(`schedule-room-${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `classroom_id=eq.${classroom.id}` },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subjects', filter: `classroom_id=eq.${classroom.id}` },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroom, loadData, supabase])

  // Handlers para el delegado
  const handleSaveSubject = async (data: Partial<Subject>) => {
    if (!classroom) return
    const newSubject = {
      classroom_id: classroom.id,
      name: data.name!,
      code: data.code || null,
      teacher_name: data.teacher_name || null,
      color: data.color || '#6366F1',
    }

    const { data: saved, error } = await supabase
      .from('subjects')
      .insert(newSubject)
      .select()
      .single()

    if (!error && saved) {
      setSubjects((prev) => [...prev, saved])
      if (offlineDB) {
        await offlineDB.subjects.put(saved)
      }
    }
  }

  const handleDeleteSubject = async (subjectId: string) => {
    const { error } = await supabase.from('subjects').delete().eq('id', subjectId)
    if (!error) {
      setSubjects((prev) => prev.filter((s) => s.id !== subjectId))
      setSchedules((prev) => prev.filter((s) => s.subject_id !== subjectId))
      if (offlineDB) {
        await offlineDB.subjects.delete(subjectId)
      }
    }
  }

  const handleSaveSchedule = async (
    dayOfWeek: number,
    blockNumber: number,
    subjectId: string,
    classroomRoom: string,
    isVirtual: boolean
  ) => {
    if (!classroom) return

    // Buscar si ya existe un bloque en este día
    const existing = schedules.find(
      (s) => s.day_of_week === dayOfWeek && s.block_number === blockNumber
    )

    const payload = {
      classroom_id: classroom.id,
      day_of_week: dayOfWeek,
      block_number: blockNumber,
      subject_id: subjectId,
      classroom_room: classroomRoom || 'Aula Principal',
      is_virtual: isVirtual,
    }

    if (existing) {
      const { data: updated, error } = await supabase
        .from('schedules')
        .update(payload)
        .eq('id', existing.id)
        .select('*, subject:subjects(*)')
        .single()

      if (!error && updated) {
        setSchedules((prev) => prev.map((s) => (s.id === existing.id ? updated : s)))
        if (offlineDB) {
          await offlineDB.schedules.put(updated)
        }
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('schedules')
        .insert(payload)
        .select('*, subject:subjects(*)')
        .single()

      if (!error && inserted) {
        setSchedules((prev) => [...prev, inserted])
        if (offlineDB) {
          await offlineDB.schedules.put(inserted)
        }
      }
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    const { error } = await supabase.from('schedules').delete().eq('id', scheduleId)
    if (!error) {
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
      if (offlineDB) {
        await offlineDB.schedules.delete(scheduleId)
      }
    }
  }

  if (loading && subjects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header Principal con Selector de Vistas y Botón de Materias */}
      <header className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-400" />
            <span>Horario de Clases</span>
          </h1>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            4 bloques diarios de 90 min (7:00 AM - 1:00 PM)
          </p>
        </div>

        {/* Botón Administrar Materias (para delegados) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowSubjectsModal(true)}
            className="py-1.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>Materias</span>
          </button>
        )}
      </header>

      {/* Switch de Vista: Día a Día vs Grilla Semanal */}
      <div className="flex p-1 rounded-xl bg-zinc-900 border border-zinc-800/80">
        <button
          type="button"
          onClick={() => setActiveView('day')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            activeView === 'day'
              ? 'bg-zinc-800 text-white shadow-sm font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Día a Día</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('week')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            activeView === 'week'
              ? 'bg-zinc-800 text-white shadow-sm font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Matriz Semanal</span>
        </button>
      </div>

      {/* Contenido según la vista seleccionada */}
      {activeView === 'day' ? (
        <DayViewSchedule
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          schedules={schedules}
          isAdmin={isAdmin}
          onOpenAssignModal={(day, block, existing) =>
            setAssignModalData({
              isOpen: true,
              day,
              block,
              existingSchedule: existing,
            })
          }
        />
      ) : (
        <WeeklyMatrixSchedule schedules={schedules} subjects={subjects} />
      )}

      {/* Modales de Gestión (Delegado) */}
      <ManageSubjectsModal
        isOpen={showSubjectsModal}
        onClose={() => setShowSubjectsModal(false)}
        subjects={subjects}
        onSaveSubject={handleSaveSubject}
        onDeleteSubject={handleDeleteSubject}
      />

      <AssignScheduleModal
        isOpen={assignModalData.isOpen}
        onClose={() =>
          setAssignModalData((prev) => ({ ...prev, isOpen: false }))
        }
        dayOfWeek={assignModalData.day}
        blockNumber={assignModalData.block}
        existingSchedule={assignModalData.existingSchedule}
        subjects={subjects}
        onSaveSchedule={handleSaveSchedule}
        onDeleteSchedule={handleDeleteSchedule}
      />
    </div>
  )
}
