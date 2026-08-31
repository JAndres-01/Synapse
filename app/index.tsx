import React, { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useNativeAuth } from '@/context/NativeAuthContext'

export default function IndexScreen() {
  const { user, classroom, loading } = useNativeAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/auth')
      } else if (!classroom) {
        router.replace('/join')
      } else {
        router.replace('/(tabs)/today')
      }
    }
  }, [user, classroom, loading, router])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#A1A1AA" />
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
})
