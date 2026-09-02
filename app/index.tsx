import React, { useEffect } from 'react'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { useRouter } from 'expo-router'
import { MinimalistScreenSkeleton } from '@/components/common/MinimalistSkeleton'

export default function Index() {
  const { user, loading } = usePersonalAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (user) {
      router.replace('/(tabs)/today')
    } else {
      router.replace('/auth')
    }
  }, [user, loading, router])

  return <MinimalistScreenSkeleton />
}

