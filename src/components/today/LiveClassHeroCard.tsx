'use client'

import React, { useEffect, useState } from 'react'
import type { Schedule } from '@/types/database'
import { getCurrentClassState, type CurrentClassState } from '@/lib/schedule-utils'
import {
  MapPin,
  User,
  Video,
  Sparkles,
  Moon,
  Coffee,
} from 'lucide-react'

interface LiveClassHeroCardProps {
  schedulesToday?: Schedule[]
}

export function LiveClassHeroCard({
  schedulesToday = [],
}: LiveClassHeroCardProps) {
  const [classState, setClassState] = useState<CurrentClassState>({
    status: 'no_classes',
  })

  useEffect(() => {
    const update = () => {
      setClassState(getCurrentClassState(schedulesToday))
    }
    update()
    const timer = setInterval(update, 30000)
    return () => clearInterval(timer)
  }, [schedulesToday])

  const { status, currentSchedule, nextSchedule, minutesRemaining, minutesUntilNext, progressPercent } =
    classState

  const formatTimeRange = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return ''
    return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`
  }

  return (
    <div className="py-2">
      {/* ESTADO 1: EN CURSO (Diseño Tipográfico Abierto y Fluido) */}
      {status === 'active' && currentSchedule && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-emerald-400">
                En Curso • Clase {currentSchedule.block_number}
              </span>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Quedan {minutesRemaining} min
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-zinc-700"
                style={{ backgroundColor: currentSchedule.subject?.color || '#FFFFFF' }}
              />
              <span className="truncate">{currentSchedule.subject?.name || 'Materia'}</span>
            </h2>
            {currentSchedule.subject?.code && (
              <span className="text-xs font-mono text-zinc-500 block mt-0.5">
                {currentSchedule.subject.code}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-0.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              <span>{currentSchedule.classroom_room || 'Aula Principal'}</span>
            </div>
            {currentSchedule.subject?.teacher_name && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span className="truncate">{currentSchedule.subject.teacher_name}</span>
              </div>
            )}
          </div>

          {/* Línea minimalista de progreso */}
          <div className="w-full h-1 rounded-full bg-zinc-900 overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ESTADO 2: RECESO / PRÓXIMA CLASE */}
      {status === 'upcoming' && nextSchedule && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Coffee className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider">
                Próxima • Clase {nextSchedule.block_number}
              </span>
            </div>
            <span className="text-xs font-mono text-indigo-400 font-medium">
              Inicia en {minutesUntilNext} min
            </span>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-700"
              style={{ backgroundColor: nextSchedule.subject?.color || '#FFFFFF' }}
            />
            <span className="truncate">{nextSchedule.subject?.name || 'Materia'}</span>
          </h2>

          <p className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
            <span>{formatTimeRange(nextSchedule.start_time, nextSchedule.end_time)}</span>
            <span>•</span>
            <span>{nextSchedule.classroom_room || 'Aula Principal'}</span>
          </p>
        </div>
      )}

      {/* ESTADO 3: CLASE VIRTUAL / HORA LIBRE */}
      {status === 'virtual_free' && currentSchedule && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <Video className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">
                Modalidad Virtual / Libre
              </span>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {formatTimeRange(currentSchedule.start_time, currentSchedule.end_time)}
            </span>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight truncate">
            {currentSchedule.subject?.name || 'Materia'}
          </h2>
          <p className="text-xs text-zinc-400">
            Materia asíncrona • Tiempo de estudio o conexión libre
          </p>
        </div>
      )}

      {/* ESTADO 4: JORNADA TERMINADA / FIN DE SEMANA */}
      {(status === 'day_ended' || status === 'no_classes') && (
        <div className="flex items-center gap-3.5 py-1">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 shrink-0">
            {status === 'day_ended' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              {status === 'day_ended'
                ? 'Jornada escolar concluida ✨'
                : 'Sin clases programadas hoy'}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {status === 'day_ended'
                ? 'Las 4 clases de hoy han finalizado. ¡Buen descanso!'
                : 'Aprovecha para revisar tus tareas o preparar la semana.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
