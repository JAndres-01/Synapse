'use client'

import React from 'react'
import type { Schedule } from '@/types/database'
import { SCHEDULE_BLOCKS } from '@/lib/utils'
import { MapPin, User, Video } from 'lucide-react'

interface DayScheduleTimelineProps {
  schedulesToday?: Schedule[]
}

export function DayScheduleTimeline({ schedulesToday = [] }: DayScheduleTimelineProps) {
  // Mapear las 4 clases
  const classes = SCHEDULE_BLOCKS.map((def) => {
    const scheduledClass = (schedulesToday || []).find((s) => s.block_number === def.block)
    return {
      ...def,
      scheduledClass,
    }
  })

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-zinc-300">
          Cronograma de Hoy (4 Clases)
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">
          7:00 AM - 1:00 PM
        </span>
      </div>

      <div className="space-y-2">
        {classes.map((c) => {
          const item = c.scheduledClass

          return (
            <div
              key={c.block}
              className={`p-3 rounded-xl border transition-all ${
                item
                  ? 'bg-zinc-900/60 border-zinc-800'
                  : 'bg-zinc-950/40 border-zinc-900 border-dashed opacity-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-mono text-zinc-400 font-medium">
                    Clase {c.block}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {c.startTime} - {c.endTime}
                  </span>
                </div>

                {item?.is_virtual && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-full font-medium">
                    <Video className="w-2.5 h-2.5" />
                    <span>Virtual / Libre</span>
                  </span>
                )}
              </div>

              {item ? (
                <div className="mt-2 pl-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-700"
                      style={{ backgroundColor: item.subject?.color || '#FFFFFF' }}
                    />
                    <h4 className="text-xs font-semibold text-zinc-100 truncate">
                      {item.subject?.name || 'Materia'}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-zinc-600" />
                      <span>{item.classroom_room || 'Aula Principal'}</span>
                    </div>
                    {item.subject?.teacher_name && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-zinc-600" />
                        <span className="truncate">{item.subject.teacher_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-1 pl-1 text-[11px] text-zinc-600 italic">
                  Clase sin materia asignada
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
