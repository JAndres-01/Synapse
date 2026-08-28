'use client'

import React from 'react'
import type { Schedule } from '@/types/database'
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
  const schedulesForDay = schedules.filter((s) => s.day_of_week === selectedDay)

  const classes = SCHEDULE_BLOCKS.map((def) => {
    const scheduledClass = schedulesForDay.find((s) => s.block_number === def.block)
    return {
      ...def,
      scheduledClass,
    }
  })

  return (
    <div className="space-y-4 pt-1">
      {/* Selector de Días Plano y Minimalista */}
      <div className="flex items-center justify-between gap-1 border-b border-zinc-900 pb-2">
        {DAYS_OF_WEEK.map((d) => {
          const isSelected = selectedDay === d.day
          const classesCount = schedules.filter((s) => s.day_of_week === d.day).length

          return (
            <button
              key={d.day}
              type="button"
              onClick={() => onSelectDay(d.day)}
              className={`flex-1 py-2 px-1 text-center transition-all duration-200 ${
                isSelected
                  ? 'text-white font-bold border-b-2 border-white -mb-2 pb-2'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="text-xs block">{d.short}</span>
              <span className="text-[9px] font-mono block mt-0.5 opacity-70">
                {classesCount > 0 ? `${classesCount} cl.` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista Abierta de las 4 Clases con Divisores Sutiles */}
      <div className="divide-y divide-zinc-900 border-b border-zinc-900">
        {classes.map((c) => {
          const item = c.scheduledClass

          return (
            <div
              key={c.block}
              className="py-3.5 flex items-center justify-between gap-3 transition-colors"
            >
              {/* Columna Izquierda: Hora y Clase */}
              <div className="w-20 shrink-0">
                <span className="text-xs font-mono font-semibold text-zinc-200 block">
                  {c.startTime}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 block">
                  Clase {c.block}
                </span>
              </div>

              {/* Columna Central: Materia, Aula y Docente */}
              <div className="flex-1 min-w-0">
                {item ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-700"
                        style={{ backgroundColor: item.subject?.color || '#FFFFFF' }}
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

                    <div className="flex items-center gap-3 text-xs text-zinc-400 pl-4.5">
                      {item.is_virtual ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-medium">
                          <Video className="w-3 h-3" />
                          <span>Virtual / Libre</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-zinc-500" />
                          <span>{item.classroom_room || 'Aula Principal'}</span>
                        </span>
                      )}

                      {item.subject?.teacher_name && (
                        <span className="text-zinc-500 truncate flex items-center gap-1">
                          <User className="w-3 h-3 text-zinc-600" />
                          <span>{item.subject.teacher_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600 italic">
                      Sin clase asignada
                    </span>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onOpenAssignModal(selectedDay, c.block)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Asignar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Botón Editar para Delegado */}
              {item && isAdmin && (
                <button
                  type="button"
                  onClick={() => onOpenAssignModal(selectedDay, c.block, item)}
                  aria-label="Editar clase"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
