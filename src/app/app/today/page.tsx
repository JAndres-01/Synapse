'use client'

import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { Bell, Sparkles } from 'lucide-react'

export default function TodayPage() {
  const { profile, classroom } = useAuth()
  const todayDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="flex-1 flex flex-col p-5 safe-area-top">
      {/* Header */}
      <header className="flex items-center justify-between pt-3 pb-5">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 capitalize">
            {todayDate}
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Hola, {profile?.full_name?.split(' ')[0] || 'Compañero'}</span>
            <span className="text-base">👋</span>
          </h1>
          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
            {classroom?.name}
          </p>
        </div>

        <button
          type="button"
          aria-label="Avisos"
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <Bell className="w-4 h-4" />
        </button>
      </header>

      {/* Placeholder content before Phase 3 */}
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Salón conectado</h3>
            <p className="text-[11px] text-zinc-400">
              PIN del salón: <span className="font-mono text-zinc-200">{classroom?.invite_code}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
