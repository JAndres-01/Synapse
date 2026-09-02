import React, { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MinimalistScreenSkeleton } from '@/components/common/MinimalistSkeleton'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/(tabs)/today')
  }, [router])

  return <MinimalistScreenSkeleton />
}


