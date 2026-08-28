'use client'

import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Settings,
  User,
  Copy,
  Check,
  Bell,
  WifiOff,
  LogOut,
  Sparkles,
} from 'lucide-react'

export default function SettingsPage() {
  const { profile, classroom, signOut } = useAuth()
  const [copied, setCopied] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  const handleCopyPin = () => {
    if (!classroom?.invite_code) return
    navigator.clipboard.writeText(classroom.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTogglePush = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones push.')
      return
    }

    if (Notification.permission === 'granted') {
      setPushEnabled(!pushEnabled)
    } else {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setPushEnabled(true)
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col p-5 safe-area-top space-y-6">
      {/* Header */}
      <header className="pt-3">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>Salón & Ajustes</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configuración personal y acceso de tu cohorte
        </p>
      </header>

      {/* Perfil del Estudiante */}
      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 font-bold text-base">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.full_name || 'Avatar'}
              className="w-full h-full rounded-xl object-cover"
            />
          ) : (
            <User className="w-6 h-6 text-zinc-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              {profile?.full_name || 'Estudiante'}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 capitalize">
              {profile?.role === 'admin' ? 'Delegado' : 'Alumno'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 truncate font-mono mt-0.5">
            {profile?.email}
          </p>
        </div>
      </div>

      {/* Tarjeta del Salón y Código PIN */}
      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              Salón Activo
            </span>
            <h3 className="text-sm font-semibold text-zinc-200">
              {classroom?.name}
            </h3>
          </div>
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </div>

        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-500 block">PIN de Invitación</span>
            <span className="text-base font-mono font-bold tracking-widest text-zinc-100">
              {classroom?.invite_code}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyPin}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-xs text-zinc-200 flex items-center gap-1.5 transition-colors active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar PIN</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 leading-tight">
          Comparte este PIN con tus compañeros de clase para que se unan a este horario.
        </p>
      </div>

      {/* Preferencias */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Preferencias
        </h3>

        {/* Notificaciones */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-zinc-200">
                Notificaciones Push
              </h4>
              <p className="text-[11px] text-zinc-500">
                Alertas de cambios de aula y entregas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTogglePush}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              pushEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                pushEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Estado Offline */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-400">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-zinc-200">
                Caché Offline (IndexedDB)
              </h4>
              <p className="text-[11px] text-zinc-500">
                Horario disponible sin internet en el campus
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded-full">
            Activo
          </span>
        </div>
      </div>

      {/* Cerrar Sesión */}
      <div className="pt-4">
        <button
          type="button"
          onClick={signOut}
          className="w-full py-3 px-4 rounded-xl bg-zinc-900/80 border border-red-900/40 text-red-400 hover:bg-red-950/30 text-xs font-medium flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  )
}
