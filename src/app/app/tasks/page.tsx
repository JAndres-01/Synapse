'use client'

import React from 'react'
import { CheckSquare } from 'lucide-react'

export default function TasksPage() {
  return (
    <div className="flex-1 flex flex-col p-5 safe-area-top">
      <header className="pt-3 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-400" />
          <span>Tareas & Evaluaciones</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Seguimiento de entregas individuales, grupales, proyectos y exámenes
        </p>
      </header>
    </div>
  )
}
