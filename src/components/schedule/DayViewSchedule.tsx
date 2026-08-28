'use client'

import React from 'react'
import type { Schedule, Subject } from '@/types/database'
import { DAYS_OF_WEEK, SCHEDULE_BLOCKS } from '@/lib/utils'
import { MapPin, User, Video, Plus, Edit2 } from 'lucide-react'

interface DayViewScheduleProps {
  selectedDay: number
  onSelectDay: (day: number) => void
  schedules: Schedule[]
  isAdmin: boolean
  onOpenAssignModal: (day: number, blockNumber: number, existingSchedule?: Schedule) => void
}

export function DayViewSchedule({
  selectedDay,
  onSelectDay,
  schedules,
  isAdmin,
  onOpenAssignModal,
}: DayViewScheduleProps) {
  // Filtrar los horarios del día seleccionado
  const schedulesForDay = schedules.filter((s) => s.day_of_week === selectedDay)

  // Mapear los 4 bloques
  const blocks = SCHEDULE_BLOCKS.map((def) => {
    const scheduledClass = schedulesForDay.find((s) => s.block_number === def.block)
    return {
      ...def,
      scheduledClass,
    }
  })

  return (
    <div className="space-y-4">
      {/* Selector de Días: Lunes a Viernes */}
      <div className="flex items-center justify-between gap-1 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-sm">
        {DAYS_OF_WEEK.map((d) => {
          const isSelected = selectedDay === d.day
          const classesCount = schedules.filter((s) => s.day_of_week === d.day).length

          return (
            <button
              key={d.day}
              type="button"
              onClick={() => onSelectDay(d.day)}
              className={`flex-1 py-2 px-1 rounded-xl text-center transition-all duration-200 active:scale-95 ${
                isSelected
                  ? 'bg-zinc-800 text-white font-semibold shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs block">{d.short}</span>
              <span className="text-[9px] text-zinc-500 font-mono block mt-0.5">
                {classesCount > 0 ? `${classesCount} cl.` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista de los 4 Bloques del Día */}
      <div className="space-y-2.5">
        {blocks.map((b) => {
          const item = b.scheduledClass

          return (
            <div
              key={b.block}
              className={`p-3.5 rounded-2xl border transition-all ${
                item
                  ? 'bg-zinc-900/80 border-zinc-800 shadow-sm'
                  : 'bg-zinc-950/30 border-zinc-900 border-dashed'
              }`}
            >
              {/* Encabezado del Bloque */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-mono text-zinc-300 font-semibold">
                    Bloque {b.block}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {b.startTime} - {b.endTime}
                  </span>
                </div>

                {item?.is_virtual && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-full">
                    <Video className="w-3 h-3" />
                    <span>Virtual / Libre</span>
                  </span>
                )}
              </div>

              {/* Información de la Clase */}
              {item ? (
                <div className="mt-2.5 pl-1 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.subject?.color || '#6366F1' }}
                      />
                      <h3 className="text-sm font-semibold text-zinc-100 truncate">
                        {item.subject?.name}
                      </h3>
                      {item.subject?.code && (
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          ({item.subject.code})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{item.classroom_room || 'Aula Principal'}</span>
                      </div>
                      {item.subject?.teacher_name && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="truncate">{item.subject.teacher_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón editar para Delegado */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onOpenAssignModal(selectedDay, b.block, item)}
                      aria-label="Editar bloque"
                      className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 pl-1 flex items-center justify-between">
                  <span className="text-xs text-zinc-600 italic">
                    Sin materia asignada
                  </span>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onOpenAssignModal(selectedDay, b.block)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Asignar</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
