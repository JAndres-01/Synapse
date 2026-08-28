'use client'

import React from 'react'
import type { Schedule, Task } from '@/types/database'
import { SCHEDULE_BLOCKS } from '@/lib/utils'
import { MapPin, User, Video, CheckSquare, Check } from 'lucide-react'
import confetti from 'canvas-confetti'

interface DayScheduleTimelineProps {
  schedulesToday?: Schedule[]
  tasksToday?: Task[]
  onToggleTaskStatus?: (taskId: string, currentStatus: string) => Promise<void>
}

export function DayScheduleTimeline({
  schedulesToday = [],
  tasksToday = [],
  onToggleTaskStatus,
}: DayScheduleTimelineProps) {
  // Mapear las 4 clases
  const classes = SCHEDULE_BLOCKS.map((def) => {
    const scheduledClass = (schedulesToday || []).find((s) => s.block_number === def.block)
    const classTasks = scheduledClass?.subject_id
      ? tasksToday.filter((t) => t.subject_id === scheduledClass.subject_id)
      : []

    return {
      ...def,
      scheduledClass,
      classTasks,
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
          const tasks = c.classTasks

          return (
            <div
              key={c.block}
              className={`p-3.5 rounded-2xl border transition-all ${
                item
                  ? 'bg-zinc-900/70 border-zinc-800 shadow-sm'
                  : 'bg-zinc-950/40 border-zinc-900 border-dashed opacity-50'
              }`}
            >
              {/* Header de la Clase */}
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
                <div className="mt-2 pl-0.5 space-y-2">
                  <div>
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

                  {/* ========================================================================= */}
                  {/* TAREAS ASOCIADAS A ESTA MATERIA PARA EL DÍA DE HOY                        */}
                  {/* ========================================================================= */}
                  {tasks.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                      <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3 text-amber-400" />
                        <span>Entregas de hoy para esta materia ({tasks.length}):</span>
                      </span>

                      {tasks.map((task) => {
                        const isCompleted =
                          Array.isArray(task.user_status) &&
                          task.user_status.length > 0 &&
                          task.user_status[0]?.status === 'completed'

                        const handleCheck = (e: React.MouseEvent) => {
                          e.stopPropagation()
                          if (!isCompleted) {
                            try {
                              confetti({
                                particleCount: 25,
                                spread: 40,
                                origin: { y: 0.8 },
                                colors: ['#6366F1', '#10B981', '#ffffff'],
                              })
                            } catch {}
                          }
                          onToggleTaskStatus?.(task.id, isCompleted ? 'completed' : 'pending')
                        }

                        return (
                          <div
                            key={task.id}
                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                              isCompleted
                                ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                                : 'bg-zinc-950/90 border-zinc-800/90'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={handleCheck}
                                aria-label="Marcar tarea"
                                className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                  isCompleted
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                                }`}
                              >
                                {isCompleted && <Check className="w-3 h-3 stroke-[2.5]" />}
                              </button>

                              <span
                                className={`text-[11px] truncate leading-tight ${
                                  isCompleted
                                    ? 'line-through text-zinc-500'
                                    : 'text-zinc-200 font-medium'
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>

                            <span
                              className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 font-mono ${
                                isCompleted
                                  ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                                  : 'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                              }`}
                            >
                              {isCompleted ? 'Entregada' : 'Pendiente'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
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
