'use client'

import React from 'react'
import type { Schedule, Subject } from '@/types/database'
import { DAYS_OF_WEEK, SCHEDULE_BLOCKS } from '@/lib/utils'
import { Video, MapPin } from 'lucide-react'

interface WeeklyMatrixScheduleProps {
  schedules: Schedule[]
  subjects: Subject[]
}

export function WeeklyMatrixSchedule({
  schedules,
}: WeeklyMatrixScheduleProps) {
  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-zinc-300">
          Resumen Semanal Completo
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">
          Lunes a Viernes
        </span>
      </div>

      {/* Lista vertical de los 5 días con sus 4 clases completas */}
      <div className="space-y-3">
        {DAYS_OF_WEEK.map((dayDef) => {
          const daySchedules = schedules.filter((s) => s.day_of_week === dayDef.day)
          const isToday = new Date().getDay() === dayDef.day

          return (
            <div
              key={dayDef.day}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isToday
                  ? 'bg-zinc-900/90 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20'
                  : 'bg-zinc-900/70 border-zinc-800'
              }`}
            >
              {/* Header del Día */}
              <div className="px-4 py-2.5 bg-zinc-950/50 border-b border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    {dayDef.name}
                  </span>
                  {isToday && (
                    <span className="px-2 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 text-[9px] font-semibold">
                      Hoy
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-zinc-400">
                  {daySchedules.length} de 4 clases asignadas
                </span>
              </div>

              {/* 4 Clases del Día en Formato Grid 2x2 Adaptable */}
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SCHEDULE_BLOCKS.map((blockDef) => {
                  const item = daySchedules.find((s) => s.block_number === blockDef.block)

                  return (
                    <div
                      key={blockDef.block}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all min-h-[58px] ${
                        item
                          ? 'bg-zinc-950/80 border-zinc-800/80'
                          : 'bg-zinc-950/30 border-zinc-900 border-dashed'
                      }`}
                      style={
                        item?.subject?.color
                          ? {
                              borderLeft: `3px solid ${item.subject.color}`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-zinc-500 font-semibold">
                          Clase {blockDef.block} • {blockDef.startTime}
                        </span>

                        {item?.is_virtual && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-medium text-indigo-400">
                            <Video className="w-2.5 h-2.5" />
                            <span>Virtual</span>
                          </span>
                        )}
                      </div>

                      {item ? (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-200 truncate">
                            {item.subject?.name}
                          </p>

                          {!item.is_virtual && item.classroom_room && (
                            <span className="text-[10px] text-zinc-400 font-mono shrink-0 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-zinc-500" />
                              <span>{item.classroom_room}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-600 italic mt-1">
                          Sin asignar
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
