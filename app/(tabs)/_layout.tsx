import React, { useState, useEffect } from 'react'
import { Tabs, usePathname, useRouter } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { MinimalistFloatingIsland, type TabKey } from '@/components/navigation/MinimalistFloatingIsland'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'

export default function TabLayout() {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  const pathnameTab: TabKey = pathname.includes('schedule')
    ? 'schedule'
    : pathname.includes('tasks')
    ? 'tasks'
    : pathname.includes('settings')
    ? 'settings'
    : 'today'

  const [activeTab, setActiveTab] = useState<TabKey>(pathnameTab)

  useEffect(() => {
    setActiveTab(pathnameTab)
  }, [pathnameTab])

  useEffect(() => {
    const updatePending = () => {
      personalStorage.getTasks().then((tasks) => {
        const pending = tasks.filter((t) => t.status === 'pending').length
        setPendingCount(pending)
      })
    }
    updatePending()
    const unsubscribe = subscribeToPersonalStorage(updatePending)
    return unsubscribe
  }, [])

  const handleSelectTab = (tab: TabKey) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    if (tab === 'today') router.navigate('/(tabs)/today')
    if (tab === 'schedule') router.navigate('/(tabs)/schedule')
    if (tab === 'tasks') router.navigate('/(tabs)/tasks')
    if (tab === 'settings') router.navigate('/(tabs)/settings')
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
