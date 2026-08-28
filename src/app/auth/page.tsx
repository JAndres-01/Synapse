'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // Iniciar sesión con Google
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setErrorMsg(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/join`,
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || 'Error al conectar con Google')
      setLoading(false)
    }
  }

  // Iniciar sesión / Registro con Email
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Por favor completa todos los campos')
      return
    }

    try {
      setLoading(true)
      setErrorMsg(null)
      setSuccessMsg(null)

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/join`,
          },
        })
        if (error) throw error
        setSuccessMsg('¡Cuenta creada! Puedes ingresar ahora con tus datos.')
        setIsSignUp(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/join')
      }
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || 'Error en la autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-6 safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Acceso al Salón</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          {isSignUp ? 'Crear cuenta en Synapse' : 'Bienvenido a Synapse'}
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {isSignUp
            ? 'Regístrate para conectarte al horario y tareas de tu salón.'
            : 'Inicia sesión para sincronizar tus clases, tareas y avisos.'}
        </p>
      </div>

      {/* Formulario y Métodos de Acceso */}
      <div className="my-auto py-6 space-y-4">
        {/* Botón Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-700/80 text-zinc-100 font-medium text-xs flex items-center justify-center gap-3 hover:bg-zinc-800/90 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
            />
          </svg>
          <span>Continuar con Google</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-[1px] bg-zinc-800" />
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            o con correo
          </span>
          <div className="flex-1 h-[1px] bg-zinc-800" />
        </div>

        {/* Mensajes de error o éxito */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu_correo@ejemplo.com"
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
            ) : (
              <>
                <span>{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Switch Sign In / Sign Up */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setErrorMsg(null)
            setSuccessMsg(null)
          }}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {isSignUp
            ? '¿Ya tienes cuenta? Inicia sesión'
            : '¿Primera vez aquí? Regístrate'}
        </button>
      </div>
    </div>
  )
}
