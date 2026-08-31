import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NativeAuthProvider } from '@/context/NativeAuthContext'
import { Slot } from 'expo-router'
import { StyleSheet, View } from 'react-native'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NativeAuthProvider>
          <View style={styles.container}>
            <StatusBar style="light" />
            <Slot />
          </View>
        </NativeAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
})
