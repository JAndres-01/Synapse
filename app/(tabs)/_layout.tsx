import React, { useState, useEffect, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { NativeFloatingIsland, type TabKey } from '@/components/navigation/NativeFloatingIsland'
import { useNativeAuth } from '@/context/NativeAuthContext'
import { supabase } from '@/lib/nativeSupabase'

export default function TabsLayout() {
  const router = useRouter()
  const { user, classroom, loading } = useNativeAuth()
  const [pendingTasksCount, setPendingTasksCount] = useState<number>(0)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/auth')
      } else if (!classroom) {
        router.replace('/join')
      }
    }
  }, [user, classroom, loading, router])

  const fetchPendingCount = useCallback(async () => {
    if (!classroom || !user) return

    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          created_by,
          is_private,
          user_status:user_task_status(user_id, status)
        `)
        .eq('classroom_id', classroom.id)

      if (!error && tasks) {
        const pending = tasks.filter((t) => {
          const isVisibleToUser = !t.is_private || t.created_by === user.id
          if (!isVisibleToUser) return false

          const userStatusList = t.user_status || (t as unknown as { user_task_status?: Array<{ user_id: string; status: string }> }).user_task_status
          const isCompleted = Array.isArray(userStatusList)
            ? userStatusList.some((s) => s.user_id === user.id && s.status === 'completed')
            : Boolean(userStatusList && (userStatusList as { status?: string; user_id?: string }).status === 'completed' && (userStatusList as { user_id?: string }).user_id === user.id)

          return !isCompleted
        }).length

        setPendingTasksCount(pending)
      }
    } catch (err) {
      console.error('Error cargando conteo de tareas:', err)
    }
  }, [classroom, user])

  useEffect(() => {
    if (!classroom || !user) return
    fetchPendingCount()

    const channel = supabase
      .channel(`public:native_layout_tasks:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchPendingCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_task_status' },
        () => fetchPendingCount()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroom, user, fetchPendingCount])

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Ocultamos el tab bar por defecto para usar nuestra Floating Island
        }}
        tabBar={(props) => {
          const routeName = props.state.routes[props.state.index].name as TabKey
          return (
            <NativeFloatingIsland
              activeTab={routeName}
              onSelectTab={(tab) => {
                props.navigation.navigate(tab)
              }}
              pendingTasksCount={pendingTasksCount}
            />
          )
        }}
      >
        <Tabs.Screen name="today" options={{ title: 'Hoy' }} />
        <Tabs.Screen name="schedule" options={{ title: 'Horario' }} />
        <Tabs.Screen name="tasks" options={{ title: 'Tareas' }} />
        <Tabs.Screen name="settings" options={{ title: 'Salón' }} />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
})
