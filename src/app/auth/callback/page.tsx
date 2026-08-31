'use client'

import React, { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuth = async () => {
      const code = searchParams.get('code')
      const next = searchParams.get('next') ?? '/app/today'

      if (code) {
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.replace(next)
          return
        }
      }

      router.replace('/auth?error=auth_failed')
    }

    handleAuth()
  }, [searchParams, router])

  return (
    <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-4">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
      <p className="text-sm text-zinc-400 font-medium">Iniciando sesión...</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen w-full bg-zinc-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <CallbackContent />
    </React.Suspense>
  )
}
