import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let clientInstance: SupabaseClient | null = null

// Adaptador de almacenamiento híbrido (LocalStorage + Cookies)
// En iOS PWA standalone, WebKit puede purgar document.cookie en HTTP no encriptado al cerrar la app,
// pero localStorage permanece 100% persistente y seguro.
const customAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      // 1. Intentar desde localStorage (máxima persistencia en iOS PWA)
      const fromLocal = window.localStorage.getItem(key)
      if (fromLocal) return fromLocal

      // 2. Fallback a cookies
      const cookies = document.cookie.split(';')
      for (const c of cookies) {
        const [k, v] = c.trim().split('=')
        if (k === key && v) {
          return decodeURIComponent(v)
        }
      }
    } catch (e) {
      console.warn('Error leyendo auth storage:', e)
    }
    return null
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    try {
      // Guardar en localStorage
      window.localStorage.setItem(key, value)
    } catch (e) {
      console.warn('Error escribiendo en localStorage:', e)
    }

    try {
      // Guardar en cookie con duración de 1 año (31536000s)
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`
    } catch (e) {
      console.warn('Error escribiendo en cookie:', e)
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch {}

    try {
      document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`
    } catch {}
  },
}

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: customAuthStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }
    )
  }

  return clientInstance
}
