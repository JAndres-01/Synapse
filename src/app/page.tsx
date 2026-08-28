'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { ArrowRight, BookOpen, Clock, ShieldCheck, Sparkles, Loader2 } from 'lucide-react'

export default function HomePage() {
  const { user, classroom, loading } = useAuth()
  const router = useRouter()

  // Auto-redirección si el usuario ya tiene sesión activa
  useEffect(() => {
    if (!loading) {
      if (user && classroom) {
        router.replace('/app/today')
      } else if (user && !classroom) {
        router.replace('/join')
      }
    }
  }, [user, classroom, loading, router])

  if (loading || user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh] bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-6 safe-area-top safe-area-bottom">
      {/* Top Header */}
      <div className="pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Hub oficial del salón de clases</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
          Synapse
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Tu horario de 4 clases, tareas y fotos de pizarra organizadas en un solo lugar. Adiós al desorden de WhatsApp.
        </p>
      </div>

      {/* Feature Pills */}
      <div className="space-y-3 my-8">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Horario de 4 clases</h3>
            <p className="text-[11px] text-zinc-400">7:00 AM a 1:00 PM con clase en vivo</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Tareas & Fotos de Pizarra</h3>
            <p className="text-[11px] text-zinc-400">Pizarras en alta resolución sin compresión de chat</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Acceso Seguro por PIN</h3>
            <p className="text-[11px] text-zinc-400">Exclusivo para los alumnos y delegados de tu salón</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pb-4">
        <Link
          href="/auth"
          className="w-full py-3.5 px-4 rounded-xl bg-white text-zinc-950 font-medium text-sm flex items-center justify-center gap-2 hover:bg-zinc-100 active:scale-[0.98] transition-all shadow-sm"
        >
          <span>Ingresar a mi salón</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-center text-[11px] text-zinc-400">
          Acceso protegido mediante PIN de 6 dígitos
        </p>
      </div>
    </div>
  )
}
