'use client'

import React from 'react'
import type { Schedule, Subject } from '@/types/database'
import { DAYS_OF_WEEK, SCHEDULE_BLOCKS } from '@/lib/utils'

interface WeeklyMatrixScheduleProps {
  schedules: Schedule[]
  subjects: Subject[]
}

export function WeeklyMatrixSchedule({
  schedules,
}: WeeklyMatrixScheduleProps) {
  return (
    <div className="space-y-3">
      {/* Contenedor con scroll horizontal suave */}
      <div className="overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
        <div className="min-w-[460px] rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden shadow-lg">
          {/* Header con los 5 días: Lunes a Viernes */}
          <div className="grid grid-cols-6 border-b border-zinc-800 bg-zinc-950/70 text-[11px] font-semibold text-zinc-400">
            <div className="p-2.5 text-center text-zinc-500 border-r border-zinc-800/80 font-mono">
              Hora
            </div>
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d.day}
                className="p-2.5 text-center border-r border-zinc-800/80 last:border-r-0 font-medium text-zinc-200"
              >
                {d.short}
              </div>
            ))}
          </div>

          {/* Filas: Los 4 bloques de 90 min */}
          {SCHEDULE_BLOCKS.map((blockDef) => (
            <div
              key={blockDef.block}
              className="grid grid-cols-6 border-b border-zinc-800/60 last:border-b-0 min-h-[76px]"
            >
              {/* Columna de hora */}
              <div className="p-2 flex flex-col justify-center items-center border-r border-zinc-800/80 bg-zinc-950/40 text-center">
                <span className="text-[10px] font-bold text-zinc-400 font-mono">
                  #{blockDef.block}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">
                  {blockDef.startTime}
                </span>
                <span className="text-[9px] text-zinc-600 font-mono">
                  {blockDef.endTime}
                </span>
              </div>

              {/* Celdas para cada uno de los 5 días */}
              {DAYS_OF_WEEK.map((dayDef) => {
                const item = schedules.find(
                  (s) => s.day_of_week === dayDef.day && s.block_number === blockDef.block
                )

                return (
                  <div
                    key={dayDef.day}
                    className="p-1.5 border-r border-zinc-800/60 last:border-r-0 flex flex-col justify-center"
                  >
                    {item ? (
                      <div
                        className="h-full p-1.5 rounded-xl flex flex-col justify-between transition-all"
                        style={{
                          backgroundColor: `${item.subject?.color || '#6366F1'}18`,
                          borderLeft: `3px solid ${item.subject?.color || '#6366F1'}`,
                        }}
                      >
                        <div>
                          <p className="text-[10px] font-bold text-zinc-100 line-clamp-1 leading-tight">
                            {item.subject?.name}
                          </p>
                          {item.subject?.code && (
                            <span className="text-[8px] font-mono text-zinc-400 block truncate">
                              {item.subject.code}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[8px] text-zinc-400">
                          {item.is_virtual ? (
                            <span className="text-indigo-400 font-medium truncate">
                              Virtual
                            </span>
                          ) : (
                            <span className="truncate">{item.classroom_room || 'Aula'}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full rounded-xl bg-zinc-950/20 border border-zinc-800/30 flex items-center justify-center text-[9px] text-zinc-700">
                        —
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-[10px] text-zinc-500">
        Matriz de lunes a viernes • 4 bloques continuos de 90 min
      </p>
    </div>
  )
}
