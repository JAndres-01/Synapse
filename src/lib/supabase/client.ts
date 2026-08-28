import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let clientInstance: SupabaseClient | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Patrón Singleton para el navegador para mantener la sesión y cookies sincronizadas
  if (!clientInstance) {
    clientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          name: 'sb-auth-token',
          maxAge: 60 * 60 * 24 * 365, // 1 año de persistencia para evitar cierre de sesión en iOS
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production' && window.location.protocol === 'https:',
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    )
  }

  return clientInstance
}
