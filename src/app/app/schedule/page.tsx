'use client'

import React from 'react'
import { Calendar } from 'lucide-react'

export default function SchedulePage() {
  return (
    <div className="flex-1 flex flex-col p-5 safe-area-top">
      <header className="pt-3 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" />
          <span>Horario de Clases</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          4 bloques diarios de 90 minutos (7:00 AM a 1:00 PM)
        </p>
      </header>
    </div>
  )
}
