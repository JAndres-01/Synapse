import React, { useState, useEffect } from 'react'
import { Tabs, usePathname, useRouter } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { MinimalistFloatingIsland, type TabKey } from '@/components/navigation/MinimalistFloatingIsland'
import { personalStorage } from '@/lib/personalStorage'

export default function TabLayout() {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  const activeTab: TabKey = pathname.includes('schedule')
    ? 'schedule'
    : pathname.includes('tasks')
    ? 'tasks'
    : pathname.includes('settings')
    ? 'settings'
    : 'today'

  useEffect(() => {
    personalStorage.getTasks().then((tasks) => {
      const pending = tasks.filter((t) => t.status === 'pending').length
      setPendingCount(pending)
    })
  }, [pathname])

  const handleSelectTab = (tab: TabKey) => {
    if (tab === 'today') router.replace('/(tabs)/today')
    if (tab === 'schedule') router.replace('/(tabs)/schedule')
    if (tab === 'tasks') router.replace('/(tabs)/tasks')
    if (tab === 'settings') router.replace('/(tabs)/settings')
  }

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Ocultamos la barra nativa para usar nuestra cápsula flotante
        }}
      >
        <Tabs.Screen name="today" />
        <Tabs.Screen name="schedule" />
        <Tabs.Screen name="tasks" />
        <Tabs.Screen name="settings" />
      </Tabs>

      <MinimalistFloatingIsland
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        pendingTasksCount={pendingCount}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
})
