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
    <div className="flex flex-col space-y-6 pt-1">
      {/* Header */}
      <header className="border-b border-zinc-900 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>Ajustes & Salón</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Información de tu cohorte y cuenta
        </p>
      </header>

      {/* Perfil del Estudiante */}
      <div className="flex items-center gap-3.5 pb-2">
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-base overflow-hidden shrink-0">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.full_name || 'Avatar'}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-6 h-6 text-zinc-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-100 truncate">
              {profile?.full_name || 'Estudiante'}
            </h2>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 capitalize">
              {profile?.role === 'admin' ? 'Delegado' : 'Alumno'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 truncate font-mono mt-0.5">
            {profile?.email}
          </p>
        </div>
      </div>

      {/* Sección 1: SALÓN DE CLASES */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
          Salón de Clases
        </span>

        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          <div className="py-3 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Nombre del Salón</span>
            <span className="text-xs font-semibold text-zinc-200">{classroom?.name}</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400 block">PIN de Invitación</span>
              <span className="text-xs font-mono font-bold tracking-widest text-zinc-200">
                {classroom?.invite_code}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyPin}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5 transition-colors active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sección 2: PREFERENCIAS & SISTEMA */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
          Preferencias & Sistema
        </span>

        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-zinc-400" />
              <div>
                <span className="text-xs font-medium text-zinc-200 block">
                  Notificaciones Push
                </span>
                <span className="text-[11px] text-zinc-500">
                  Alertas de cambios de aula
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTogglePush}
              className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center px-0.5 ${
                pushEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
              }`}
            >
              <span
                className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                  pushEnabled ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-medium text-zinc-200 block">
                  Caché Offline (IndexedDB)
                </span>
                <span className="text-[11px] text-zinc-500">
                  Horario disponible sin internet
                </span>
              </div>
            </div>
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full">
              Activo
            </span>
          </div>
        </div>
      </div>

      {/* Cerrar Sesión */}
      <div className="pt-2">
        <button
          type="button"
          onClick={signOut}
          className="w-full py-3 px-4 rounded-xl text-red-400 hover:bg-red-950/20 text-xs font-medium flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  )
}
