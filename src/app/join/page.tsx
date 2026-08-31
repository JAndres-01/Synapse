'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { Users, KeyRound, Plus, ArrowRight, Loader2, Sparkles } from 'lucide-react'

export default function JoinClassroomPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { user, classroom, refreshClassroom, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // Si ya pertenece a un salón, redirigir directo al dashboard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth')
    } else if (!authLoading && classroom) {
      router.replace('/app/today')
    }
  }, [authLoading, user, classroom, router])

  // Unirse a un salón existente mediante PIN
  const handleJoinByPin = async (e: React.FormEvent) => {
    e.preventDefault()
    const raw = inviteCode.trim().toUpperCase()
    if (!raw || !user) return

    try {
      setLoading(true)
      setErrorMsg(null)

      // Extraer números (ej: de "syn481" o "481" o "SYN-481" extrae "481")
      const digitsMatch = raw.match(/\d+/)
      const digits = digitsMatch ? digitsMatch[0] : ''
      const withHyphen = digits ? `SYN-${digits}` : raw
      const withoutHyphen = digits ? `SYN${digits}` : raw

      // 1. Buscar el salón por código PIN en Supabase
      const { data: rooms, error: roomErr } = await supabase
        .from('classrooms')
        .select('*')
        .or(`invite_code.ilike.${raw},invite_code.ilike.${withHyphen},invite_code.ilike.${withoutHyphen},invite_code.ilike.%${digits}%`)

      const room = rooms && rooms.length > 0 ? rooms[0] : null

      if (roomErr || !room) {
        throw new Error(`Salón con PIN "${raw}" no encontrado. Verifica si el código es ${withHyphen}.`)
      }

      // 2. Unir al usuario como miembro en classroom_members
      const { error: joinErr } = await supabase
        .from('classroom_members')
        .upsert(
          {
            classroom_id: room.id,
            user_id: user.id,
          },
          { onConflict: 'classroom_id,user_id' }
        )

      if (joinErr) throw joinErr

      await refreshClassroom()
      router.push('/app/today')
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || 'Error al unirse al salón')
    } finally {
      setLoading(false)
    }
  }

  // Crear un nuevo salón (Rol Delegado)
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoomName.trim() || !user) return

    try {
      setLoading(true)
      setErrorMsg(null)

      // Generar PIN aleatorio de 6 caracteres tipo "SYN-402"
      const generatedPin = `SYN-${Math.floor(100 + Math.random() * 900)}`

      // 1. Crear el salón en Supabase
      const { data: newRoom, error: createErr } = await supabase
        .from('classrooms')
        .insert({
          name: newRoomName.trim(),
          invite_code: generatedPin,
          created_by: user.id,
        })
        .select()
        .single()

      if (createErr || !newRoom) throw createErr

      // 2. Actualizar rol de perfil a 'admin'
      await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id)

      // 3. Añadir a miembros
      await supabase.from('classroom_members').insert({
        classroom_id: newRoom.id,
        user_id: user.id,
      })

      await refreshClassroom()
      router.push('/app/today')
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || 'Error al crear el salón')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-6 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Paso 2 de 2</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          {isCreating ? 'Crear Salón de Clases' : 'Ingresar al Salón'}
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {isCreating
            ? 'Crea el espacio oficial de tu cohorte para configurar materias y horarios.'
            : 'Pídele el código PIN de 6 dígitos a tu delegado para sincronizar tus materias.'}
        </p>
      </div>

      {/* Formulario */}
      <div className="my-auto py-6 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        {!isCreating ? (
          /* Formulario: Unirse con PIN */
          <form onSubmit={handleJoinByPin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-2">
                Código PIN del Salón
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="SYN-402"
                  maxLength={10}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-base tracking-widest font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors uppercase"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !inviteCode.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
              ) : (
                <>
                  <span>Unirme al Salón</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Formulario: Crear Salón */
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-2">
                Nombre del Salón / Grupo
              </label>
              <div className="relative">
                <Users className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ej. Ing. de Software - 6to Ciclo"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newRoomName.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
              ) : (
                <>
                  <span>Crear y Comenzar</span>
                  <Plus className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Alternar Crear / Unirse */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            setIsCreating(!isCreating)
            setErrorMsg(null)
          }}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {isCreating
            ? '¿Ya tienes un PIN de salón? Unirme a salón existente'
            : '¿Eres delegado o quieres crear un salón nuevo? Crea tu salón aquí'}
        </button>
      </div>
    </div>
  )
}
