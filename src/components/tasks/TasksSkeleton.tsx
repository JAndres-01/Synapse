import React from 'react'

export function TasksSkeleton() {
  return (
    <div className="flex flex-col space-y-3 pb-24 animate-pulse select-none">
      {/* 1. Header Principal Skeleton */}
      <header className="flex items-center justify-between pt-1">
        <div className="space-y-1.5">
          <div className="h-6 w-24 bg-zinc-800/70 rounded-lg" />
          <div className="h-3.5 w-44 bg-zinc-900/90 rounded-md" />
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-900/80 border border-zinc-800/80 shrink-0" />
      </header>

      {/* 2. Selector de Ámbito (Del Salón vs Mis Pendientes) Skeleton */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-950 border border-zinc-800/80">
        <div className="flex-1 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/50 flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-zinc-800" />
          <div className="h-3.5 w-16 bg-zinc-800 rounded-md" />
        </div>
        <div className="flex-1 h-9 rounded-xl bg-transparent flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-zinc-900" />
          <div className="h-3.5 w-20 bg-zinc-900 rounded-md" />
        </div>
      </div>

      {/* 3. Filtros: Estados y Materias Skeleton */}
      <div className="space-y-2 pt-0.5">
        {/* Píldoras de Estado */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
          <div className="h-7 w-20 bg-zinc-800/80 rounded-lg" />
          <div className="h-7 w-20 bg-zinc-900/60 rounded-lg" />
          <div className="h-7 w-16 bg-zinc-900/40 rounded-lg" />
        </div>

        {/* Dropdown Materias */}
        <div className="w-full h-9 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between px-3">
          <div className="h-3.5 w-32 bg-zinc-900 rounded-md" />
          <div className="w-3.5 h-3.5 rounded bg-zinc-800" />
        </div>
      </div>

      {/* 4. Lista de Tareas Skeleton (5 filas con estética 'Less Cards') */}
      <div className="pt-1 divide-y divide-zinc-900/80">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="py-3 px-1 flex items-start gap-3">
            {/* Checkmark placeholder */}
            <div className="w-5 h-5 rounded-full border border-zinc-800 bg-zinc-900/60 shrink-0 mt-0.5" />

            {/* Contenido de la tarea */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                {/* Título de tarea con ancho variable */}
                <div
                  className={`h-4 bg-zinc-800/80 rounded-md ${
                    item % 3 === 0 ? 'w-3/4' : item % 2 === 0 ? 'w-1/2' : 'w-3/5'
                  }`}
                />
                {/* Badge de tipo */}
                <div className="h-4 w-14 bg-zinc-800/50 rounded-md shrink-0" />
              </div>

              {/* Materia y fecha de entrega */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="h-3 w-20 bg-zinc-900 rounded-md" />
                <div className="w-1 h-1 rounded-full bg-zinc-800" />
                <div className="h-3 w-24 bg-zinc-900/80 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 5. Botón Flotante Skeleton */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] right-4 z-30 h-10 w-32 rounded-full bg-zinc-800/80 border border-zinc-700/60 shadow-xl" />
    </div>
  )
}
