'use client'

import React from 'react'
import type { Schedule, Subject } from '@/types/database'
import { DAYS_OF_WEEK, SCHEDULE_BLOCKS } from '@/lib/utils'
import { MapPin, Video, Edit2, Plus } from 'lucide-react'

interface WeeklyMatrixScheduleProps {
  schedules: Schedule[]
  subjects?: Subject[]
  isAdmin?: boolean
  onOpenAssignModal?: (day: number, blockNumber: number, existingSchedule?: Schedule) => void
}

export function WeeklyMatrixSchedule({
  schedules,
  isAdmin = false,
  onOpenAssignModal,
}: WeeklyMatrixScheduleProps) {
  const currentDayOfWeek = new Date().getDay() || 7 // 1=Lun ... 7=Dom

  return (
    <div className="space-y-6 pt-2">
      {DAYS_OF_WEEK.map((d) => {
        const isToday = d.day === currentDayOfWeek
        const schedulesForDay = schedules.filter((s) => s.day_of_week === d.day)

        return (
          <div key={d.day} className="space-y-2">
            {/* Header de Día Plano y Tipográfico */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
              <div className="flex items-center gap-2">
                <h3
                  className={`text-sm font-bold tracking-tight ${
                    isToday ? 'text-indigo-400' : 'text-white'
                  }`}
                >
                  {d.name}
                </h3>
                {isToday && (
                  <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.2 rounded-full">
                    HOY
                  </span>
                )}
              </div>

              <span className="text-[11px] text-zinc-500 font-mono">
                {schedulesForDay.length} de 4 clases
              </span>
            </div>

            {/* Lista de las 4 Clases del Día */}
            <div className="divide-y divide-zinc-900/60">
              {SCHEDULE_BLOCKS.map((blockDef) => {
                const item = schedulesForDay.find((s) => s.block_number === blockDef.block)

                return (
                  <div
                    key={blockDef.block}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    {/* Hora y # Clase */}
                    <div className="w-16 shrink-0 text-left">
                      <span className="text-xs font-mono font-medium text-zinc-300 block">
                        {blockDef.startTime}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 block">
                        Clase {blockDef.block}
                      </span>
                    </div>

                    {/* Info de la Materia */}
                    <div className="flex-1 min-w-0">
                      {item ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0 border border-zinc-700"
                            style={{ backgroundColor: item.subject?.color || '#FFFFFF' }}
                          />
                          <span className="text-xs font-semibold text-zinc-200 truncate">
                            {item.subject?.name}
                          </span>

                          {item.is_virtual ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-400 font-medium shrink-0">
                              <Video className="w-2.5 h-2.5" />
                              <span>Virtual</span>
                            </span>
                          ) : item.classroom_room ? (
                            <span className="text-[10px] text-zinc-500 shrink-0 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5 text-zinc-600" />
                              <span>{item.classroom_room}</span>
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600 italic">
                          Libre
                        </span>
                      )}
                    </div>

                    {/* Botón Acción para Delegado */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onOpenAssignModal?.(d.day, blockDef.block, item)}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {item ? (
                          <Edit2 className="w-3 h-3" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
