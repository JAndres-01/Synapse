import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { Schedule, Task, Subject } from '@/types/personal'
import { MinimalistLiveHero } from '@/components/today/MinimalistLiveHero'
import { MinimalistTodayTasks } from '@/components/today/MinimalistTodayTasks'
import { MinimalistDayTimeline } from '@/components/today/MinimalistDayTimeline'
import { MinimalistTaskDetailModal } from '@/components/tasks/MinimalistTaskDetailModal'
import { MinimalistCreateTaskModal } from '@/components/tasks/MinimalistCreateTaskModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

export default function TodayScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile } = usePersonalAuth()

  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Modales
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day // 1: Lun ... 5: Vie
  }

  const loadLocalCache = async () => {
    const [cachedScheds, cachedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getSchedules(),
      personalStorage.getTasks(),
      personalStorage.getSubjects(),
    ])

    const todayNum = getTodayDayOfWeek()
    setSchedulesToday(cachedScheds.filter((s) => s.day_of_week === todayNum))
    setTasks(cachedTasks)
    setSubjects(cachedSubjs)
  }

  const fetchCloudData = useCallback(async () => {
    if (!user) return

    try {
      const todayNum = getTodayDayOfWeek()

      const [schedRes, tasksRes, subjRes] = await Promise.all([
        supabase
          .from('schedules')
          .select('*, subject:subjects(*)')
          .eq('user_id', user.id)
          .order('block_number', { ascending: true }),
        supabase
          .from('tasks')
          .select('*, subject:subjects(*)')
          .eq('user_id', user.id)
          .order('due_date', { ascending: true }),
        supabase
          .from('subjects')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ])

      if (schedRes.data) {
        const allScheds = schedRes.data as Schedule[]
        await personalStorage.setSchedules(allScheds)
        setSchedulesToday(allScheds.filter((s) => s.day_of_week === todayNum))
      }

      if (tasksRes.data) {
        const allTasks = tasksRes.data as Task[]
        await personalStorage.setTasks(allTasks)
        setTasks(allTasks)
      }

      if (subjRes.data) {
        const allSubjs = subjRes.data as Subject[]
        await personalStorage.setSubjects(allSubjs)
        setSubjects(allSubjs)
      }
    } catch (err) {
      console.error('Error sincronizando hoy:', err)
    } finally {
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    loadLocalCache()
    fetchCloudData()

    if (!user) return

    const channel = supabase
      .channel(`personal_today_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        () => fetchCloudData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `user_id=eq.${user.id}` },
        () => fetchCloudData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchCloudData])

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    const updated = tasks.map((t) => {
      if (t.id === taskId) return { ...t, status: nextStatus as 'pending' | 'completed' }
      return t
    })
    setTasks(updated)
    await personalStorage.setTasks(updated)

    try {
      await supabase
        .from('tasks')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId)
    } catch (err) {
      fetchCloudData()
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId)
    setTasks(updated)
    await personalStorage.setTasks(updated)

    try {
      await supabase.from('tasks').delete().eq('id', taskId)
    } catch (err) {
      fetchCloudData()
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchCloudData()
  }

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>BUENOS DÃAS</Text>
              <Text style={styles.userName}>
                {profile?.full_name || 'Mi DÃ­a'}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('light')
                setTaskToEdit(null)
                setShowCreateModal(true)
              }}
              style={styles.headerAddBtn}
            >
              <Plus size={15} color="#09090B" strokeWidth={2.5} />
              <Text style={styles.headerAddBtnText}>Nueva Tarea</Text>
            </Pressable>
          </View>
        </View>

        {/* Tarjeta En Vivo (Ãšnico Contenedor Delimitado) */}
        <MinimalistLiveHero schedulesToday={schedulesToday} />

        {/* Lista Plana de Tareas PrÃ³ximas */}
        <MinimalistTodayTasks
          tasks={tasks}
          onToggleTask={handleToggleTaskStatus}
          onOpenTaskDetail={(t) => setSelectedTask(t)}
          onNavigateToTasks={() => router.replace('/(tabs)/tasks')}
        />

        {/* Timeline Continuo de Clases */}
        <MinimalistDayTimeline schedulesToday={schedulesToday} />
      </ScrollView>

      {/* Modal de Detalle */}
      <MinimalistTaskDetailModal
        task={selectedTask}
        visible={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onToggleStatus={handleToggleTaskStatus}
        onDeleteTask={handleDeleteTask}
        onEditTask={(t) => {
          setSelectedTask(null)
          setTaskToEdit(t)
          setShowCreateModal(true)
        }}
      />

      {/* Modal de CreaciÃ³n / EdiciÃ³n */}
      {user && (
        <MinimalistCreateTaskModal
          visible={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setTaskToEdit(null)
          }}
          userId={user.id}
          subjects={subjects}
          initialTask={taskToEdit}
          onTaskSaved={fetchCloudData}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    paddingHorizontal: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerAddBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '700',
  },
})
