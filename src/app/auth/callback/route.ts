import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app/today'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirigir al flujo de salón o directamente a la app
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Si hubo error, volver al login
  return NextResponse.redirect(`${origin}/auth?error=auth_failed`)
}
