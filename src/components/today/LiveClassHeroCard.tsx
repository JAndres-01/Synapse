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

  // Actualizar estado en tiempo real cada 30 segundos
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
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 shadow-xl transition-all">
      {/* ESTADO 1: EN CURSO */}
      {status === 'active' && currentSchedule && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[11px] font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>EN CURSO • CLASE {currentSchedule.block_number}</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Termina en {minutesRemaining} min
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-700"
                style={{ backgroundColor: currentSchedule.subject?.color || '#FFFFFF' }}
              />
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                {currentSchedule.subject?.name || 'Materia'}
              </h2>
            </div>
            {currentSchedule.subject?.code && (
              <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                {currentSchedule.subject.code}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-400">
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

          {/* Barra de progreso de la clase */}
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ESTADO 2: RECESO / PRÓXIMA CLASE */}
      {status === 'upcoming' && nextSchedule && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-medium text-zinc-300">
              <Coffee className="w-3.5 h-3.5 text-zinc-400" />
              <span>PRÓXIMA • CLASE {nextSchedule.block_number}</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Comienza en {minutesUntilNext} min
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-700"
                style={{ backgroundColor: nextSchedule.subject?.color || '#FFFFFF' }}
              />
              <h2 className="text-sm font-semibold text-zinc-100 truncate">
                {nextSchedule.subject?.name || 'Materia'}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
              <span>{formatTimeRange(nextSchedule.start_time, nextSchedule.end_time)}</span>
              <span>•</span>
              <span>{nextSchedule.classroom_room || 'Aula Principal'}</span>
            </p>
          </div>
        </div>
      )}

      {/* ESTADO 3: CLASE VIRTUAL / HORA LIBRE */}
      {status === 'virtual_free' && currentSchedule && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-[11px] font-semibold text-indigo-400">
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              <span>MODALIDAD VIRTUAL / HORA LIBRE</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              {formatTimeRange(currentSchedule.start_time, currentSchedule.end_time)}
            </span>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              {currentSchedule.subject?.name || 'Materia'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Materia virtual / asíncrona. Tiempo de estudio libre o conexión remota.
            </p>
          </div>
        </div>
      )}

      {/* ESTADO 4: JORNADA TERMINADA / FIN DE SEMANA */}
      {(status === 'day_ended' || status === 'no_classes') && (
        <div className="flex items-center gap-3.5 py-1">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            {status === 'day_ended' ? (
              <Moon className="w-5 h-5 text-indigo-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-zinc-400" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">
              {status === 'day_ended'
                ? 'Jornada escolar concluida ✨'
                : 'Sin clases programadas hoy'}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {status === 'day_ended'
                ? 'Las 4 clases de hoy han terminado. ¡Buen descanso!'
                : 'Aprovecha para revisar tus tareas o preparar la semana.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
