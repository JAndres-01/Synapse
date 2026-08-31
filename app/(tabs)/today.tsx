import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useNativeAuth } from '@/context/NativeAuthContext'
import { supabase } from '@/lib/nativeSupabase'
import type { Schedule, Task, Subject } from '@/types/database'
import { NativeLiveHero } from '@/components/today/NativeLiveHero'
import { NativeUrgentCarousel } from '@/components/today/NativeUrgentCarousel'
import { NativeDayTimeline } from '@/components/today/NativeDayTimeline'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function TodayScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, classroom } = useNativeAuth()

  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>([])
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(false)

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day
  }

  const loadCachedData = async () => {
    try {
      const cachedSched = await AsyncStorage.getItem('synapse_cached_schedules_today')
      const cachedTasks = await AsyncStorage.getItem('synapse_cached_urgent_tasks')
      if (cachedSched) setSchedulesToday(JSON.parse(cachedSched))
      if (cachedTasks) setUrgentTasks(JSON.parse(cachedTasks))
    } catch {}
  }

  const fetchTodayData = useCallback(async () => {
    if (!classroom || !user) return

    try {
      const todayNum = getTodayDayOfWeek()

      // 1. Cargar horario de hoy
      const { data: schedData } = await supabase
        .from('schedules')
        .select(`
          *,
          subject:subjects(*)
        `)
        .eq('classroom_id', classroom.id)
        .eq('day_of_week', todayNum)
        .order('block_number', { ascending: true })

      if (schedData) {
        setSchedulesToday(schedData as Schedule[])
        await AsyncStorage.setItem('synapse_cached_schedules_today', JSON.stringify(schedData)).catch(() => {})
      }

      // 2. Cargar tareas urgentes
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          *,
          subject:subjects(*),
          user_status:user_task_status(user_id, status)
        `)
        .eq('classroom_id', classroom.id)
        .order('due_date', { ascending: true })

      if (tasksData) {
        // Filtrar visibles para este usuario
        const visible = (tasksData as Task[]).filter(
          (t) => !t.is_private || t.created_by === user.id
        )
        setUrgentTasks(visible)
        await AsyncStorage.setItem('synapse_cached_urgent_tasks', JSON.stringify(visible)).catch(() => {})
      }
    } catch (err) {
      console.error('Error cargando datos de hoy:', err)
    } finally {
      setRefreshing(false)
    }
  }, [classroom, user])

  useEffect(() => {
    loadCachedData()
    fetchTodayData()

    if (!classroom) return

    const channel = supabase
      .channel(`public:native_today:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchTodayData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchTodayData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_task_status' },
        () => fetchTodayData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroom, fetchTodayData])

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user) return
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    // Actualización optimista instantánea
    setUrgentTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            user_status: [{ user_id: user.id, status: newStatus }],
          }
        }
        return t
      })
    )

    try {
      await supabase.from('user_task_status').upsert(
        {
          task_id: taskId,
          user_id: user.id,
          status: newStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,user_id' }
      )
    } catch (err) {
      console.error('Error actualizando estado:', err)
      fetchTodayData()
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchTodayData()
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FFFFFF"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Buenos días</Text>
        <Text style={styles.classroomName}>{classroom?.name || 'Salón Principal'}</Text>
      </View>

      {/* Tarjeta En Vivo / Próxima Clase */}
      <NativeLiveHero schedulesToday={schedulesToday} />

      {/* Carrusel de Tareas Urgentes */}
      <NativeUrgentCarousel
        tasks={urgentTasks}
        currentUserId={user?.id}
        onToggleTaskStatus={handleToggleTaskStatus}
        onNavigateToTasks={() => router.push('/(tabs)/tasks')}
      />

      {/* Cronograma de 4 Clases de Hoy */}
      <NativeDayTimeline
        schedulesToday={schedulesToday}
        tasksToday={urgentTasks}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  content: {
    paddingHorizontal: 16,
    gap: 18,
  },
  header: {
    gap: 2,
    paddingHorizontal: 2,
  },
  greeting: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  classroomName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
})
