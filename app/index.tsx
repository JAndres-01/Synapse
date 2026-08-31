import React, { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { useRouter } from 'expo-router'
import { Sparkles } from 'lucide-react-native'

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

  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <Sparkles size={24} color="#FFFFFF" />
      </View>
      <ActivityIndicator size="small" color="#71717A" style={styles.spinner} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginTop: 20,
  },
})
