'use client'

import React from 'react'
import type { Schedule } from '@/types/database'
import { SCHEDULE_BLOCKS } from '@/lib/utils'
import { MapPin, User, Video, Calendar } from 'lucide-react'

interface DayScheduleTimelineProps {
  schedulesToday?: Schedule[]
}

export function DayScheduleTimeline({ schedulesToday = [] }: DayScheduleTimelineProps) {
  const classes = SCHEDULE_BLOCKS.map((def) => {
    const scheduledClass = (schedulesToday || []).find((s) => s.block_number === def.block)
    return {
      ...def,
      scheduledClass,
    }
  })

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <span>Cronograma de Hoy</span>
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">
          7:00 AM - 1:00 PM
        </span>
      </div>

      {/* Lista abierta con divisores minimalistas */}
      <div className="divide-y divide-zinc-900 border-y border-zinc-900/80">
        {classes.map((c) => {
          const item = c.scheduledClass

          return (
            <div
              key={c.block}
              className="py-3 flex items-center justify-between gap-3 transition-colors"
            >
              {/* Columna Izquierda: Hora y # de Clase */}
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
                      <h4 className="text-sm font-semibold text-zinc-100 truncate">
                        {item.subject?.name}
                      </h4>
                      {item.subject?.code && (
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {item.subject.code}
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
                  <span className="text-xs text-zinc-600 italic">
                    Sin clase asignada
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
